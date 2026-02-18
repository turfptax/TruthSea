export const TruthDAGABI = [
  // ── Views ──
  "function nextEdgeId() view returns (uint256)",
  "function getEdge(uint256 edgeId) view returns (tuple(uint256 id, uint256 sourceQuantumId, uint256 targetQuantumId, uint8 edgeType, uint8 status, address proposer, bytes32 evidenceCid, uint256 stakeAmount, uint16 confidence, uint256 createdAt))",
  "function getOutgoingEdges(uint256 quantumId) view returns (uint256[])",
  "function getIncomingEdges(uint256 quantumId) view returns (uint256[])",
  "function getChainScore(uint256 quantumId) view returns (tuple(uint16 chainScore, uint16 weakestLinkScore, uint256 weakestLinkEdgeId, uint256 lastUpdated, uint8 depth))",
  "function getWeakLinkFlags(uint256 edgeId) view returns (tuple(address flagger, uint256 flaggedAt, bool resolved, bool rewarded)[])",
  "function isAcyclic(uint256 sourceQuantumId, uint256 targetQuantumId) view returns (bool)",
  "function getEdgeCount() view returns (uint256)",
  "function edgeExists(bytes32 key) view returns (bool)",
  "function edgeRewardClaimed(uint256 edgeId) view returns (bool)",
  "function minEdgeStake() view returns (uint256)",
  "function propagationFloor() view returns (uint16)",
  "function propagationDamping() view returns (uint16)",
  "function contradictionPenalty() view returns (uint16)",
  "function contradictionFloor() view returns (uint16)",

  // ── Mutations ──
  "function createEdge(uint256 sourceQuantumId, uint256 targetQuantumId, uint8 edgeType, bytes32 evidenceCid, uint16 confidence) returns (uint256 edgeId)",
  "function removeEdge(uint256 edgeId)",
  "function disputeEdge(uint256 edgeId)",
  "function propagateScore(uint256 quantumId)",
  "function batchPropagateScores(uint256[] quantumIds)",
  "function flagWeakLink(uint256 edgeId)",
  "function claimEdgeReward(uint256 edgeId)",

  // ── Events ──
  "event EdgeCreated(uint256 indexed edgeId, uint256 indexed sourceQuantumId, uint256 indexed targetQuantumId, uint8 edgeType, address proposer)",
  "event EdgeDisputed(uint256 indexed edgeId, address indexed challenger)",
  "event EdgeInvalidated(uint256 indexed edgeId)",
  "event EdgeRemoved(uint256 indexed edgeId)",
  "event ScorePropagated(uint256 indexed quantumId, uint16 chainScore, uint16 weakestLinkScore, uint8 depth)",
  "event WeakLinkFlagged(uint256 indexed edgeId, address indexed flagger)",
  "event WeakLinkRewarded(uint256 indexed edgeId, address indexed flagger, uint256 reward)",
] as const;
