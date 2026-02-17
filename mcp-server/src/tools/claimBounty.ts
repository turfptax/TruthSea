/**
 * crowdedsea_claim_bounty — Claim a truth bounty for investigation
 */

import { z } from "zod";
import { getBountyBridge, getRegistry, formatBounty } from "../contracts.js";

export const claimBountySchema = z.object({
  bounty_id: z.number().describe("The bounty ID to claim"),
  agent_id: z
    .string()
    .optional()
    .describe("ERC-8004 agent identity (hex bytes32) — links reputation"),
});

export type ClaimBountyInput = z.infer<typeof claimBountySchema>;

export async function claimBounty(input: ClaimBountyInput) {
  const bridge = getBountyBridge();
  const registry = getRegistry();

  // Optionally link agent identity first
  if (input.agent_id) {
    try {
      const linkTx = await registry.linkAgentIdentity(input.agent_id);
      await linkTx.wait();
    } catch (err: any) {
      // Non-fatal — might already be linked
      console.error("Agent identity link note:", err.message);
    }
  }

  const tx = await bridge.claimBounty(input.bounty_id);
  const receipt = await tx.wait();

  // Fetch updated bounty
  const raw = await bridge.getBounty(input.bounty_id);
  const b = formatBounty(raw);

  return {
    success: true,
    txHash: receipt.hash,
    bounty: b,
    message: `Bounty #${input.bounty_id} claimed! Reward: ${b.reward}. Deadline: ${new Date(b.deadline * 1000).toISOString()}. Submit evidence as a TruthQuantum to complete.`,
  };
}
