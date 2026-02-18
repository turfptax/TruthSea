/**
 * truthsea_find_weak_links — Find edges below a confidence/score threshold
 */

import { z } from "zod";
import { getDAG, getRegistry } from "../contracts.js";
import { formatEdge } from "./createEdge.js";

export const findWeakLinksSchema = z.object({
  quantum_id: z
    .number()
    .int()
    .min(0)
    .describe("The quantum ID to find weak links for (traces its dependency chain)"),
  threshold: z
    .number()
    .min(0)
    .max(100)
    .default(50)
    .describe("Edges with confidence or chain score below this are considered weak (0-100)"),
  max_depth: z
    .number()
    .int()
    .min(1)
    .max(20)
    .default(10)
    .describe("Maximum depth to traverse looking for weak links"),
});

export type FindWeakLinksInput = z.infer<typeof findWeakLinksSchema>;

export async function findWeakLinks(input: FindWeakLinksInput) {
  const dag = getDAG();
  const registry = getRegistry();

  const thresholdScaled = Math.round(input.threshold * 100); // scale to 0-10000
  const weakEdges: any[] = [];
  const visited = new Set<number>();

  // BFS through dependency chain
  let frontier = [input.quantum_id];
  let currentDepth = 0;

  while (frontier.length > 0 && currentDepth < input.max_depth) {
    const nextFrontier: number[] = [];

    for (const qId of frontier) {
      if (visited.has(qId)) continue;
      visited.add(qId);

      const edgeIds: bigint[] = await dag.getOutgoingEdges(qId);

      for (const eid of edgeIds) {
        const edge = await dag.getEdge(Number(eid));
        if (Number(edge.status) !== 0) continue; // skip non-active

        const confidence = Number(edge.confidence);
        const formatted = formatEdge(edge);

        // Check if this edge is weak
        const isWeak = confidence < thresholdScaled;

        // Also check the chain score of the dependency
        const depScore = await dag.getChainScore(Number(edge.sourceQuantumId));
        const depChainScore = Number(depScore.chainScore);
        const isDepWeak = depChainScore < thresholdScaled;

        if (isWeak || isDepWeak) {
          // Get claim info for context
          let sourceClaim = "";
          let targetClaim = "";
          try {
            const sq = await registry.getQuantum(Number(edge.sourceQuantumId));
            sourceClaim = sq.claim;
            const tq = await registry.getQuantum(Number(edge.targetQuantumId));
            targetClaim = tq.claim;
          } catch {
            // skip claim info if unavailable
          }

          weakEdges.push({
            ...formatted,
            source_claim: sourceClaim,
            target_claim: targetClaim,
            dependency_chain_score: depChainScore / 100,
            reason: isWeak && isDepWeak
              ? "Low edge confidence AND low dependency chain score"
              : isWeak
                ? "Low edge confidence"
                : "Low dependency chain score",
          });
        }

        // Continue traversal through depends edges
        if (Number(edge.edgeType) === 0) {
          nextFrontier.push(Number(edge.sourceQuantumId));
        }
      }
    }

    frontier = nextFrontier;
    currentDepth++;
  }

  // Sort by confidence (weakest first)
  weakEdges.sort((a, b) => a.confidence - b.confidence);

  return {
    quantum_id: input.quantum_id,
    threshold: input.threshold,
    depth_searched: currentDepth,
    quanta_visited: visited.size,
    weak_links_found: weakEdges.length,
    weak_links: weakEdges,
    message: weakEdges.length === 0
      ? `No weak links found below ${input.threshold}% threshold in the dependency chain of quantum #${input.quantum_id}.`
      : `Found ${weakEdges.length} weak link(s) below ${input.threshold}% threshold. Consider flagging them with truthsea_flag_weak_link.`,
  };
}
