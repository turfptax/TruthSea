/**
 * truthsea_create_edge — Create a dependency edge between two truth quanta
 */

import { z } from "zod";
import { ethers } from "ethers";
import { getDAG, getStaking, getRegistry, formatQuantum } from "../contracts.js";

export const createEdgeSchema = z.object({
  source_quantum_id: z
    .number()
    .int()
    .min(0)
    .describe("The quantum being depended upon (the foundation)"),
  target_quantum_id: z
    .number()
    .int()
    .min(0)
    .describe("The quantum that depends on the source (the inference)"),
  edge_type: z
    .enum(["depends", "supports", "contradicts"])
    .describe("Relationship type: depends (epistemological dependency), supports (corroborating evidence), contradicts (counter-evidence)"),
  confidence: z
    .number()
    .min(0)
    .max(100)
    .describe("Strength of this inferential link (0-100)"),
  reasoning: z
    .string()
    .optional()
    .describe("Why this dependency exists (stored off-chain)"),
  evidence_urls: z
    .array(z.string())
    .optional()
    .describe("Supporting evidence links for this edge"),
});

export type CreateEdgeInput = z.infer<typeof createEdgeSchema>;

const EDGE_TYPE_MAP: Record<string, number> = {
  depends: 0,
  supports: 1,
  contradicts: 2,
};

export async function createEdge(input: CreateEdgeInput) {
  const dag = getDAG();
  const staking = getStaking();

  // Build evidence CID from reasoning + URLs
  const evidenceHash = ethers.keccak256(
    ethers.toUtf8Bytes(
      JSON.stringify({
        source: input.source_quantum_id,
        target: input.target_quantum_id,
        reasoning: input.reasoning || "",
        evidence: input.evidence_urls || [],
        timestamp: Date.now(),
      })
    )
  );

  const edgeType = EDGE_TYPE_MAP[input.edge_type];
  const confidence = Math.round(input.confidence * 100); // scale to 0-10000

  // Get the next edge ID to compute the stake key
  const nextEdgeId = Number(await dag.nextEdgeId());
  const stakeKey = ethers.keccak256(
    ethers.AbiCoder.defaultAbiCoder().encode(
      ["string", "uint256"],
      ["edge", nextEdgeId]
    )
  );

  // Check minimum stake requirement
  const minStake = await dag.minEdgeStake();

  // Stake TRUTH tokens first (user must have approved TruthStaking)
  const stakeTx = await staking.stake(stakeKey, minStake);
  await stakeTx.wait();

  // Create the edge
  const tx = await dag.createEdge(
    input.source_quantum_id,
    input.target_quantum_id,
    edgeType,
    evidenceHash,
    confidence
  );
  const receipt = await tx.wait();

  // Parse EdgeCreated event
  const event = receipt.logs.find(
    (log: any) => log.fragment?.name === "EdgeCreated"
  );
  const edgeId = event ? Number(event.args[0]) : nextEdgeId;

  // Fetch the created edge
  const edge = await dag.getEdge(edgeId);

  return {
    success: true,
    edgeId,
    txHash: receipt.hash,
    edge: formatEdge(edge),
    message: `Edge #${edgeId} created: quantum ${input.source_quantum_id} ${input.edge_type} quantum ${input.target_quantum_id} (confidence: ${input.confidence}%)`,
  };
}

const EDGE_TYPE_NAMES = ["Depends", "Supports", "Contradicts"];
const EDGE_STATUS_NAMES = ["Active", "Disputed", "Invalidated", "Removed"];

export function formatEdge(raw: any) {
  return {
    id: Number(raw.id),
    sourceQuantumId: Number(raw.sourceQuantumId),
    targetQuantumId: Number(raw.targetQuantumId),
    edgeType: EDGE_TYPE_NAMES[Number(raw.edgeType)] || "Unknown",
    status: EDGE_STATUS_NAMES[Number(raw.status)] || "Unknown",
    proposer: raw.proposer,
    evidenceCid: raw.evidenceCid,
    stakeAmount: ethers.formatEther(raw.stakeAmount),
    confidence: Number(raw.confidence) / 100,
    createdAt: Number(raw.createdAt),
  };
}
