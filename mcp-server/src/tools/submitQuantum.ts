/**
 * truthsea_submit_quantum — Submit a new truth quantum for verification
 */

import { z } from "zod";
import { ethers } from "ethers";
import { getRegistry, formatQuantum } from "../contracts.js";

export const submitQuantumSchema = z.object({
  claim: z.string().describe("The claim to be verified"),
  discipline: z
    .string()
    .describe("e.g. Physics, History, Medicine, Ethics, Computer Science"),
  evidence_urls: z
    .array(z.string())
    .optional()
    .describe("Supporting evidence links (stored as IPFS CID placeholder)"),
  initial_truth_scores: z.object({
    correspondence: z.number().min(0).max(100).describe("Maps to observable reality (0-100)"),
    coherence: z.number().min(0).max(100).describe("Fits the web of known truths (0-100)"),
    convergence: z.number().min(0).max(100).describe("Independent sources agree (0-100)"),
    pragmatism: z.number().min(0).max(100).describe("Works in practice (0-100)"),
  }),
  initial_moral_vector: z.object({
    care: z.number().min(-100).max(100).describe("Care (+) ↔ Harm (-)"),
    fairness: z.number().min(-100).max(100).describe("Fairness (+) ↔ Cheating (-)"),
    loyalty: z.number().min(-100).max(100).describe("Loyalty (+) ↔ Betrayal (-)"),
    authority: z.number().min(-100).max(100).describe("Authority (+) ↔ Subversion (-)"),
    sanctity: z.number().min(-100).max(100).describe("Sanctity (+) ↔ Degradation (-)"),
    liberty: z.number().min(-100).max(100).describe("Liberty (+) ↔ Oppression (-)"),
    epistemic_humility: z
      .number()
      .min(-100)
      .max(100)
      .describe("Open inquiry (+) ↔ Dogmatism (-)"),
    temporal_stewardship: z
      .number()
      .min(-100)
      .max(100)
      .describe("Long-term (+) ↔ Short-term extraction (-)"),
  }),
});

export type SubmitQuantumInput = z.infer<typeof submitQuantumSchema>;

export async function submitQuantum(input: SubmitQuantumInput) {
  const registry = getRegistry();

  // Convert evidence URLs to a placeholder IPFS CID (bytes32)
  // In production, this would pin to IPFS first
  const evidenceHash = ethers.keccak256(
    ethers.toUtf8Bytes(
      JSON.stringify({
        claim: input.claim,
        evidence: input.evidence_urls || [],
        timestamp: Date.now(),
      })
    )
  );

  // Scale scores: user provides 0-100, contract expects 0-10000
  const truthScores = {
    correspondence: Math.round(input.initial_truth_scores.correspondence * 100),
    coherence: Math.round(input.initial_truth_scores.coherence * 100),
    convergence: Math.round(input.initial_truth_scores.convergence * 100),
    pragmatism: Math.round(input.initial_truth_scores.pragmatism * 100),
  };

  const moralVector = {
    care: Math.round(input.initial_moral_vector.care * 100),
    fairness: Math.round(input.initial_moral_vector.fairness * 100),
    loyalty: Math.round(input.initial_moral_vector.loyalty * 100),
    authority: Math.round(input.initial_moral_vector.authority * 100),
    sanctity: Math.round(input.initial_moral_vector.sanctity * 100),
    liberty: Math.round(input.initial_moral_vector.liberty * 100),
    epistemicHumility: Math.round(input.initial_moral_vector.epistemic_humility * 100),
    temporalStewardship: Math.round(input.initial_moral_vector.temporal_stewardship * 100),
  };

  const tx = await registry.createQuantum(
    evidenceHash,
    input.discipline,
    input.claim,
    [
      truthScores.correspondence,
      truthScores.coherence,
      truthScores.convergence,
      truthScores.pragmatism,
    ],
    [
      moralVector.care,
      moralVector.fairness,
      moralVector.loyalty,
      moralVector.authority,
      moralVector.sanctity,
      moralVector.liberty,
      moralVector.epistemicHumility,
      moralVector.temporalStewardship,
    ]
  );

  const receipt = await tx.wait();

  // Parse QuantumCreated event to get the ID
  const event = receipt.logs.find(
    (log: any) => log.fragment?.name === "QuantumCreated"
  );
  const quantumId = event ? Number(event.args[0]) : -1;

  // Fetch the created quantum
  const raw = await registry.getQuantum(quantumId);
  const consensus = await registry.meetsConsensus(quantumId);

  return {
    success: true,
    quantumId,
    txHash: receipt.hash,
    quantum: formatQuantum(raw, consensus),
    message: `Truth quantum #${quantumId} created. Claim: "${input.claim}" in ${input.discipline}. Awaiting verifiers.`,
  };
}
