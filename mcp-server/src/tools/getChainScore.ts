/**
 * truthsea_get_chain_score — Get the propagated chain score for a quantum
 */

import { z } from "zod";
import { getDAG, getRegistry, formatQuantum } from "../contracts.js";
import { formatEdge } from "./createEdge.js";

export const getChainScoreSchema = z.object({
  quantum_id: z
    .number()
    .int()
    .min(0)
    .describe("The quantum ID to get the chain score for"),
  include_path: z
    .boolean()
    .default(false)
    .describe("Include the critical path of weakest links from this quantum to its weakest foundation"),
});

export type GetChainScoreInput = z.infer<typeof getChainScoreSchema>;

export async function getChainScore(input: GetChainScoreInput) {
  const dag = getDAG();
  const registry = getRegistry();

  // Get propagated score
  const score = await dag.getChainScore(input.quantum_id);
  const chainScore = Number(score.chainScore) / 100;
  const weakestLinkScore = Number(score.weakestLinkScore) / 100;
  const depth = Number(score.depth);
  const lastUpdated = Number(score.lastUpdated);

  // Get intrinsic score from registry for comparison
  const quantum = await registry.getQuantum(input.quantum_id);
  const ts = quantum.truthScores;
  const intrinsic = (
    Number(ts.correspondence) * 3000 +
    Number(ts.coherence) * 2500 +
    Number(ts.convergence) * 2500 +
    Number(ts.pragmatism) * 2000
  ) / 10000 / 100;

  const result: any = {
    quantum_id: input.quantum_id,
    claim: quantum.claim,
    discipline: quantum.discipline,
    intrinsic_score: intrinsic,
    chain_score: chainScore,
    weakest_link_score: weakestLinkScore,
    attenuation: intrinsic > 0 ? chainScore / intrinsic : 0,
    depth,
    is_axiom: depth === 0,
    last_updated: lastUpdated > 0 ? new Date(lastUpdated * 1000).toISOString() : "never",
  };

  // Optionally trace the critical weakest-link path
  if (input.include_path && depth > 0) {
    const path: any[] = [];
    let currentId = input.quantum_id;

    for (let i = 0; i < depth + 1 && i < 20; i++) {
      const currentScore = await dag.getChainScore(currentId);
      const weakEdgeId = Number(currentScore.weakestLinkEdgeId);

      if (weakEdgeId === 0 && Number(currentScore.depth) === 0) break;

      const edge = await dag.getEdge(weakEdgeId);
      path.push({
        edge: formatEdge(edge),
        source_quantum_id: Number(edge.sourceQuantumId),
        target_quantum_id: Number(edge.targetQuantumId),
      });

      // Move to the dependency (source is the depended-upon quantum)
      currentId = Number(edge.sourceQuantumId);
    }

    result.weakest_path = path;
  }

  return result;
}
