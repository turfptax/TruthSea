/**
 * TruthSea MCP Server — Contract Connections
 *
 * Initializes ethers.js providers and contract instances.
 * Supports both read-only (no private key) and write mode.
 */

import { ethers } from "ethers";
import { getNetworkConfig } from "./config.js";
import { TruthRegistryV2ABI } from "./abis/TruthRegistryV2.js";
import { BountyBridgeABI } from "./abis/BountyBridge.js";
import { TruthDAGABI } from "./abis/TruthDAG.js";
import { TruthStakingABI } from "./abis/TruthStaking.js";

let provider: ethers.JsonRpcProvider;
let signer: ethers.Wallet | null = null;
let registry: ethers.Contract;
let bountyBridge: ethers.Contract;
let truthDAG: ethers.Contract | null = null;
let truthStaking: ethers.Contract | null = null;

export function initContracts() {
  const config = getNetworkConfig();

  provider = new ethers.JsonRpcProvider(config.rpcUrl, {
    name: config.chainId.toString(),
    chainId: config.chainId,
  });

  // If private key available, enable write operations
  const pk = process.env.DEPLOYER_PRIVATE_KEY;
  if (pk) {
    signer = new ethers.Wallet(pk, provider);
  }

  const signerOrProvider = signer || provider;

  registry = new ethers.Contract(
    config.registryAddress,
    TruthRegistryV2ABI,
    signerOrProvider
  );

  bountyBridge = new ethers.Contract(
    config.bountyBridgeAddress,
    BountyBridgeABI,
    signerOrProvider
  );

  // V2: TruthDAG and TruthStaking (optional — only if addresses configured)
  if (config.truthDAGAddress) {
    truthDAG = new ethers.Contract(
      config.truthDAGAddress,
      TruthDAGABI,
      signerOrProvider
    );
  }

  if (config.truthStakingAddress) {
    truthStaking = new ethers.Contract(
      config.truthStakingAddress,
      TruthStakingABI,
      signerOrProvider
    );
  }
}

export function getProvider() {
  return provider;
}

export function getSigner() {
  if (!signer) throw new Error("No private key configured — read-only mode");
  return signer;
}

export function getRegistry() {
  return registry;
}

export function getBountyBridge() {
  return bountyBridge;
}

export function getDAG() {
  if (!truthDAG) throw new Error("TruthDAG not configured — set BASE_SEPOLIA_TRUTH_DAG");
  return truthDAG;
}

export function getStaking() {
  if (!truthStaking) throw new Error("TruthStaking not configured — set BASE_SEPOLIA_TRUTH_STAKING");
  return truthStaking;
}

export function hasDAG(): boolean {
  return truthDAG !== null;
}

export function hasSigner(): boolean {
  return signer !== null;
}

// ── Helper: Format quantum data from contract to JSON-friendly object ──

export interface QuantumData {
  id: number;
  host: string;
  ipfsCid: string;
  discipline: string;
  claim: string;
  truthScores: {
    correspondence: number;
    coherence: number;
    convergence: number;
    pragmatism: number;
    aggregate: number;
  };
  moralVector: {
    care: number;
    fairness: number;
    loyalty: number;
    authority: number;
    sanctity: number;
    liberty: number;
    epistemicHumility: number;
    temporalStewardship: number;
  };
  stakeAmount: string;
  status: string;
  createdAt: number;
  verifierCount: number;
  erc8004AgentId: string;
  meetsConsensus: boolean;
}

const STATUS_NAMES = ["Active", "Disputed", "Archived", "Forked"];

export function formatQuantum(raw: any, consensus: boolean): QuantumData {
  const ts = raw.truthScores;
  const mv = raw.moralVector;
  const corr = Number(ts.correspondence);
  const coh = Number(ts.coherence);
  const conv = Number(ts.convergence);
  const prag = Number(ts.pragmatism);

  return {
    id: Number(raw.id),
    host: raw.host,
    ipfsCid: raw.ipfsCid,
    discipline: raw.discipline,
    claim: raw.claim,
    truthScores: {
      correspondence: corr / 100,
      coherence: coh / 100,
      convergence: conv / 100,
      pragmatism: prag / 100,
      aggregate: (corr + coh + conv + prag) / 400,
    },
    moralVector: {
      care: Number(mv.care) / 100,
      fairness: Number(mv.fairness) / 100,
      loyalty: Number(mv.loyalty) / 100,
      authority: Number(mv.authority) / 100,
      sanctity: Number(mv.sanctity) / 100,
      liberty: Number(mv.liberty) / 100,
      epistemicHumility: Number(mv.epistemicHumility) / 100,
      temporalStewardship: Number(mv.temporalStewardship) / 100,
    },
    stakeAmount: ethers.formatEther(raw.stakeAmount),
    status: STATUS_NAMES[Number(raw.status)] || "Unknown",
    createdAt: Number(raw.createdAt),
    verifierCount: Number(raw.verifierCount),
    erc8004AgentId: raw.erc8004AgentId,
    meetsConsensus: consensus,
  };
}

// ── Helper: Format bounty data ──

export interface BountyData {
  id: number;
  poster: string;
  claimant: string;
  reward: string;
  description: string;
  discipline: string;
  quantumId: number;
  status: string;
  createdAt: number;
  deadline: number;
  expired: boolean;
}

const BOUNTY_STATUS_NAMES = [
  "Open",
  "Claimed",
  "PendingVerification",
  "Completed",
  "Refunded",
];

export function formatBounty(raw: any): BountyData {
  return {
    id: Number(raw.id),
    poster: raw.poster,
    claimant: raw.claimant,
    reward: ethers.formatEther(raw.reward) + " ETH",
    description: raw.description,
    discipline: raw.discipline,
    quantumId: Number(raw.quantumId),
    status: BOUNTY_STATUS_NAMES[Number(raw.status)] || "Unknown",
    createdAt: Number(raw.createdAt),
    deadline: Number(raw.deadline),
    expired: Date.now() / 1000 > Number(raw.deadline),
  };
}
