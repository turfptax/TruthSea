// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title TruthRegistryV2
 * @notice On-chain registry for truth quanta with FULL epistemological framework:
 *         4 Truth Verification Frameworks + 8-Dimensional Moral Vector.
 *
 *         Truth Frameworks (0-10000 each = 0.00-1.00):
 *           1. Correspondence — maps to observable reality
 *           2. Coherence      — fits the web of known truths
 *           3. Convergence    — independent sources agree over time
 *           4. Pragmatism     — works in practice
 *
 *         Moral Vector (signed, -10000 to +10000 each):
 *           1. Care / Harm
 *           2. Fairness / Cheating
 *           3. Loyalty / Betrayal
 *           4. Authority / Subversion
 *           5. Sanctity / Degradation
 *           6. Liberty / Oppression
 *           7. Epistemic Humility / Dogmatism
 *           8. Temporal Stewardship / Short-term Extraction
 *
 * @dev    IPFS CIDs stored as bytes32 (CIDv1 digest). Full CID reconstructed
 *         off-chain. Pillar scores are basis points. Moral vector is signed basis points.
 *         Optional ERC-8004 agent identity linking for reputation bridging.
 */

interface ITruthToken {
    function mint(address to, uint256 amount, string calldata reason) external;
    function slash(address from, uint256 bps) external;
}

contract TruthRegistryV2 {
    // ──────────────────────────────────────────────
    //  Types
    // ──────────────────────────────────────────────
    enum QuantumStatus { Active, Disputed, Archived, Forked }

    struct TruthScores {
        uint16 correspondence; // 0-10000
        uint16 coherence;      // 0-10000
        uint16 convergence;    // 0-10000 (NEW in v2)
        uint16 pragmatism;     // 0-10000
    }

    struct MoralVector {
        int16 care;                 // Care ↔ Harm
        int16 fairness;             // Fairness ↔ Cheating
        int16 loyalty;              // Loyalty ↔ Betrayal
        int16 authority;            // Authority ↔ Subversion
        int16 sanctity;             // Sanctity ↔ Degradation
        int16 liberty;              // Liberty ↔ Oppression
        int16 epistemicHumility;    // Open inquiry ↔ Dogmatism
        int16 temporalStewardship;  // Long-term ↔ Short-term extraction
    }

    struct TruthQuantum {
        uint256 id;
        address host;            // who pinned it
        bytes32 ipfsCid;         // IPFS content hash
        string  discipline;      // e.g. "Physics", "Medicine", "Ethics"
        string  claim;           // human-readable claim summary
        TruthScores truthScores;
        MoralVector moralVector;
        uint256 stakeAmount;     // TRUTH staked by host
        QuantumStatus status;
        uint256 createdAt;
        uint256 verifierCount;
        bytes32 erc8004AgentId;  // optional ERC-8004 identity link
    }

    // ──────────────────────────────────────────────
    //  State
    // ──────────────────────────────────────────────
    ITruthToken public truthToken;
    address public owner;

    uint256 public nextQuantumId;
    mapping(uint256 => TruthQuantum) public quanta;
    mapping(uint256 => mapping(address => bool)) public hasVerified;

    // Agent identity mapping (wallet → ERC-8004 agent ID)
    mapping(address => bytes32) public agentIdentities;

    // Rewards (configurable)
    uint256 public hostReward  = 100 ether;   // TRUTH per quantum hosted
    uint256 public vetReward   = 10 ether;    // TRUTH per verification
    uint256 public minStake    = 50 ether;    // minimum TRUTH stake to host

    // Consensus threshold: aggregate truth score must be >= 7000 (0.70) to stay Active
    uint256 public constant CONSENSUS_THRESHOLD = 7000;
    uint256 public constant ARCHIVAL_AGE = 30 days;

    // Score bounds
    uint16 public constant MAX_TRUTH_SCORE = 10000;
    int16  public constant MAX_MORAL_SCORE = 10000;
    int16  public constant MIN_MORAL_SCORE = -10000;

    // ──────────────────────────────────────────────
    //  Events
    // ──────────────────────────────────────────────
    event QuantumCreated(
        uint256 indexed id,
        address indexed host,
        bytes32 ipfsCid,
        string discipline,
        bytes32 erc8004AgentId
    );
    event QuantumVerified(
        uint256 indexed id,
        address indexed verifier,
        TruthScores truthScores,
        MoralVector moralVector
    );
    event QuantumDisputed(uint256 indexed id, address indexed challenger, uint256 forkId);
    event QuantumArchived(uint256 indexed id);
    event AgentIdentityLinked(address indexed wallet, bytes32 erc8004AgentId);

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
    //  Agent Identity
    // ──────────────────────────────────────────────

    /**
     * @notice Link an ERC-8004 agent identity to this wallet.
     *         Used for reputation bridging — verifications feed back
     *         to the agent's on-chain reputation.
     */
    function linkAgentIdentity(bytes32 erc8004AgentId) external {
        require(erc8004AgentId != bytes32(0), "Empty agent ID");
        agentIdentities[msg.sender] = erc8004AgentId;
        emit AgentIdentityLinked(msg.sender, erc8004AgentId);
    }

    // ──────────────────────────────────────────────
    //  Host a quantum
    // ──────────────────────────────────────────────

    /**
     * @notice Pin a new truth quantum with full framework scores.
     */
    function createQuantum(
        bytes32 ipfsCid,
        string calldata discipline,
        string calldata claim,
        TruthScores calldata initialTruthScores,
        MoralVector calldata initialMoralVector
    ) external returns (uint256 quantumId) {
        require(ipfsCid != bytes32(0), "Empty CID");
        require(bytes(discipline).length > 0, "Empty discipline");
        require(bytes(claim).length > 0, "Empty claim");
        _validateTruthScores(initialTruthScores);
        _validateMoralVector(initialMoralVector);

        quantumId = nextQuantumId++;

        TruthQuantum storage q = quanta[quantumId];
        q.id = quantumId;
        q.host = msg.sender;
        q.ipfsCid = ipfsCid;
        q.discipline = discipline;
        q.claim = claim;
        q.truthScores = initialTruthScores;
        q.moralVector = initialMoralVector;
        q.stakeAmount = minStake;
        q.status = QuantumStatus.Active;
        q.createdAt = block.timestamp;
        q.verifierCount = 0;
        q.erc8004AgentId = agentIdentities[msg.sender];

        // Reward host
        truthToken.mint(msg.sender, hostReward, "quantum-host-v2");

        emit QuantumCreated(quantumId, msg.sender, ipfsCid, discipline, q.erc8004AgentId);
    }

    // ──────────────────────────────────────────────
    //  Verify (vet) a quantum
    // ──────────────────────────────────────────────

    /**
     * @notice Submit truth scores AND moral vector for a quantum.
     *         Both are rolling-averaged with existing scores.
     */
    function verify(
        uint256 quantumId,
        TruthScores calldata scores,
        MoralVector calldata moral
    ) external {
        TruthQuantum storage q = quanta[quantumId];
        require(q.status == QuantumStatus.Active, "Not active");
        require(q.host != msg.sender, "Host cannot self-verify");
        require(!hasVerified[quantumId][msg.sender], "Already verified");

        _validateTruthScores(scores);
        _validateMoralVector(moral);

        hasVerified[quantumId][msg.sender] = true;

        uint256 n = q.verifierCount;

        // Rolling average truth scores
        q.truthScores.correspondence = uint16(_avgUint(q.truthScores.correspondence, scores.correspondence, n));
        q.truthScores.coherence      = uint16(_avgUint(q.truthScores.coherence, scores.coherence, n));
        q.truthScores.convergence    = uint16(_avgUint(q.truthScores.convergence, scores.convergence, n));
        q.truthScores.pragmatism     = uint16(_avgUint(q.truthScores.pragmatism, scores.pragmatism, n));

        // Rolling average moral vector (signed)
        q.moralVector.care                = int16(_avgInt(q.moralVector.care, moral.care, n));
        q.moralVector.fairness            = int16(_avgInt(q.moralVector.fairness, moral.fairness, n));
        q.moralVector.loyalty             = int16(_avgInt(q.moralVector.loyalty, moral.loyalty, n));
        q.moralVector.authority           = int16(_avgInt(q.moralVector.authority, moral.authority, n));
        q.moralVector.sanctity            = int16(_avgInt(q.moralVector.sanctity, moral.sanctity, n));
        q.moralVector.liberty             = int16(_avgInt(q.moralVector.liberty, moral.liberty, n));
        q.moralVector.epistemicHumility   = int16(_avgInt(q.moralVector.epistemicHumility, moral.epistemicHumility, n));
        q.moralVector.temporalStewardship = int16(_avgInt(q.moralVector.temporalStewardship, moral.temporalStewardship, n));

        q.verifierCount++;

        // Reward verifier
        truthToken.mint(msg.sender, vetReward, "quantum-vet-v2");

        emit QuantumVerified(quantumId, msg.sender, scores, moral);
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
        TruthScores calldata counterScores,
        MoralVector calldata counterMoral
    ) external returns (uint256 forkId) {
        TruthQuantum storage q = quanta[quantumId];
        require(q.status == QuantumStatus.Active, "Not active");

        _validateTruthScores(counterScores);
        _validateMoralVector(counterMoral);

        q.status = QuantumStatus.Disputed;

        // Create fork quantum
        forkId = nextQuantumId++;

        TruthQuantum storage fork = quanta[forkId];
        fork.id = forkId;
        fork.host = msg.sender;
        fork.ipfsCid = counterCid;
        fork.discipline = q.discipline;
        fork.claim = claim;
        fork.truthScores = counterScores;
        fork.moralVector = counterMoral;
        fork.stakeAmount = minStake;
        fork.status = QuantumStatus.Active;
        fork.createdAt = block.timestamp;
        fork.verifierCount = 0;
        fork.erc8004AgentId = agentIdentities[msg.sender];

        // Slash original host (10%)
        truthToken.slash(q.host, 1000);
        // Reward challenger
        truthToken.mint(msg.sender, hostReward, "quantum-dispute-fork-v2");

        emit QuantumDisputed(quantumId, msg.sender, forkId);
    }

    // ──────────────────────────────────────────────
    //  Views
    // ──────────────────────────────────────────────

    /**
     * @notice Aggregate truth score (average of 4 frameworks).
     */
    function aggregateTruthScore(uint256 quantumId) external view returns (uint256) {
        TruthScores memory s = quanta[quantumId].truthScores;
        return (uint256(s.correspondence) + s.coherence + s.convergence + s.pragmatism) / 4;
    }

    /**
     * @notice Moral magnitude — euclidean-ish magnitude of the 8D moral vector.
     *         Returns sqrt(sum of squares) scaled by 100 for precision.
     *         Higher = more morally charged (regardless of direction).
     */
    function moralMagnitude(uint256 quantumId) external view returns (uint256) {
        MoralVector memory m = quanta[quantumId].moralVector;
        uint256 sumSquares =
            _sq(m.care) + _sq(m.fairness) + _sq(m.loyalty) + _sq(m.authority) +
            _sq(m.sanctity) + _sq(m.liberty) + _sq(m.epistemicHumility) + _sq(m.temporalStewardship);
        return _sqrt(sumSquares);
    }

    /**
     * @notice Get full quantum data.
     */
    function getQuantum(uint256 quantumId) external view returns (TruthQuantum memory) {
        return quanta[quantumId];
    }

    /**
     * @notice Get just the truth scores for a quantum.
     */
    function getTruthScores(uint256 quantumId) external view returns (TruthScores memory) {
        return quanta[quantumId].truthScores;
    }

    /**
     * @notice Get just the moral vector for a quantum.
     */
    function getMoralVector(uint256 quantumId) external view returns (MoralVector memory) {
        return quanta[quantumId].moralVector;
    }

    /**
     * @notice Check if quantum meets consensus threshold.
     */
    function meetsConsensus(uint256 quantumId) external view returns (bool) {
        TruthScores memory s = quanta[quantumId].truthScores;
        uint256 avg = (uint256(s.correspondence) + s.coherence + s.convergence + s.pragmatism) / 4;
        return avg >= CONSENSUS_THRESHOLD;
    }

    // ──────────────────────────────────────────────
    //  Internal: Averaging
    // ──────────────────────────────────────────────

    function _avgUint(uint16 current, uint16 incoming, uint256 n) internal pure returns (uint256) {
        return (uint256(current) * n + uint256(incoming)) / (n + 1);
    }

    function _avgInt(int16 current, int16 incoming, uint256 n) internal pure returns (int256) {
        return (int256(current) * int256(n) + int256(incoming)) / int256(n + 1);
    }

    // ──────────────────────────────────────────────
    //  Internal: Validation
    // ──────────────────────────────────────────────

    function _validateTruthScores(TruthScores calldata s) internal pure {
        require(
            s.correspondence <= MAX_TRUTH_SCORE &&
            s.coherence <= MAX_TRUTH_SCORE &&
            s.convergence <= MAX_TRUTH_SCORE &&
            s.pragmatism <= MAX_TRUTH_SCORE,
            "Truth score out of range"
        );
    }

    function _validateMoralVector(MoralVector calldata m) internal pure {
        require(
            m.care >= MIN_MORAL_SCORE && m.care <= MAX_MORAL_SCORE &&
            m.fairness >= MIN_MORAL_SCORE && m.fairness <= MAX_MORAL_SCORE &&
            m.loyalty >= MIN_MORAL_SCORE && m.loyalty <= MAX_MORAL_SCORE &&
            m.authority >= MIN_MORAL_SCORE && m.authority <= MAX_MORAL_SCORE &&
            m.sanctity >= MIN_MORAL_SCORE && m.sanctity <= MAX_MORAL_SCORE &&
            m.liberty >= MIN_MORAL_SCORE && m.liberty <= MAX_MORAL_SCORE &&
            m.epistemicHumility >= MIN_MORAL_SCORE && m.epistemicHumility <= MAX_MORAL_SCORE &&
            m.temporalStewardship >= MIN_MORAL_SCORE && m.temporalStewardship <= MAX_MORAL_SCORE,
            "Moral score out of range"
        );
    }

    // ──────────────────────────────────────────────
    //  Internal: Math
    // ──────────────────────────────────────────────

    function _sq(int16 x) internal pure returns (uint256) {
        int256 val = int256(x);
        return uint256(val * val);
    }

    /// @dev Integer square root (Babylonian method)
    function _sqrt(uint256 x) internal pure returns (uint256) {
        if (x == 0) return 0;
        uint256 z = (x + 1) / 2;
        uint256 y = x;
        while (z < y) {
            y = z;
            z = (x / z + z) / 2;
        }
        return y;
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
