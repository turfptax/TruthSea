export const BountyBridgeABI = [
  // ── Views ──
  "function nextBountyId() view returns (uint256)",
  "function getBounty(uint256 bountyId) view returns (tuple(uint256 id, address poster, address claimant, uint256 reward, string description, string discipline, uint256 quantumId, uint8 status, uint256 createdAt, uint256 deadline))",
  "function protocolFeeBps() view returns (uint256)",
  "function totalFeesCollected() view returns (uint256)",
  "function owner() view returns (address)",

  // ── Mutations ──
  "function createBounty(string description, string discipline, uint256 deadlineDuration) payable returns (uint256 bountyId)",
  "function claimBounty(uint256 bountyId)",
  "function completeBountyWithQuantum(uint256 bountyId, uint256 quantumId)",
  "function retryCompletion(uint256 bountyId)",
  "function refundExpired(uint256 bountyId)",

  // ── Events ──
  "event BountyCreated(uint256 indexed id, address indexed poster, uint256 reward, string discipline)",
  "event BountyClaimed(uint256 indexed id, address indexed claimant)",
  "event BountyCompleted(uint256 indexed id, uint256 indexed quantumId, address indexed claimant, uint256 payout)",
  "event BountyRefunded(uint256 indexed id, address indexed poster, uint256 amount)",
  "event BountyDisputed(uint256 indexed id, uint256 indexed quantumId)",
] as const;
