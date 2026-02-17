/**
 * truthsea_dispute — Challenge an existing quantum with counter-evidence
 */

import { z } from "zod";
import { ethers } from "ethers";
import { getRegistry, formatQuantum } from "../contracts.js";

export const disputeQuantumSchema = z.object({
  quantum_id: z.number().describe("The quantum ID to challenge"),
  counter_claim: z.string().describe("Your counter-claim / corrected claim"),
  counter_evidence_urls: z
    .array(z.string())
    .optional()
    .describe("URLs supporting the counter-claim"),
  counter_scores: z.object({
    correspondence: z.number().min(0).max(100),
    coherence: z.number().min(0).max(100),
    convergence: z.number().min(0).max(100),
    pragmatism: z.number().min(0).max(100),
  }),
  counter_moral_vector: z.object({
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

export type DisputeQuantumInput = z.infer<typeof disputeQuantumSchema>;

export async function disputeQuantum(input: DisputeQuantumInput) {
  const registry = getRegistry();

  const counterCid = ethers.keccak256(
    ethers.toUtf8Bytes(
      JSON.stringify({
        counter_claim: input.counter_claim,
        evidence: input.counter_evidence_urls || [],
        timestamp: Date.now(),
      })
    )
  );

  const cs = input.counter_scores;
  const cm = input.counter_moral_vector;

  const tx = await registry.dispute(
    input.quantum_id,
    counterCid,
    input.counter_claim,
    [
      Math.round(cs.correspondence * 100),
      Math.round(cs.coherence * 100),
      Math.round(cs.convergence * 100),
      Math.round(cs.pragmatism * 100),
    ],
    [
      Math.round(cm.care * 100),
      Math.round(cm.fairness * 100),
      Math.round(cm.loyalty * 100),
      Math.round(cm.authority * 100),
      Math.round(cm.sanctity * 100),
      Math.round(cm.liberty * 100),
      Math.round(cm.epistemic_humility * 100),
      Math.round(cm.temporal_stewardship * 100),
    ]
  );

  const receipt = await tx.wait();

  // Parse QuantumDisputed event to get fork ID
  const event = receipt.logs.find(
    (log: any) => log.fragment?.name === "QuantumDisputed"
  );
  const forkId = event ? Number(event.args[2]) : -1;

  // Fetch both the disputed original and the new fork
  const originalRaw = await registry.getQuantum(input.quantum_id);
  const forkRaw = await registry.getQuantum(forkId);
  const forkConsensus = await registry.meetsConsensus(forkId);

  return {
    success: true,
    txHash: receipt.hash,
    originalQuantumId: input.quantum_id,
    originalStatus: "Disputed",
    forkQuantumId: forkId,
    fork: formatQuantum(forkRaw, forkConsensus),
    message: `Quantum #${input.quantum_id} disputed! Fork #${forkId} created with counter-claim: "${input.counter_claim}". Original host slashed 10%.`,
  };
}
