export const TruthStakingABI = [
  // ── Views ──
  "function stakes(address user, bytes32 key) view returns (uint256)",
  "function locked(address user, bytes32 key) view returns (bool)",
  "function truthToken() view returns (address)",
  "function authorized(address) view returns (bool)",
  "function owner() view returns (address)",

  // ── Mutations ──
  "function stake(bytes32 key, uint256 amount)",
  "function unstake(bytes32 key)",
  "function lockStake(address user, bytes32 key)",
  "function unlockStake(address user, bytes32 key)",
  "function slash(address user, bytes32 key, uint256 bps)",
  "function transferStake(address from, bytes32 key, address to, uint256 amount)",
  "function refundStake(address user, bytes32 key)",
  "function authorize(address addr)",
  "function deauthorize(address addr)",
] as const;
