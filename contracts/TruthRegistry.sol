// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title TruthRegistry
 * @notice On-chain registry for truth quanta. Each quantum is an IPFS-pinned
 *         claim scored across four epistemological pillars:
 *         Correspondence, Coherence, Pragmatism, Relativism.
 *
 *         Hosts earn TRUTH for pinning; vetters earn for scoring; disputers
 *         can fork quanta with counter-evidence.
 *
 * @dev    IPFS CIDs stored as bytes32 (CIDv1 digest). Full CID reconstructed
 *         off-chain. Pillar scores are 0-10000 (basis points for 0.00-1.00).
 */

interface ITruthToken {
    function mint(address to, uint256 amount, string calldata reason) external;
    function slash(address from, uint256 bps) external;
}

contract TruthRegistry {
    // ──────────────────────────────────────────────
    //  Types
    // ──────────────────────────────────────────────
    enum QuantumStatus { Active, Disputed, Archived, Forked }

    struct PillarScores {
        uint16 correspondence; // 0-10000
        uint16 coherence;
        uint16 pragmatism;
        uint16 relativism;
    }

    struct TruthQuantum {
        uint256 id;
        address host;           // who pinned it
        bytes32 ipfsCid;        // IPFS content hash
        string  discipline;     // e.g. "Physics", "History", "Ethics"
        string  claim;          // human-readable claim summary
        PillarScores scores;
        uint256 stakeAmount;    // TRUTH staked by host
        QuantumStatus status;
        uint256 createdAt;
        uint256 verifierCount;
    }

    // ──────────────────────────────────────────────
    //  State
    // ──────────────────────────────────────────────
    ITruthToken public truthToken;
    address public owner;

    uint256 public nextQuantumId;
    mapping(uint256 => TruthQuantum) public quanta;
    mapping(uint256 => mapping(address => bool)) public hasVerified;

    // Rewards (configurable)
    uint256 public hostReward  = 100 ether;   // TRUTH per quantum hosted
    uint256 public vetReward   = 10 ether;    // TRUTH per verification
    uint256 public minStake    = 50 ether;    // minimum TRUTH stake to host

    // Consensus threshold: aggregate score must be >= 7000 (0.70) to stay Active
    uint256 public constant CONSENSUS_THRESHOLD = 7000;
    uint256 public constant ARCHIVAL_AGE = 30 days;

    // ──────────────────────────────────────────────
    //  Events
    // ──────────────────────────────────────────────
    event QuantumCreated(uint256 indexed id, address indexed host, bytes32 ipfsCid, string discipline);
    event QuantumVerified(uint256 indexed id, address indexed verifier, PillarScores scores);
    event QuantumDisputed(uint256 indexed id, address indexed challenger, uint256 forkId);
    event QuantumArchived(uint256 indexed id);

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
    constructor(address _truthToken) {
        truthToken = ITruthToken(_truthToken);
        owner = msg.sender;
    }

    // ──────────────────────────────────────────────
    //  Host a quantum
    // ──────────────────────────────────────────────

    /**
     * @notice Pin a new truth quantum. Host must have staked TRUTH (handled off-chain
     *         or via approve+transferFrom in production). MVP: owner mints reward.
     */
    function createQuantum(
        bytes32 ipfsCid,
        string calldata discipline,
        string calldata claim,
        PillarScores calldata initialScores
    ) external returns (uint256 quantumId) {
        require(ipfsCid != bytes32(0), "Empty CID");
        require(bytes(discipline).length > 0, "Empty discipline");
        require(bytes(claim).length > 0, "Empty claim");

        quantumId = nextQuantumId++;
        quanta[quantumId] = TruthQuantum({
            id: quantumId,
            host: msg.sender,
            ipfsCid: ipfsCid,
            discipline: discipline,
            claim: claim,
            scores: initialScores,
            stakeAmount: minStake,
            status: QuantumStatus.Active,
            createdAt: block.timestamp,
            verifierCount: 0
        });

        // Reward host
        truthToken.mint(msg.sender, hostReward, "quantum-host");

        emit QuantumCreated(quantumId, msg.sender, ipfsCid, discipline);
    }

    // ──────────────────────────────────────────────
    //  Verify (vet) a quantum
    // ──────────────────────────────────────────────

    /**
     * @notice Submit pillar scores for a quantum. Scores averaged with existing.
     *         Verifier earns TRUTH.
     */
    function verify(uint256 quantumId, PillarScores calldata scores) external {
        TruthQuantum storage q = quanta[quantumId];
        require(q.status == QuantumStatus.Active, "Not active");
        require(q.host != msg.sender, "Host cannot self-verify");
        require(!hasVerified[quantumId][msg.sender], "Already verified");

        hasVerified[quantumId][msg.sender] = true;

        // Rolling average: new = (old * n + new) / (n + 1)
        uint256 n = q.verifierCount;
        q.scores.correspondence = uint16((_avg(q.scores.correspondence, scores.correspondence, n)));
        q.scores.coherence      = uint16((_avg(q.scores.coherence, scores.coherence, n)));
        q.scores.pragmatism     = uint16((_avg(q.scores.pragmatism, scores.pragmatism, n)));
        q.scores.relativism     = uint16((_avg(q.scores.relativism, scores.relativism, n)));
        q.verifierCount++;

        // Reward verifier
        truthToken.mint(msg.sender, vetReward, "quantum-vet");

        emit QuantumVerified(quantumId, msg.sender, scores);
    }

    // ──────────────────────────────────────────────
    //  Dispute (fork) a quantum
    // ──────────────────────────────────────────────

    /**
     * @notice Challenge a quantum with counter-evidence. Creates a fork.
     *         Original marked Disputed; challenger's fork starts fresh.
     */
    function dispute(
        uint256 quantumId,
        bytes32 counterCid,
        string calldata claim,
        PillarScores calldata counterScores
    ) external returns (uint256 forkId) {
        TruthQuantum storage q = quanta[quantumId];
        require(q.status == QuantumStatus.Active, "Not active");

        q.status = QuantumStatus.Disputed;

        // Create fork quantum
        forkId = nextQuantumId++;
        quanta[forkId] = TruthQuantum({
            id: forkId,
            host: msg.sender,
            ipfsCid: counterCid,
            discipline: q.discipline,
            claim: claim,
            scores: counterScores,
            stakeAmount: minStake,
            status: QuantumStatus.Active,
            createdAt: block.timestamp,
            verifierCount: 0
        });

        // Slash original host (10%)
        truthToken.slash(q.host, 1000);
        // Reward challenger
        truthToken.mint(msg.sender, hostReward, "quantum-dispute-fork");

        emit QuantumDisputed(quantumId, msg.sender, forkId);
    }

    // ──────────────────────────────────────────────
    //  Views
    // ──────────────────────────────────────────────

    function aggregateScore(uint256 quantumId) external view returns (uint256) {
        PillarScores memory s = quanta[quantumId].scores;
        return (uint256(s.correspondence) + s.coherence + s.pragmatism + s.relativism) / 4;
    }

    function getQuantum(uint256 quantumId) external view returns (TruthQuantum memory) {
        return quanta[quantumId];
    }

    // ──────────────────────────────────────────────
    //  Internal
    // ──────────────────────────────────────────────

    function _avg(uint16 current, uint16 incoming, uint256 n) internal pure returns (uint256) {
        return (uint256(current) * n + uint256(incoming)) / (n + 1);
    }

    // ──────────────────────────────────────────────
    //  Admin
    // ──────────────────────────────────────────────

    function setRewards(uint256 _host, uint256 _vet, uint256 _minStake) external onlyOwner {
        hostReward = _host;
        vetReward = _vet;
        minStake = _minStake;
    }

    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "Zero address");
        owner = newOwner;
    }
}
