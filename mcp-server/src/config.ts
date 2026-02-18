/**
 * TruthSea MCP Server — Configuration
 *
 * Network configs and contract addresses.
 * Override with environment variables.
 */

export interface NetworkConfig {
  rpcUrl: string;
  chainId: number;
  registryAddress: string;
  bountyBridgeAddress: string;
  truthTokenAddress: string;
  truthDAGAddress: string;
  truthStakingAddress: string;
  explorerUrl: string;
}

export const NETWORKS: Record<string, NetworkConfig> = {
  base_sepolia: {
    rpcUrl: process.env.BASE_SEPOLIA_RPC_URL || "https://sepolia.base.org",
    chainId: 84532,
    registryAddress:
      process.env.BASE_SEPOLIA_REGISTRY_V2 ||
      "0xbEE32455c12002b32bE654c8E70E876Fd557d653",
    bountyBridgeAddress:
      process.env.BASE_SEPOLIA_BOUNTY_BRIDGE ||
      "0xA255A98F2D497c47a7068c4D1ad1C1968f88E0C5",
    truthTokenAddress:
      process.env.BASE_SEPOLIA_TRUTH_TOKEN ||
      "0x18D825cE88089beFC99B0e293f39318D992FA07D",
    truthDAGAddress:
      process.env.BASE_SEPOLIA_TRUTH_DAG || "",
    truthStakingAddress:
      process.env.BASE_SEPOLIA_TRUTH_STAKING || "",
    explorerUrl: "https://sepolia.basescan.org",
  },
  base: {
    rpcUrl: process.env.BASE_RPC_URL || "https://mainnet.base.org",
    chainId: 8453,
    registryAddress: process.env.BASE_REGISTRY_V2 || "",
    bountyBridgeAddress: process.env.BASE_BOUNTY_BRIDGE || "",
    truthTokenAddress: process.env.BASE_TRUTH_TOKEN || "",
    truthDAGAddress: process.env.BASE_TRUTH_DAG || "",
    truthStakingAddress: process.env.BASE_TRUTH_STAKING || "",
    explorerUrl: "https://basescan.org",
  },
};

export function getNetworkConfig(): NetworkConfig {
  const network = process.env.TRUTHSEA_NETWORK || "base_sepolia";
  const config = NETWORKS[network];
  if (!config) {
    throw new Error(
      `Unknown network: ${network}. Available: ${Object.keys(NETWORKS).join(", ")}`
    );
  }
  return config;
}
