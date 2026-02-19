// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title TruthStaking
 * @notice Companion staking vault for the TruthSea protocol.
 *         Users approve() TRUTH tokens, then this contract holds them
 *         as stakes for edges, challenges, and weak-link flags.
 *
 * @dev    Since TruthToken is not upgradeable, we cannot add staking
 *         logic to it directly. This vault uses transferFrom to lock tokens.
 */
contract TruthStaking {
    // ──────────────────────────────────────────────
    //  State
    // ──────────────────────────────────────────────

    IERC20 public immutable truthToken;
    address public owner;

    /// @notice Authorized contracts that can slash and reward (TruthDAG, etc.)
    mapping(address => bool) public authorized;

    /// @notice Locked stakes: user -> purposeKey -> amount
    /// purposeKey = keccak256(abi.encode(purpose, id))
    mapping(address => mapping(bytes32 => uint256)) public stakes;

    /// @notice Whether a stake is currently locked (cannot be withdrawn)
    mapping(address => mapping(bytes32 => bool)) public locked;

    // ──────────────────────────────────────────────
    //  Events
    // ──────────────────────────────────────────────

    event Staked(address indexed user, bytes32 indexed key, uint256 amount);
    event Unstaked(address indexed user, bytes32 indexed key, uint256 amount);
    event Slashed(address indexed user, bytes32 indexed key, uint256 amount, address indexed slasher);
    event Rewarded(address indexed user, uint256 amount, address indexed rewarder);
    event AuthorizationUpdated(address indexed account, bool status);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    // ──────────────────────────────────────────────
    //  Modifiers
    // ──────────────────────────────────────────────

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    modifier onlyAuthorized() {
        require(authorized[msg.sender], "Not authorized");
        _;
    }

    // ──────────────────────────────────────────────
    //  Constructor
    // ──────────────────────────────────────────────

    constructor(address _truthToken) {
        truthToken = IERC20(_truthToken);
        owner = msg.sender;
    }

    // ──────────────────────────────────────────────
    //  Staking
    // ──────────────────────────────────────────────

    /**
     * @notice Stake TRUTH tokens for a specific purpose.
     * @param key    Purpose key, e.g. keccak256(abi.encode("edge", edgeId))
     * @param amount Amount of TRUTH to stake (in wei)
     */
    function stake(bytes32 key, uint256 amount) external {
        require(amount > 0, "Zero amount");
        require(truthToken.transferFrom(msg.sender, address(this), amount), "Transfer failed");
        stakes[msg.sender][key] += amount;
        emit Staked(msg.sender, key, amount);
    }

    /**
     * @notice Withdraw staked TRUTH. Only works if the stake is not locked.
     * @param key Purpose key matching the original stake
     */
    function unstake(bytes32 key) external {
        require(!locked[msg.sender][key], "Stake is locked");
        uint256 amount = stakes[msg.sender][key];
        require(amount > 0, "No stake");
        stakes[msg.sender][key] = 0;
        require(truthToken.transfer(msg.sender, amount), "Transfer failed");
        emit Unstaked(msg.sender, key, amount);
    }

    // ──────────────────────────────────────────────
    //  Authorized operations (TruthDAG calls these)
    // ──────────────────────────────────────────────

    /**
     * @notice Lock a stake so it cannot be withdrawn (e.g. during a dispute).
     */
    function lockStake(address user, bytes32 key) external onlyAuthorized {
        locked[user][key] = true;
    }

    /**
     * @notice Unlock a stake (e.g. after dispute resolution).
     */
    function unlockStake(address user, bytes32 key) external onlyAuthorized {
        locked[user][key] = false;
    }

    /**
     * @notice Slash a user's stake by basis points. Slashed tokens are burned.
     * @param user Address to slash
     * @param key  Purpose key of the stake
     * @param bps  Basis points to slash (e.g. 1000 = 10%)
     */
    function slash(address user, bytes32 key, uint256 bps) external onlyAuthorized {
        require(bps > 0 && bps <= 10000, "Invalid bps");
        uint256 staked = stakes[user][key];
        require(staked > 0, "No stake to slash");
        uint256 slashAmount = (staked * bps) / 10000;
        stakes[user][key] -= slashAmount;
        // Burn the slashed tokens by sending to address(0) won't work with ERC20,
        // so we hold them in this contract. Owner can sweep burned tokens.
        emit Slashed(user, key, slashAmount, msg.sender);
    }

    /**
     * @notice Transfer staked tokens from one user's stake to another address.
     *         Used for rewarding challengers from the defender's stake.
     * @param from    Address whose stake is debited
     * @param key     Purpose key of the stake
     * @param to      Recipient address
     * @param amount  Exact amount to transfer
     */
    function transferStake(address from, bytes32 key, address to, uint256 amount) external onlyAuthorized {
        require(stakes[from][key] >= amount, "Insufficient stake");
        stakes[from][key] -= amount;
        require(truthToken.transfer(to, amount), "Transfer failed");
    }

    /**
     * @notice Refund a user's full stake for a given key.
     */
    function refundStake(address user, bytes32 key) external onlyAuthorized {
        uint256 amount = stakes[user][key];
        require(amount > 0, "No stake");
        stakes[user][key] = 0;
        locked[user][key] = false;
        require(truthToken.transfer(user, amount), "Transfer failed");
        emit Unstaked(user, key, amount);
    }

    // ──────────────────────────────────────────────
    //  Views
    // ──────────────────────────────────────────────

    function getStake(address user, bytes32 key) external view returns (uint256) {
        return stakes[user][key];
    }

    function isLocked(address user, bytes32 key) external view returns (bool) {
        return locked[user][key];
    }

    // ──────────────────────────────────────────────
    //  Admin
    // ──────────────────────────────────────────────

    function setAuthorized(address account, bool status) external onlyOwner {
        authorized[account] = status;
        emit AuthorizationUpdated(account, status);
    }

    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "Zero address");
        address oldOwner = owner;
        owner = newOwner;
        emit OwnershipTransferred(oldOwner, newOwner);
    }
}
