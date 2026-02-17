/**
 * Chain connection — ethers.js provider + contract instances
 */

import { ethers } from "ethers";

// ── ABI fragments (human-readable) ──

const REGISTRY_ABI = [
  "function nextQuantumId() view returns (uint256)",
  "function getQuantum(uint256) view returns (tuple(uint256 id, address host, string ipfsCid, string discipline, string claim, tuple(uint256 correspondence, uint256 coherence, uint256 convergence, uint256 pragmatism) truthScores, tuple(int256 care, int256 fairness, int256 loyalty, int256 authority, int256 sanctity, int256 liberty, int256 epistemicHumility, int256 temporalStewardship) moralVector, uint256 stakeAmount, uint8 status, uint256 createdAt, uint256 verifierCount, bytes32 erc8004AgentId))",
  "function meetsConsensus(uint256) view returns (bool)",
  "function aggregateTruthScore(uint256) view returns (uint256)",
  "function moralMagnitude(uint256) view returns (uint256)",
  "event QuantumCreated(uint256 indexed id, address indexed host, string discipline, string claim)",
  "event QuantumVerified(uint256 indexed id, address indexed verifier)",
  "event QuantumDisputed(uint256 indexed id, address indexed challenger)",
  "event AgentLinked(address indexed wallet, bytes32 indexed agentId)",
];

const BOUNTY_ABI = [
  "function nextBountyId() view returns (uint256)",
  "function getBounty(uint256) view returns (tuple(uint256 id, address poster, address claimant, uint256 reward, string description, string discipline, uint256 quantumId, uint8 status, uint256 createdAt, uint256 deadline))",
  "event BountyCreated(uint256 indexed id, address indexed poster, uint256 reward, string discipline)",
  "event BountyClaimed(uint256 indexed id, address indexed claimant)",
  "event BountyCompleted(uint256 indexed id, uint256 indexed quantumId, address indexed claimant, uint256 payout)",
  "event BountyRefunded(uint256 indexed id, address indexed poster, uint256 amount)",
  "event BountyDisputed(uint256 indexed id, uint256 indexed quantumId)",
];

// ── Config ──

const RPC_URL = process.env.BASE_SEPOLIA_RPC_URL || "https://sepolia.base.org";
const REGISTRY_ADDR = process.env.BASE_SEPOLIA_REGISTRY_V2 || "0xbEE32455c12002b32bE654c8E70E876Fd557d653";
const BOUNTY_ADDR = process.env.BASE_SEPOLIA_BOUNTY_BRIDGE || "0xA255A98F2D497c47a7068c4D1ad1C1968f88E0C5";

// ── Instances ──

export const provider = new ethers.JsonRpcProvider(RPC_URL);
export const registry = new ethers.Contract(REGISTRY_ADDR, REGISTRY_ABI, provider);
export const bountyBridge = new ethers.Contract(BOUNTY_ADDR, BOUNTY_ABI, provider);

export { REGISTRY_ABI, BOUNTY_ABI, REGISTRY_ADDR, BOUNTY_ADDR };
