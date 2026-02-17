/**
 * truthsea_verify_quantum — Submit verification scores for an existing quantum
 */

import { z } from "zod";
import { getRegistry, formatQuantum } from "../contracts.js";

export const verifyQuantumSchema = z.object({
  quantum_id: z.number().describe("The quantum ID to verify"),
  truth_scores: z.object({
    correspondence: z.number().min(0).max(100),
    coherence: z.number().min(0).max(100),
    convergence: z.number().min(0).max(100),
    pragmatism: z.number().min(0).max(100),
  }),
  moral_vector: z.object({
    care: z.number().min(-100).max(100),
    fairness: z.number().min(-100).max(100),
    loyalty: z.number().min(-100).max(100),
    authority: z.number().min(-100).max(100),
    sanctity: z.number().min(-100).max(100),
    liberty: z.number().min(-100).max(100),
    epistemic_humility: z.number().min(-100).max(100),
    temporal_stewardship: z.number().min(-100).max(100),
  }),
});

export type VerifyQuantumInput = z.infer<typeof verifyQuantumSchema>;

export async function verifyQuantum(input: VerifyQuantumInput) {
  const registry = getRegistry();

  const ts = input.truth_scores;
  const mv = input.moral_vector;

  const tx = await registry.verify(
    input.quantum_id,
    [
      Math.round(ts.correspondence * 100),
      Math.round(ts.coherence * 100),
      Math.round(ts.convergence * 100),
      Math.round(ts.pragmatism * 100),
    ],
    [
      Math.round(mv.care * 100),
      Math.round(mv.fairness * 100),
      Math.round(mv.loyalty * 100),
      Math.round(mv.authority * 100),
      Math.round(mv.sanctity * 100),
      Math.round(mv.liberty * 100),
      Math.round(mv.epistemic_humility * 100),
      Math.round(mv.temporal_stewardship * 100),
    ]
  );

  const receipt = await tx.wait();

  // Fetch updated quantum
  const raw = await registry.getQuantum(input.quantum_id);
  const consensus = await registry.meetsConsensus(input.quantum_id);

  return {
    success: true,
    txHash: receipt.hash,
    quantum: formatQuantum(raw, consensus),
    message: `Verification submitted for quantum #${input.quantum_id}. New aggregate truth score: ${formatQuantum(raw, consensus).truthScores.aggregate.toFixed(2)}. Consensus: ${consensus ? "YES" : "NOT YET"}.`,
  };
}
