// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./TruthRegistryV2.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title BountyBridge
 * @notice Cross-protocol bridge connecting CrowdedSea bounties to TruthSea verification.
 *         When a bounty-truth task is completed, the evidence becomes a TruthQuantum.
 *         Bounty ETH only releases if the linked quantum passes consensus threshold (0.70).
 *
 * Flow:
 *   1. Bounty poster creates bounty with ETH escrow
 *   2. Agent/human claims bounty, submits evidence
 *   3. Evidence becomes a TruthQuantum on TruthSea
 *   4. If quantum scores >= 0.70 aggregate → bounty releases + TRUTH minted
 *   5. If disputed → bounty held until resolution
 */

interface ITruthRegistryV2 {
    function meetsConsensus(uint256 quantumId) external view returns (bool);
    function getQuantum(uint256 quantumId) external view returns (TruthRegistryV2.TruthQuantum memory);
}

contract BountyBridge is ReentrancyGuard {
    // ──────────────────────────────────────────────
    //  Types
    // ──────────────────────────────────────────────
    enum BountyStatus { Open, Claimed, PendingVerification, Completed, Refunded }

    struct TruthBounty {
        uint256 id;
        address poster;          // who posted the bounty
        address claimant;        // who claimed it
        uint256 reward;          // ETH amount escrowed
        string  description;     // what needs to be verified
        string  discipline;      // target discipline
        uint256 quantumId;       // linked TruthQuantum (set on completion)
        BountyStatus status;
        uint256 createdAt;
        uint256 deadline;        // auto-refund after this
    }

    // ──────────────────────────────────────────────
    //  State
    // ──────────────────────────────────────────────
    ITruthRegistryV2 public immutable registry;
    address public owner;

    uint256 public nextBountyId;
    mapping(uint256 => TruthBounty) public bounties;

    uint256 public protocolFeeBps = 250; // 2.5% protocol fee
    uint256 public constant MAX_FEE_BPS = 1000; // max 10%
    uint256 public constant DEFAULT_DEADLINE = 7 days;

    address public feeRecipient;
    uint256 public totalFeesCollected;

    // ──────────────────────────────────────────────
    //  Events
    // ──────────────────────────────────────────────
    event BountyCreated(uint256 indexed id, address indexed poster, uint256 reward, string discipline);
    event BountyClaimed(uint256 indexed id, address indexed claimant);
    event BountyCompleted(uint256 indexed id, uint256 indexed quantumId, address indexed claimant, uint256 payout);
    event BountyRefunded(uint256 indexed id, address indexed poster, uint256 amount);
    event BountyDisputed(uint256 indexed id, uint256 indexed quantumId);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    // ──────────────────────────────────────────────
    //  Modifiers
    // ──────────────────────────────────────────────
    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    // ──────────────────────────────────────────────
    //  Constructor
    // ──────────────────────────────────────────────
    constructor(address _registry) {
        registry = ITruthRegistryV2(_registry);
        owner = msg.sender;
        feeRecipient = msg.sender;
    }

    // ──────────────────────────────────────────────
    //  Create bounty (poster deposits ETH)
    // ──────────────────────────────────────────────

    function createBounty(
        string calldata description,
        string calldata discipline,
        uint256 deadlineDuration
    ) external payable returns (uint256 bountyId) {
        require(msg.value > 0, "Must deposit ETH");
        require(bytes(description).length > 0, "Empty description");
        require(bytes(discipline).length > 0, "Empty discipline");

        uint256 deadline = deadlineDuration > 0
            ? block.timestamp + deadlineDuration
            : block.timestamp + DEFAULT_DEADLINE;

        bountyId = nextBountyId++;
        bounties[bountyId] = TruthBounty({
            id: bountyId,
            poster: msg.sender,
            claimant: address(0),
            reward: msg.value,
            description: description,
            discipline: discipline,
            quantumId: 0,
            status: BountyStatus.Open,
            createdAt: block.timestamp,
            deadline: deadline
        });

        emit BountyCreated(bountyId, msg.sender, msg.value, discipline);
    }

    // ──────────────────────────────────────────────
    //  Claim bounty
    // ──────────────────────────────────────────────

    function claimBounty(uint256 bountyId) external {
        TruthBounty storage b = bounties[bountyId];
        require(b.status == BountyStatus.Open, "Not open");
        require(block.timestamp < b.deadline, "Expired");

        b.claimant = msg.sender;
        b.status = BountyStatus.Claimed;

        emit BountyClaimed(bountyId, msg.sender);
    }

    // ──────────────────────────────────────────────
    //  Complete bounty with linked quantum
    // ──────────────────────────────────────────────

    /**
     * @notice Atomic completion: link a verified TruthQuantum to a bounty.
     *         Only releases ETH if the quantum meets consensus threshold.
     */
    function completeBountyWithQuantum(
        uint256 bountyId,
        uint256 quantumId
    ) external nonReentrant {
        TruthBounty storage b = bounties[bountyId];
        require(b.status == BountyStatus.Claimed, "Not claimed");
        require(b.claimant == msg.sender, "Not claimant");

        b.quantumId = quantumId;

        // Check if quantum meets consensus
        if (registry.meetsConsensus(quantumId)) {
            b.status = BountyStatus.Completed;

            // Calculate payout after protocol fee
            uint256 fee = (b.reward * protocolFeeBps) / 10000;
            uint256 payout = b.reward - fee;

            totalFeesCollected += fee;

            // Transfer payout to claimant
            (bool sent,) = b.claimant.call{value: payout}("");
            require(sent, "ETH transfer failed");

            // Transfer fee to protocol
            if (fee > 0) {
                (bool feeSent,) = feeRecipient.call{value: fee}("");
                require(feeSent, "Fee transfer failed");
            }

            emit BountyCompleted(bountyId, quantumId, msg.sender, payout);
        } else {
            // Quantum doesn't meet threshold yet — hold bounty
            b.status = BountyStatus.PendingVerification;
            emit BountyDisputed(bountyId, quantumId);
        }
    }

    // ──────────────────────────────────────────────
    //  Retry completion (after more verifiers score)
    // ──────────────────────────────────────────────

    function retryCompletion(uint256 bountyId) external nonReentrant {
        TruthBounty storage b = bounties[bountyId];
        require(b.status == BountyStatus.PendingVerification, "Not pending");
        require(b.claimant == msg.sender, "Not claimant");

        if (registry.meetsConsensus(b.quantumId)) {
            b.status = BountyStatus.Completed;

            uint256 fee = (b.reward * protocolFeeBps) / 10000;
            uint256 payout = b.reward - fee;
            totalFeesCollected += fee;

            (bool sent,) = b.claimant.call{value: payout}("");
            require(sent, "ETH transfer failed");

            if (fee > 0) {
                (bool feeSent,) = feeRecipient.call{value: fee}("");
                require(feeSent, "Fee transfer failed");
            }

            emit BountyCompleted(bountyId, b.quantumId, msg.sender, payout);
        }
        // If still not meeting consensus, stays PendingVerification
    }

    // ──────────────────────────────────────────────
    //  Refund expired bounties
    // ──────────────────────────────────────────────

    function refundExpired(uint256 bountyId) external nonReentrant {
        TruthBounty storage b = bounties[bountyId];
        require(
            b.status == BountyStatus.Open || b.status == BountyStatus.Claimed || b.status == BountyStatus.PendingVerification,
            "Cannot refund"
        );
        require(block.timestamp >= b.deadline, "Not expired");

        b.status = BountyStatus.Refunded;

        (bool sent,) = b.poster.call{value: b.reward}("");
        require(sent, "Refund failed");

        emit BountyRefunded(bountyId, b.poster, b.reward);
    }

    // ──────────────────────────────────────────────
    //  Views
    // ──────────────────────────────────────────────

    function getBounty(uint256 bountyId) external view returns (TruthBounty memory) {
        return bounties[bountyId];
    }

    // ──────────────────────────────────────────────
    //  Admin
    // ──────────────────────────────────────────────

    function setProtocolFee(uint256 _feeBps) external onlyOwner {
        require(_feeBps <= MAX_FEE_BPS, "Fee too high");
        protocolFeeBps = _feeBps;
    }

    function setFeeRecipient(address _recipient) external onlyOwner {
        require(_recipient != address(0), "Zero address");
        feeRecipient = _recipient;
    }

    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "Zero address");
        address oldOwner = owner;
        owner = newOwner;
        emit OwnershipTransferred(oldOwner, newOwner);
    }
}
