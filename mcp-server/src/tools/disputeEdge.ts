/**
 * truthsea_dispute_edge — Challenge an existing DAG edge
 */

import { z } from "zod";
import { getDAG } from "../contracts.js";
import { formatEdge } from "./createEdge.js";

export const disputeEdgeSchema = z.object({
  edge_id: z
    .number()
    .int()
    .min(0)
    .describe("The edge ID to dispute"),
});

export type DisputeEdgeInput = z.infer<typeof disputeEdgeSchema>;

export async function disputeEdge(input: DisputeEdgeInput) {
  const dag = getDAG();

  // Verify edge exists and is active
  const edge = await dag.getEdge(input.edge_id);
  if (Number(edge.status) !== 0) {
    throw new Error(`Edge #${input.edge_id} is not active (status: ${Number(edge.status)})`);
  }

  const tx = await dag.disputeEdge(input.edge_id);
  const receipt = await tx.wait();

  // Fetch updated edge
  const updatedEdge = await dag.getEdge(input.edge_id);

  return {
    success: true,
    edgeId: input.edge_id,
    txHash: receipt.hash,
    edge: formatEdge(updatedEdge),
    message: `Edge #${input.edge_id} disputed. The proposer's stake has been slashed 10%, and 60% of the remainder transferred to you. You also received TRUTH tokens as a reward. Consider creating a counter-quantum via truthsea_submit_quantum if you have a competing claim.`,
  };
}
