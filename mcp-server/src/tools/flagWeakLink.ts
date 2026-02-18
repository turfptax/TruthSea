/**
 * truthsea_flag_weak_link — Flag an edge as potentially weak
 */

import { z } from "zod";
import { getDAG } from "../contracts.js";
import { formatEdge } from "./createEdge.js";

export const flagWeakLinkSchema = z.object({
  edge_id: z
    .number()
    .int()
    .min(0)
    .describe("The edge ID to flag as a potential weak link"),
});

export type FlagWeakLinkInput = z.infer<typeof flagWeakLinkSchema>;

export async function flagWeakLink(input: FlagWeakLinkInput) {
  const dag = getDAG();

  // Verify edge exists and is active
  const edge = await dag.getEdge(input.edge_id);
  if (Number(edge.status) !== 0) {
    throw new Error(`Edge #${input.edge_id} is not active (status: ${Number(edge.status)})`);
  }

  const tx = await dag.flagWeakLink(input.edge_id);
  const receipt = await tx.wait();

  // Get current flags
  const flags = await dag.getWeakLinkFlags(input.edge_id);

  return {
    success: true,
    edgeId: input.edge_id,
    txHash: receipt.hash,
    edge: formatEdge(edge),
    total_flags: flags.length,
    message: `Edge #${input.edge_id} flagged as a potential weak link. If this edge is later invalidated or disputed within 30 days, you will earn a 100 TRUTH bounty.`,
  };
}
