export const TruthRegistryV2ABI = [
  // ── Views ──
  "function nextQuantumId() view returns (uint256)",
  "function getQuantum(uint256 quantumId) view returns (tuple(uint256 id, address host, bytes32 ipfsCid, string discipline, string claim, tuple(uint16 correspondence, uint16 coherence, uint16 convergence, uint16 pragmatism) truthScores, tuple(int16 care, int16 fairness, int16 loyalty, int16 authority, int16 sanctity, int16 liberty, int16 epistemicHumility, int16 temporalStewardship) moralVector, uint256 stakeAmount, uint8 status, uint256 createdAt, uint256 verifierCount, bytes32 erc8004AgentId))",
  "function getTruthScores(uint256 quantumId) view returns (tuple(uint16 correspondence, uint16 coherence, uint16 convergence, uint16 pragmatism))",
  "function getMoralVector(uint256 quantumId) view returns (tuple(int16 care, int16 fairness, int16 loyalty, int16 authority, int16 sanctity, int16 liberty, int16 epistemicHumility, int16 temporalStewardship))",
  "function aggregateTruthScore(uint256 quantumId) view returns (uint256)",
  "function moralMagnitude(uint256 quantumId) view returns (uint256)",
  "function meetsConsensus(uint256 quantumId) view returns (bool)",
  "function hasVerified(uint256 quantumId, address verifier) view returns (bool)",
  "function agentIdentities(address wallet) view returns (bytes32)",
  "function owner() view returns (address)",
  "function hostReward() view returns (uint256)",
  "function vetReward() view returns (uint256)",
  "function minStake() view returns (uint256)",
  "function CONSENSUS_THRESHOLD() view returns (uint256)",

  // ── Mutations ──
  "function createQuantum(bytes32 ipfsCid, string discipline, string claim, tuple(uint16 correspondence, uint16 coherence, uint16 convergence, uint16 pragmatism) initialTruthScores, tuple(int16 care, int16 fairness, int16 loyalty, int16 authority, int16 sanctity, int16 liberty, int16 epistemicHumility, int16 temporalStewardship) initialMoralVector) returns (uint256 quantumId)",
  "function verify(uint256 quantumId, tuple(uint16 correspondence, uint16 coherence, uint16 convergence, uint16 pragmatism) scores, tuple(int16 care, int16 fairness, int16 loyalty, int16 authority, int16 sanctity, int16 liberty, int16 epistemicHumility, int16 temporalStewardship) moral)",
  "function dispute(uint256 quantumId, bytes32 counterCid, string claim, tuple(uint16 correspondence, uint16 coherence, uint16 convergence, uint16 pragmatism) counterScores, tuple(int16 care, int16 fairness, int16 loyalty, int16 authority, int16 sanctity, int16 liberty, int16 epistemicHumility, int16 temporalStewardship) counterMoral) returns (uint256 forkId)",
  "function linkAgentIdentity(bytes32 erc8004AgentId)",

  // ── Events ──
  "event QuantumCreated(uint256 indexed id, address indexed host, bytes32 ipfsCid, string discipline, bytes32 erc8004AgentId)",
  "event QuantumVerified(uint256 indexed id, address indexed verifier, tuple(uint16 correspondence, uint16 coherence, uint16 convergence, uint16 pragmatism) truthScores, tuple(int16 care, int16 fairness, int16 loyalty, int16 authority, int16 sanctity, int16 liberty, int16 epistemicHumility, int16 temporalStewardship) moralVector)",
  "event QuantumDisputed(uint256 indexed id, address indexed challenger, uint256 forkId)",
] as const;
