/**
 * crowdedsea_list_bounties — List available truth bounties from CrowdedSea
 */

import { z } from "zod";
import { ethers } from "ethers";
import { getBountyBridge, formatBounty, BountyData } from "../contracts.js";

export const listBountiesSchema = z.object({
  status: z
    .enum(["open", "claimed", "pending", "completed", "refunded", "all"])
    .default("all")
    .describe("Filter by bounty status"),
  min_reward: z
    .number()
    .min(0)
    .optional()
    .describe("Minimum reward in ETH"),
  limit: z.number().min(1).max(50).default(10),
});

export type ListBountiesInput = z.infer<typeof listBountiesSchema>;

const STATUS_MAP: Record<string, number> = {
  open: 0,
  claimed: 1,
  pending: 2,
  completed: 3,
  refunded: 4,
};

export async function listBounties(input: ListBountiesInput) {
  const bridge = getBountyBridge();

  const totalBounties = Number(await bridge.nextBountyId());
  const results: BountyData[] = [];

  // Scan from newest to oldest
  const start = Math.max(0, totalBounties - 1);
  for (let i = start; i >= 0 && results.length < input.limit; i--) {
    try {
      const raw = await bridge.getBounty(i);

      // Skip empty
      if (raw.poster === "0x0000000000000000000000000000000000000000") continue;

      const b = formatBounty(raw);

      // Apply status filter
      if (input.status !== "all") {
        const targetStatus = STATUS_MAP[input.status];
        if (Number(raw.status) !== targetStatus) continue;
      }

      // Apply min reward filter
      if (input.min_reward !== undefined) {
        const rewardEth = parseFloat(ethers.formatEther(raw.reward));
        if (rewardEth < input.min_reward) continue;
      }

      results.push(b);
    } catch {
      continue;
    }
  }

  return {
    total_bounties: totalBounties,
    results_returned: results.length,
    filters: {
      status: input.status,
      min_reward: input.min_reward ?? "none",
    },
    bounties: results,
  };
}
