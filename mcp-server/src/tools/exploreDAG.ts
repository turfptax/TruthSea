/**
 * truthsea_explore_dag — Navigate the dependency graph around a quantum
 */

import { z } from "zod";
import { getDAG, getRegistry, formatQuantum } from "../contracts.js";
import { formatEdge } from "./createEdge.js";

export const exploreDAGSchema = z.object({
  quantum_id: z
    .number()
    .int()
    .min(0)
    .describe("The quantum ID to explore from"),
  direction: z
    .enum(["ancestors", "descendants", "both"])
    .default("both")
    .describe("ancestors = what this quantum depends on, descendants = what depends on this quantum, both = full neighborhood"),
  max_depth: z
    .number()
    .int()
    .min(1)
    .max(10)
    .default(3)
    .describe("Maximum traversal depth (1-10)"),
});

export type ExploreDAGInput = z.infer<typeof exploreDAGSchema>;

interface NodeInfo {
  id: number;
  claim: string;
  discipline: string;
  chain_score: number;
  depth: number;
}

export async function exploreDAG(input: ExploreDAGInput) {
  const dag = getDAG();
  const registry = getRegistry();

  const nodes = new Map<number, NodeInfo>();
  const edgeList: any[] = [];

  // Helper: fetch quantum summary
  async function fetchNode(qId: number): Promise<NodeInfo | null> {
    if (nodes.has(qId)) return nodes.get(qId)!;
    try {
      const quantum = await registry.getQuantum(qId);
      if (quantum.host === "0x0000000000000000000000000000000000000000") return null;
      const score = await dag.getChainScore(qId);
      const node: NodeInfo = {
        id: qId,
        claim: quantum.claim,
        discipline: quantum.discipline,
        chain_score: Number(score.chainScore) / 100,
        depth: Number(score.depth),
      };
      nodes.set(qId, node);
      return node;
    } catch {
      return null;
    }
  }

  // BFS traversal
  async function bfs(startId: number, getEdges: "outgoing" | "incoming", maxDepth: number) {
    const visited = new Set<number>();
    let frontier = [startId];
    let currentDepth = 0;

    while (frontier.length > 0 && currentDepth < maxDepth) {
      const nextFrontier: number[] = [];

      for (const qId of frontier) {
        if (visited.has(qId)) continue;
        visited.add(qId);
        await fetchNode(qId);

        const edgeIds: bigint[] = getEdges === "outgoing"
          ? await dag.getOutgoingEdges(qId)
          : await dag.getIncomingEdges(qId);

        for (const eid of edgeIds) {
          const edge = await dag.getEdge(Number(eid));
          if (Number(edge.status) !== 0) continue; // skip non-active

          const formatted = formatEdge(edge);
          edgeList.push(formatted);

          const neighborId = getEdges === "outgoing"
            ? Number(edge.sourceQuantumId)
            : Number(edge.targetQuantumId);

          if (!visited.has(neighborId)) {
            nextFrontier.push(neighborId);
          }
        }
      }

      frontier = nextFrontier;
      currentDepth++;
    }

    // Fetch any remaining frontier nodes
    for (const qId of frontier) {
      await fetchNode(qId);
    }
  }

  // Fetch the starting node
  await fetchNode(input.quantum_id);

  if (input.direction === "ancestors" || input.direction === "both") {
    await bfs(input.quantum_id, "outgoing", input.max_depth);
  }
  if (input.direction === "descendants" || input.direction === "both") {
    await bfs(input.quantum_id, "incoming", input.max_depth);
  }

  // Deduplicate edges
  const seenEdges = new Set<number>();
  const uniqueEdges = edgeList.filter((e) => {
    if (seenEdges.has(e.id)) return false;
    seenEdges.add(e.id);
    return true;
  });

  return {
    root_quantum_id: input.quantum_id,
    direction: input.direction,
    max_depth: input.max_depth,
    nodes: Array.from(nodes.values()),
    edges: uniqueEdges,
    node_count: nodes.size,
    edge_count: uniqueEdges.length,
  };
}
