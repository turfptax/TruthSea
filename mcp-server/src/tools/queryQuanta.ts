/**
 * truthsea_query — Query truth quanta by discipline, score threshold, or claim text
 */

import { z } from "zod";
import { getRegistry, formatQuantum, QuantumData } from "../contracts.js";

export const queryQuantaSchema = z.object({
  discipline: z.string().optional().describe("Filter by discipline (e.g. Physics, Ethics)"),
  min_score: z
    .number()
    .min(0)
    .max(100)
    .optional()
    .describe("Minimum aggregate truth score (0-100)"),
  claim_search: z.string().optional().describe("Search term in claim text"),
  limit: z.number().min(1).max(50).default(10).describe("Max results to return"),
});

export type QueryQuantaInput = z.infer<typeof queryQuantaSchema>;

export async function queryQuanta(input: QueryQuantaInput) {
  const registry = getRegistry();

  const totalQuanta = Number(await registry.nextQuantumId());
  const results: QuantumData[] = [];

  // Scan from newest to oldest
  const start = Math.max(0, totalQuanta - 1);
  for (let i = start; i >= 0 && results.length < input.limit; i--) {
    try {
      const raw = await registry.getQuantum(i);

      // Skip empty/uninitialized
      if (raw.host === "0x0000000000000000000000000000000000000000") continue;

      const consensus = await registry.meetsConsensus(i);
      const q = formatQuantum(raw, consensus);

      // Apply filters
      if (input.discipline && q.discipline.toLowerCase() !== input.discipline.toLowerCase()) {
        continue;
      }
      if (input.min_score !== undefined && q.truthScores.aggregate < input.min_score) {
        continue;
      }
      if (
        input.claim_search &&
        !q.claim.toLowerCase().includes(input.claim_search.toLowerCase())
      ) {
        continue;
      }

      results.push(q);
    } catch {
      // Skip any quanta that fail to load
      continue;
    }
  }

  return {
    total_quanta: totalQuanta,
    results_returned: results.length,
    filters: {
      discipline: input.discipline || "any",
      min_score: input.min_score ?? "none",
      claim_search: input.claim_search || "none",
    },
    quanta: results,
  };
}
