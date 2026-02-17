require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

const PRIVATE_KEY    = process.env.DEPLOYER_PRIVATE_KEY || "0x" + "0".repeat(64);
const AMOY_RPC       = process.env.AMOY_RPC_URL || "https://rpc-amoy.polygon.technology";
const POLYGONSCAN    = process.env.POLYGONSCAN_API_KEY || "";
const BASE_SEP_RPC   = process.env.BASE_SEPOLIA_RPC_URL || "https://sepolia.base.org";
const BASE_RPC       = process.env.BASE_RPC_URL || "https://mainnet.base.org";
const BASESCAN       = process.env.BASESCAN_API_KEY || "";

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.20",
    settings: { optimizer: { enabled: true, runs: 200 } },
  },
  networks: {
    hardhat: {},
    amoy: {
      url: AMOY_RPC,
      accounts: [PRIVATE_KEY],
      chainId: 80002,
    },
    base_sepolia: {
      url: BASE_SEP_RPC,
      accounts: [PRIVATE_KEY],
      chainId: 84532,
    },
    base: {
      url: BASE_RPC,
      accounts: [PRIVATE_KEY],
      chainId: 8453,
    },
  },
  etherscan: {
    // Etherscan V2 API — single key for all chains
    apiKey: BASESCAN,
    customChains: [
      {
        network: "polygonAmoy",
        chainId: 80002,
        urls: {
          apiURL: "https://api-amoy.polygonscan.com/api",
          browserURL: "https://amoy.polygonscan.com",
        },
      },
      {
        network: "base_sepolia",
        chainId: 84532,
        urls: {
          apiURL: "https://api-sepolia.basescan.org/api",
          browserURL: "https://sepolia.basescan.org",
        },
      },
      {
        network: "base",
        chainId: 8453,
        urls: {
          apiURL: "https://api.basescan.org/api",
          browserURL: "https://basescan.org",
        },
      },
    ],
  },
  sourcify: {
    enabled: false,
  },
};
