// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./ITruthRegistryV2.sol";

/**
 * @title TruthDAG
 * @notice On-chain directed acyclic graph of epistemological dependencies between
 *         truth quanta. Companion to TruthRegistryV2 — reads quantum data via
 *         interface calls, manages edges and propagated chain scores.
 *
 *         Chain Score Formula (from SCORING_RUBRIC.md):
 *           chainScore = intrinsicScore * (floor + damping * weakestDepChainScore / 10000)
 *
 *         Where:
 *           intrinsicScore = aggregateTruthScore from the registry (0-10000)
 *           floor          = 3000 (0.30 in basis points)
 *           damping        = 7000 (0.70 in basis points)
 *
 *         Contradiction penalty:
 *           chainScore *= max(contradictionFloor, 10000 - contradictionCount * contradictionPenalty)
 *
 * @dev    Edges are declared between existing quanta on the registry.
 *         Cycle detection uses bounded DFS (max depth 20).
 *         Propagation is explicit — callers trigger it, earning a gas subsidy.
 */

interface ITruthToken {
    function mint(address to, uint256 amount, string calldata reason) external;
    function slash(address from, uint256 bps) external;
}

interface ITruthStaking {
    function stakes(address user, bytes32 key) external view returns (uint256);
    function lockStake(address user, bytes32 key) external;
    function unlockStake(address user, bytes32 key) external;
    function slash(address user, bytes32 key, uint256 bps) external;
    function transferStake(address from, bytes32 key, address to, uint256 amount) external;
    function refundStake(address user, bytes32 key) external;
}

contract TruthDAG {
    // ──────────────────────────────────────────────
    //  Types
    // ──────────────────────────────────────────────

    enum EdgeType { Depends, Supports, Contradicts }
    enum EdgeStatus { Active, Disputed, Invalidated, Removed }

    struct Edge {
        uint256 id;
        uint256 sourceQuantumId;   // the dependency (depended-upon quantum)
        uint256 targetQuantumId;   // the dependent quantum
        EdgeType edgeType;
        EdgeStatus status;
        address proposer;
        bytes32 evidenceCid;       // IPFS CID for edge justification
        uint256 stakeAmount;       // TRUTH staked via TruthStaking
        uint16 confidence;         // 0-10000: strength of this inferential link
        uint256 createdAt;
    }

    struct PropagatedScore {
        uint16 chainScore;         // 0-10000
        uint16 weakestLinkScore;   // score of weakest dependency edge
        uint256 weakestLinkEdgeId; // which edge is the bottleneck
        uint256 lastUpdated;       // block.timestamp
        uint8 depth;               // 0 = axiom (no Depends edges)
    }

    struct WeakLinkFlagData {
        address flagger;
        uint256 flaggedAt;
        bool resolved;
        bool rewarded;
    }

    // ──────────────────────────────────────────────
    //  State
    // ──────────────────────────────────────────────

    ITruthRegistryV2 public registry;
    ITruthToken public truthToken;
    ITruthStaking public staking;
    address public owner;

    uint256 public nextEdgeId;
    mapping(uint256 => Edge) public edges;

    // Adjacency lists
    mapping(uint256 => uint256[]) public outgoingEdges;  // quantum -> edge IDs where quantum is target (its dependencies)
    mapping(uint256 => uint256[]) public incomingEdges;   // quantum -> edge IDs where quantum is source (its dependents)

    // Propagated scores
    mapping(uint256 => PropagatedScore) public propagatedScores;

    // Deduplication: keccak256(source, target, type) => exists
    mapping(bytes32 => bool) public edgeExists;

    // Weak link flags: edgeId -> flag data
    mapping(uint256 => WeakLinkFlagData[]) public weakLinkFlags;

    // ── Configuration ──

    uint256 public minEdgeStake = 10 ether;         // TRUTH required to propose an edge
    uint16 public propagationFloor = 3000;           // 0.30 in basis points
    uint16 public propagationDamping = 7000;         // 0.70 in basis points
    uint16 public contradictionPenalty = 1500;        // 0.15 per contradiction
    uint16 public contradictionFloor = 4000;          // min 0.40 after contradictions
    uint256 public weakLinkRewardWindow = 30 days;    // flag must precede invalidation by this
    uint256 public edgeMaturityPeriod = 7 days;       // edge must survive this long for proposer reward
    uint256 public propagationReward = 2 ether;       // TRUTH gas subsidy for propagation trigger
    uint256 public edgeSurvivalReward = 20 ether;     // TRUTH for edge surviving maturity
    uint256 public weakLinkBounty = 100 ether;        // TRUTH for validated weak-link flag
    uint8 public constant MAX_CYCLE_CHECK_DEPTH = 20;

    // Intrinsic score weights (basis points, must sum to 10000)
    uint16 public weightCorrespondence = 3000; // 30%
    uint16 public weightCoherence = 2500;      // 25%
    uint16 public weightConvergence = 2500;    // 25%
    uint16 public weightPragmatism = 2000;     // 20%

    // Track edge maturity claims
    mapping(uint256 => bool) public edgeRewardClaimed;

    // ──────────────────────────────────────────────
    //  Events
    // ──────────────────────────────────────────────

    event EdgeCreated(
        uint256 indexed edgeId,
        uint256 indexed sourceQuantumId,
        uint256 indexed targetQuantumId,
        EdgeType edgeType,
        address proposer
    );
    event EdgeDisputed(uint256 indexed edgeId, address indexed challenger);
    event EdgeInvalidated(uint256 indexed edgeId);
    event EdgeRemoved(uint256 indexed edgeId);
    event ScorePropagated(
        uint256 indexed quantumId,
        uint16 chainScore,
        uint16 weakestLinkScore,
        uint8 depth
    );
    event WeakLinkFlagged(uint256 indexed edgeId, address indexed flagger);
    event WeakLinkRewarded(uint256 indexed edgeId, address indexed flagger, uint256 reward);

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

    constructor(address _registry, address _truthToken, address _staking) {
        registry = ITruthRegistryV2(_registry);
        truthToken = ITruthToken(_truthToken);
        staking = ITruthStaking(_staking);
        owner = msg.sender;
    }

    // ──────────────────────────────────────────────
    //  Edge Management
    // ──────────────────────────────────────────────

    /**
     * @notice Declare a dependency between two quanta.
     * @param sourceQuantumId The quantum being depended upon
     * @param targetQuantumId The quantum that depends on the source
     * @param edgeType        Depends, Supports, or Contradicts
     * @param evidenceCid     IPFS CID justifying this edge
     * @param confidence      Strength of this link (0-10000)
     * @return edgeId         The ID of the created edge
     */
    function createEdge(
        uint256 sourceQuantumId,
        uint256 targetQuantumId,
        EdgeType edgeType,
        bytes32 evidenceCid,
        uint16 confidence
    ) external returns (uint256 edgeId) {
        require(sourceQuantumId != targetQuantumId, "Self-reference");
        require(confidence <= 10000, "Confidence out of range");

        // Verify both quanta exist on the registry
        uint256 nextQId = registry.nextQuantumId();
        require(sourceQuantumId < nextQId, "Source quantum does not exist");
        require(targetQuantumId < nextQId, "Target quantum does not exist");

        // Check for duplicate edge
        bytes32 edgeKey = keccak256(abi.encode(sourceQuantumId, targetQuantumId, edgeType));
        require(!edgeExists[edgeKey], "Edge already exists");

        // Cycle detection for Depends edges (Supports/Contradicts don't create dependency cycles)
        // Adding edge: target depends on source. Cycle if source already depends on target.
        // So start DFS at source, walk its dependencies, look for target.
        if (edgeType == EdgeType.Depends) {
            require(_isAcyclic(targetQuantumId, sourceQuantumId, 0), "Would create cycle");
        }

        // Verify proposer has staked enough via TruthStaking
        bytes32 stakeKey = _edgeStakeKey(nextEdgeId);
        uint256 stakedAmount = staking.stakes(msg.sender, stakeKey);
        require(stakedAmount >= minEdgeStake, "Insufficient stake");

        // Lock the stake
        staking.lockStake(msg.sender, stakeKey);

        // Create edge
        edgeId = nextEdgeId++;
        edges[edgeId] = Edge({
            id: edgeId,
            sourceQuantumId: sourceQuantumId,
            targetQuantumId: targetQuantumId,
            edgeType: edgeType,
            status: EdgeStatus.Active,
            proposer: msg.sender,
            evidenceCid: evidenceCid,
            stakeAmount: stakedAmount,
            confidence: confidence,
            createdAt: block.timestamp
        });

        edgeExists[edgeKey] = true;

        // Update adjacency lists
        // outgoingEdges[target] = edges representing target's dependencies
        outgoingEdges[targetQuantumId].push(edgeId);
        // incomingEdges[source] = edges where source is depended upon
        incomingEdges[sourceQuantumId].push(edgeId);

        emit EdgeCreated(edgeId, sourceQuantumId, targetQuantumId, edgeType, msg.sender);
    }

    /**
     * @notice Remove an edge. Only the proposer can remove their own edge.
     *         Refunds the stake if edge is not disputed.
     */
    function removeEdge(uint256 edgeId) external {
        Edge storage edge = edges[edgeId];
        require(edge.proposer == msg.sender, "Not proposer");
        require(edge.status == EdgeStatus.Active, "Not active");

        edge.status = EdgeStatus.Removed;

        // Clear dedup key
        bytes32 edgeKey = keccak256(abi.encode(edge.sourceQuantumId, edge.targetQuantumId, edge.edgeType));
        edgeExists[edgeKey] = false;

        // Refund stake
        bytes32 stakeKey = _edgeStakeKey(edgeId);
        staking.refundStake(msg.sender, stakeKey);

        emit EdgeRemoved(edgeId);
    }

    /**
     * @notice Dispute an edge. Marks the edge as Disputed, slashes the
     *         edge proposer's stake, and rewards the challenger.
     *         The challenger should create their own counter-quantum
     *         separately via the registry if desired.
     * @param edgeId Edge to dispute
     */
    function disputeEdge(uint256 edgeId) external {
        Edge storage edge = edges[edgeId];
        require(edge.status == EdgeStatus.Active, "Edge not active");
        require(edge.proposer != msg.sender, "Cannot dispute own edge");

        // Mark edge as disputed
        edge.status = EdgeStatus.Disputed;

        // Slash edge proposer 10% via staking
        bytes32 stakeKey = _edgeStakeKey(edgeId);
        staking.slash(edge.proposer, stakeKey, 1000);

        // Transfer 60% of remaining stake to challenger
        uint256 remainingStake = staking.stakes(edge.proposer, stakeKey);
        uint256 challengerReward = (remainingStake * 6000) / 10000;
        if (challengerReward > 0) {
            staking.transferStake(edge.proposer, stakeKey, msg.sender, challengerReward);
        }

        // Reward challenger with TRUTH
        truthToken.mint(msg.sender, edgeSurvivalReward, "edge-dispute-win");

        // Check and reward any weak-link flags
        _processWeakLinkRewards(edgeId);

        emit EdgeDisputed(edgeId, msg.sender);
    }

    /**
     * @notice Invalidate an edge (admin/governance function).
     *         In production, this would be triggered by resolution logic.
     */
    function invalidateEdge(uint256 edgeId) external onlyOwner {
        Edge storage edge = edges[edgeId];
        require(edge.status == EdgeStatus.Active || edge.status == EdgeStatus.Disputed, "Cannot invalidate");

        edge.status = EdgeStatus.Invalidated;

        // Clear dedup so a corrected edge can be created
        bytes32 edgeKey = keccak256(abi.encode(edge.sourceQuantumId, edge.targetQuantumId, edge.edgeType));
        edgeExists[edgeKey] = false;

        _processWeakLinkRewards(edgeId);

        emit EdgeInvalidated(edgeId);
    }

    /**
     * @notice Claim the edge survival reward after the maturity period.
     */
    function claimEdgeReward(uint256 edgeId) external {
        Edge storage edge = edges[edgeId];
        require(edge.proposer == msg.sender, "Not proposer");
        require(edge.status == EdgeStatus.Active, "Not active");
        require(block.timestamp >= edge.createdAt + edgeMaturityPeriod, "Not mature");
        require(!edgeRewardClaimed[edgeId], "Already claimed");

        edgeRewardClaimed[edgeId] = true;
        truthToken.mint(msg.sender, edgeSurvivalReward, "edge-survival");
    }

    // ──────────────────────────────────────────────
    //  Score Propagation
    // ──────────────────────────────────────────────

    /**
     * @notice Propagate the chain score for a single quantum.
     *         Reads the quantum's intrinsic score from the registry,
     *         finds its dependencies (outgoing Depends edges), and computes:
     *
     *         If no dependencies (axiom):
     *           chainScore = intrinsicScore
     *
     *         If has dependencies:
     *           chainScore = intrinsicScore * (floor + damping * weakestDepChainScore / 10000) / 10000
     *
     *         Contradiction penalty applied after:
     *           chainScore = chainScore * max(contradictionFloor, 10000 - count * contradictionPenalty) / 10000
     *
     * @param quantumId The quantum to propagate
     */
    function propagateScore(uint256 quantumId) public {
        // Compute intrinsic score from registry (weighted average of 4 frameworks)
        ITruthRegistryV2.TruthQuantum memory q = registry.getQuantum(quantumId);
        uint256 intrinsic = (
            uint256(q.truthScores.correspondence) * weightCorrespondence +
            uint256(q.truthScores.coherence) * weightCoherence +
            uint256(q.truthScores.convergence) * weightConvergence +
            uint256(q.truthScores.pragmatism) * weightPragmatism
        ) / 10000;

        // Find dependencies and contradictions from outgoing edges
        uint256[] storage outEdges = outgoingEdges[quantumId];
        uint16 weakestScore = 10000; // max
        uint256 weakestEdgeId = 0;
        uint8 depCount = 0;
        uint8 contradictionCount = 0;

        for (uint256 i = 0; i < outEdges.length; i++) {
            Edge storage e = edges[outEdges[i]];
            if (e.status != EdgeStatus.Active) continue;

            if (e.edgeType == EdgeType.Depends) {
                depCount++;
                // Get the chain score of the dependency
                PropagatedScore storage depScore = propagatedScores[e.sourceQuantumId];
                uint16 depChainScore = depScore.chainScore;

                // Factor in edge confidence: effective = min(depChainScore, edge.confidence)
                uint16 effective = depChainScore < e.confidence ? depChainScore : e.confidence;

                if (effective < weakestScore) {
                    weakestScore = effective;
                    weakestEdgeId = e.id;
                }
            } else if (e.edgeType == EdgeType.Contradicts) {
                contradictionCount++;
            }
        }

        uint16 chainScore;
        uint8 depth = 0;

        if (depCount == 0) {
            // Axiom: no dependencies, chain score equals intrinsic
            chainScore = uint16(intrinsic);
        } else {
            // Attenuate by weakest dependency
            // chainScore = intrinsic * (floor + damping * weakestScore / 10000) / 10000
            uint256 factor = uint256(propagationFloor) + (uint256(propagationDamping) * uint256(weakestScore)) / 10000;
            chainScore = uint16((intrinsic * factor) / 10000);

            // Depth = max dependency depth + 1
            for (uint256 i = 0; i < outEdges.length; i++) {
                Edge storage e = edges[outEdges[i]];
                if (e.status != EdgeStatus.Active || e.edgeType != EdgeType.Depends) continue;
                uint8 depDepth = propagatedScores[e.sourceQuantumId].depth;
                if (depDepth + 1 > depth) {
                    depth = depDepth + 1;
                }
            }
        }

        // Apply contradiction penalty
        if (contradictionCount > 0) {
            uint256 penalty = uint256(contradictionCount) * uint256(contradictionPenalty);
            uint256 multiplier = 10000 > penalty ? 10000 - penalty : uint256(contradictionFloor);
            if (multiplier < uint256(contradictionFloor)) {
                multiplier = uint256(contradictionFloor);
            }
            chainScore = uint16((uint256(chainScore) * multiplier) / 10000);
        }

        // Store
        propagatedScores[quantumId] = PropagatedScore({
            chainScore: chainScore,
            weakestLinkScore: depCount > 0 ? weakestScore : uint16(intrinsic),
            weakestLinkEdgeId: weakestEdgeId,
            lastUpdated: block.timestamp,
            depth: depth
        });

        // Reward the propagation trigger
        truthToken.mint(msg.sender, propagationReward, "propagation-trigger");

        emit ScorePropagated(quantumId, chainScore, depCount > 0 ? weakestScore : uint16(intrinsic), depth);
    }

    /**
     * @notice Batch propagation. Caller must provide IDs in bottom-up order
     *         (axioms first, then layer 1, layer 2, etc.).
     */
    function batchPropagateScores(uint256[] calldata quantumIds) external {
        for (uint256 i = 0; i < quantumIds.length; i++) {
            propagateScore(quantumIds[i]);
        }
    }

    // ──────────────────────────────────────────────
    //  Weak Link Flagging
    // ──────────────────────────────────────────────

    /**
     * @notice Flag an edge as potentially weak. If the edge is later
     *         invalidated within the reward window, the flagger earns a bounty.
     */
    function flagWeakLink(uint256 edgeId) external {
        Edge storage edge = edges[edgeId];
        require(edge.status == EdgeStatus.Active, "Edge not active");

        weakLinkFlags[edgeId].push(WeakLinkFlagData({
            flagger: msg.sender,
            flaggedAt: block.timestamp,
            resolved: false,
            rewarded: false
        }));

        emit WeakLinkFlagged(edgeId, msg.sender);
    }

    // ──────────────────────────────────────────────
    //  Views
    // ──────────────────────────────────────────────

    function getEdge(uint256 edgeId) external view returns (Edge memory) {
        return edges[edgeId];
    }

    function getOutgoingEdges(uint256 quantumId) external view returns (uint256[] memory) {
        return outgoingEdges[quantumId];
    }

    function getIncomingEdges(uint256 quantumId) external view returns (uint256[] memory) {
        return incomingEdges[quantumId];
    }

    function getChainScore(uint256 quantumId) external view returns (PropagatedScore memory) {
        return propagatedScores[quantumId];
    }

    function getWeakLinkFlags(uint256 edgeId) external view returns (WeakLinkFlagData[] memory) {
        return weakLinkFlags[edgeId];
    }

    /**
     * @notice Check if adding a Depends edge (target depends on source) would create a cycle.
     *         Returns true if acyclic (safe to add), false if cycle detected.
     */
    function isAcyclic(uint256 sourceQuantumId, uint256 targetQuantumId) external view returns (bool) {
        // Cycle if source already depends on target, so start at source looking for target
        return _isAcyclic(targetQuantumId, sourceQuantumId, 0);
    }

    function getEdgeCount() external view returns (uint256) {
        return nextEdgeId;
    }

    // ──────────────────────────────────────────────
    //  Internal
    // ──────────────────────────────────────────────

    /**
     * @dev Bounded DFS from sourceQuantumId through Depends edges.
     *      Returns true if targetQuantumId is NOT reachable (acyclic).
     *      Adding an edge source->target means target depends on source.
     *      A cycle exists if source is reachable from target via existing Depends edges.
     */
    function _isAcyclic(
        uint256 sourceQuantumId,
        uint256 currentNode,
        uint8 depth
    ) internal view returns (bool) {
        if (depth >= MAX_CYCLE_CHECK_DEPTH) return true; // bounded, assume safe

        // Check outgoing edges of currentNode (its dependencies)
        uint256[] storage outs = outgoingEdges[currentNode];
        for (uint256 i = 0; i < outs.length; i++) {
            Edge storage e = edges[outs[i]];
            if (e.status != EdgeStatus.Active || e.edgeType != EdgeType.Depends) continue;

            // e.sourceQuantumId is what currentNode depends on
            if (e.sourceQuantumId == sourceQuantumId) return false; // cycle!

            if (!_isAcyclic(sourceQuantumId, e.sourceQuantumId, depth + 1)) {
                return false;
            }
        }
        return true;
    }

    /**
     * @dev Compute the stake key for an edge.
     */
    function _edgeStakeKey(uint256 edgeId) internal pure returns (bytes32) {
        return keccak256(abi.encode("edge", edgeId));
    }

    /**
     * @dev Process weak-link flag rewards when an edge is invalidated or disputed.
     */
    function _processWeakLinkRewards(uint256 edgeId) internal {
        WeakLinkFlagData[] storage flags = weakLinkFlags[edgeId];
        for (uint256 i = 0; i < flags.length; i++) {
            if (flags[i].resolved) continue;
            flags[i].resolved = true;

            // Check if flag was within the reward window
            if (block.timestamp <= flags[i].flaggedAt + weakLinkRewardWindow) {
                flags[i].rewarded = true;
                truthToken.mint(flags[i].flagger, weakLinkBounty, "weak-link-bounty");
                emit WeakLinkRewarded(edgeId, flags[i].flagger, weakLinkBounty);
            }
        }
    }

    // ──────────────────────────────────────────────
    //  Admin
    // ──────────────────────────────────────────────

    function setConfig(
        uint256 _minEdgeStake,
        uint16 _propagationFloor,
        uint16 _propagationDamping,
        uint16 _contradictionPenalty,
        uint16 _contradictionFloor,
        uint256 _weakLinkRewardWindow,
        uint256 _edgeMaturityPeriod,
        uint256 _propagationReward,
        uint256 _edgeSurvivalReward,
        uint256 _weakLinkBounty
    ) external onlyOwner {
        minEdgeStake = _minEdgeStake;
        propagationFloor = _propagationFloor;
        propagationDamping = _propagationDamping;
        contradictionPenalty = _contradictionPenalty;
        contradictionFloor = _contradictionFloor;
        weakLinkRewardWindow = _weakLinkRewardWindow;
        edgeMaturityPeriod = _edgeMaturityPeriod;
        propagationReward = _propagationReward;
        edgeSurvivalReward = _edgeSurvivalReward;
        weakLinkBounty = _weakLinkBounty;
    }

    function setWeights(
        uint16 _correspondence,
        uint16 _coherence,
        uint16 _convergence,
        uint16 _pragmatism
    ) external onlyOwner {
        require(
            uint256(_correspondence) + _coherence + _convergence + _pragmatism == 10000,
            "Weights must sum to 10000"
        );
        weightCorrespondence = _correspondence;
        weightCoherence = _coherence;
        weightConvergence = _convergence;
        weightPragmatism = _pragmatism;
    }

    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "Zero address");
        owner = newOwner;
    }
}
