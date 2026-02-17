/**
 * TruthSea Event Indexer
 *
 * Listens for contract events on Base Sepolia and syncs them to Postgres.
 * Runs as a standalone process: `npm run indexer`
 *
 * Events indexed:
 *   - QuantumCreated → creates Quantum row
 *   - QuantumVerified → creates Verification row, updates Quantum scores
 *   - QuantumDisputed → updates Quantum status
 *   - BountyCreated → creates Bounty row
 *   - BountyClaimed → updates Bounty claimant
 *   - BountyCompleted → updates Bounty status + agent reputation
 *   - BountyRefunded → updates Bounty status
 */

import { ethers } from "ethers";
import { prisma } from "../lib/prisma.js";
import { provider, registry, bountyBridge, REGISTRY_ADDR, BOUNTY_ADDR } from "../lib/chain.js";

const POLL_INTERVAL = Number(process.env.INDEX_POLL_MS) || 12_000; // ~Base block time
const BATCH_SIZE = 500; // max blocks per query

async function getLastSyncedBlock(): Promise<number> {
  const cursor = await prisma.syncCursor.findUnique({ where: { id: "default" } });
  return cursor?.lastBlock || 0;
}

async function setLastSyncedBlock(block: number) {
  await prisma.syncCursor.upsert({
    where: { id: "default" },
    update: { lastBlock: block },
    create: { id: "default", lastBlock: block },
  });
}

// ── Process Registry Events ──

async function processRegistryEvents(fromBlock: number, toBlock: number) {
  // QuantumCreated
  const createdFilter = registry.filters.QuantumCreated();
  const createdEvents = await registry.queryFilter(createdFilter, fromBlock, toBlock);

  for (const event of createdEvents) {
    const e = event as ethers.EventLog;
    const quantumId = Number(e.args[0]);
    const host = e.args[1];
    const discipline = e.args[2];
    const claim = e.args[3];

    // Fetch full quantum data from chain
    try {
      const q = await registry.getQuantum(quantumId);
      const ts = q.truthScores;
      const mv = q.moralVector;
      const corr = Number(ts.correspondence);
      const coh = Number(ts.coherence);
      const conv = Number(ts.convergence);
      const prag = Number(ts.pragmatism);

      await prisma.quantum.upsert({
        where: { id: quantumId },
        update: {},
        create: {
          id: quantumId,
          host,
          ipfsCid: q.ipfsCid,
          discipline,
          claim,
          status: "ACTIVE",
          stakeAmount: q.stakeAmount.toString(),
          createdAt: new Date(Number(q.createdAt) * 1000),
          verifierCount: Number(q.verifierCount),
          erc8004AgentId: q.erc8004AgentId === ethers.ZeroHash ? null : q.erc8004AgentId,
          correspondence: corr,
          coherence: coh,
          convergence: conv,
          pragmatism: prag,
          aggregateScore: (corr + coh + conv + prag) / 400,
          moralCare: Number(mv.care),
          moralFairness: Number(mv.fairness),
          moralLoyalty: Number(mv.loyalty),
          moralAuthority: Number(mv.authority),
          moralSanctity: Number(mv.sanctity),
          moralLiberty: Number(mv.liberty),
          moralEpistemicHumility: Number(mv.epistemicHumility),
          moralTemporalStewardship: Number(mv.temporalStewardship),
          moralMagnitude: Number(await registry.moralMagnitude(quantumId)) / 100,
        },
      });

      console.log(`[INDEXER] QuantumCreated #${quantumId}: "${claim.slice(0, 60)}..."`);
    } catch (err: any) {
      console.error(`[INDEXER] Failed to index quantum #${quantumId}:`, err.message);
    }
  }

  // QuantumVerified
  const verifiedFilter = registry.filters.QuantumVerified();
  const verifiedEvents = await registry.queryFilter(verifiedFilter, fromBlock, toBlock);

  for (const event of verifiedEvents) {
    const e = event as ethers.EventLog;
    const quantumId = Number(e.args[0]);
    const verifier = e.args[1];
    const txHash = e.transactionHash;

    try {
      // Fetch updated quantum from chain
      const q = await registry.getQuantum(quantumId);
      const ts = q.truthScores;
      const mv = q.moralVector;
      const corr = Number(ts.correspondence);
      const coh = Number(ts.coherence);
      const conv = Number(ts.convergence);
      const prag = Number(ts.pragmatism);

      // Create verification record
      await prisma.verification.upsert({
        where: { txHash },
        update: {},
        create: {
          quantumId,
          verifier,
          txHash,
          correspondence: corr,
          coherence: coh,
          convergence: conv,
          pragmatism: prag,
          moralCare: Number(mv.care),
          moralFairness: Number(mv.fairness),
          moralLoyalty: Number(mv.loyalty),
          moralAuthority: Number(mv.authority),
          moralSanctity: Number(mv.sanctity),
          moralLiberty: Number(mv.liberty),
          moralEpistemicHumility: Number(mv.epistemicHumility),
          moralTemporalStewardship: Number(mv.temporalStewardship),
        },
      });

      // Update quantum with new scores (already averaged on-chain)
      await prisma.quantum.update({
        where: { id: quantumId },
        data: {
          correspondence: corr,
          coherence: coh,
          convergence: conv,
          pragmatism: prag,
          aggregateScore: (corr + coh + conv + prag) / 400,
          moralCare: Number(mv.care),
          moralFairness: Number(mv.fairness),
          moralLoyalty: Number(mv.loyalty),
          moralAuthority: Number(mv.authority),
          moralSanctity: Number(mv.sanctity),
          moralLiberty: Number(mv.liberty),
          moralEpistemicHumility: Number(mv.epistemicHumility),
          moralTemporalStewardship: Number(mv.temporalStewardship),
          moralMagnitude: Number(await registry.moralMagnitude(quantumId)) / 100,
          verifierCount: Number(q.verifierCount),
        },
      });

      // Update agent reputation
      await prisma.agentReputation.upsert({
        where: { walletAddress: verifier },
        update: {
          totalVerifications: { increment: 1 },
          successfulVerifications: { increment: 1 },
          lastActiveAt: new Date(),
        },
        create: {
          id: verifier,
          walletAddress: verifier,
          totalVerifications: 1,
          successfulVerifications: 1,
          lastActiveAt: new Date(),
        },
      });

      console.log(`[INDEXER] QuantumVerified #${quantumId} by ${verifier.slice(0, 10)}...`);
    } catch (err: any) {
      console.error(`[INDEXER] Failed to index verification:`, err.message);
    }
  }

  // QuantumDisputed
  const disputedFilter = registry.filters.QuantumDisputed();
  const disputedEvents = await registry.queryFilter(disputedFilter, fromBlock, toBlock);

  for (const event of disputedEvents) {
    const e = event as ethers.EventLog;
    const quantumId = Number(e.args[0]);

    await prisma.quantum.update({
      where: { id: quantumId },
      data: { status: "DISPUTED" },
    }).catch(() => {});

    console.log(`[INDEXER] QuantumDisputed #${quantumId}`);
  }
}

// ── Process Bounty Events ──

async function processBountyEvents(fromBlock: number, toBlock: number) {
  // BountyCreated
  const createdFilter = bountyBridge.filters.BountyCreated();
  const createdEvents = await bountyBridge.queryFilter(createdFilter, fromBlock, toBlock);

  for (const event of createdEvents) {
    const e = event as ethers.EventLog;
    const bountyId = Number(e.args[0]);
    const poster = e.args[1];
    const reward = e.args[2];
    const discipline = e.args[3];

    try {
      const b = await bountyBridge.getBounty(bountyId);

      await prisma.bounty.upsert({
        where: { id: bountyId },
        update: {},
        create: {
          id: bountyId,
          poster,
          reward: reward.toString(),
          rewardEth: Number(ethers.formatEther(reward)),
          description: b.description,
          discipline,
          status: "OPEN",
          createdAt: new Date(Number(b.createdAt) * 1000),
          deadline: new Date(Number(b.deadline) * 1000),
          txHash: e.transactionHash,
        },
      });

      console.log(`[INDEXER] BountyCreated #${bountyId}: ${ethers.formatEther(reward)} ETH`);
    } catch (err: any) {
      console.error(`[INDEXER] Failed to index bounty #${bountyId}:`, err.message);
    }
  }

  // BountyClaimed
  const claimedFilter = bountyBridge.filters.BountyClaimed();
  const claimedEvents = await bountyBridge.queryFilter(claimedFilter, fromBlock, toBlock);

  for (const event of claimedEvents) {
    const e = event as ethers.EventLog;
    const bountyId = Number(e.args[0]);
    const claimant = e.args[1];

    await prisma.bounty.update({
      where: { id: bountyId },
      data: { claimant, status: "CLAIMED" },
    }).catch(() => {});

    console.log(`[INDEXER] BountyClaimed #${bountyId} by ${claimant.slice(0, 10)}...`);
  }

  // BountyCompleted
  const completedFilter = bountyBridge.filters.BountyCompleted();
  const completedEvents = await bountyBridge.queryFilter(completedFilter, fromBlock, toBlock);

  for (const event of completedEvents) {
    const e = event as ethers.EventLog;
    const bountyId = Number(e.args[0]);
    const quantumId = Number(e.args[1]);
    const claimant = e.args[2];

    await prisma.bounty.update({
      where: { id: bountyId },
      data: { status: "COMPLETED", quantumId },
    }).catch(() => {});

    // Update agent reputation
    await prisma.agentReputation.upsert({
      where: { walletAddress: claimant },
      update: {
        bountiesCompleted: { increment: 1 },
        lastActiveAt: new Date(),
      },
      create: {
        id: claimant,
        walletAddress: claimant,
        bountiesCompleted: 1,
        lastActiveAt: new Date(),
      },
    }).catch(() => {});

    console.log(`[INDEXER] BountyCompleted #${bountyId} → Quantum #${quantumId}`);
  }

  // BountyRefunded
  const refundedFilter = bountyBridge.filters.BountyRefunded();
  const refundedEvents = await bountyBridge.queryFilter(refundedFilter, fromBlock, toBlock);

  for (const event of refundedEvents) {
    const e = event as ethers.EventLog;
    const bountyId = Number(e.args[0]);

    await prisma.bounty.update({
      where: { id: bountyId },
      data: { status: "REFUNDED" },
    }).catch(() => {});

    console.log(`[INDEXER] BountyRefunded #${bountyId}`);
  }
}

// ── Main Loop ──

async function syncLoop() {
  console.log("[INDEXER] Starting TruthSea event indexer...");
  console.log(`[INDEXER] Registry: ${REGISTRY_ADDR}`);
  console.log(`[INDEXER] BountyBridge: ${BOUNTY_ADDR}`);

  while (true) {
    try {
      const lastSynced = await getLastSyncedBlock();
      const currentBlock = await provider.getBlockNumber();

      if (currentBlock <= lastSynced) {
        await sleep(POLL_INTERVAL);
        continue;
      }

      // Process in batches
      let fromBlock = lastSynced + 1;
      while (fromBlock <= currentBlock) {
        const toBlock = Math.min(fromBlock + BATCH_SIZE - 1, currentBlock);
        console.log(`[INDEXER] Processing blocks ${fromBlock} → ${toBlock}`);

        await processRegistryEvents(fromBlock, toBlock);
        await processBountyEvents(fromBlock, toBlock);
        await setLastSyncedBlock(toBlock);

        fromBlock = toBlock + 1;
      }

      console.log(`[INDEXER] Synced to block ${currentBlock}`);
    } catch (err: any) {
      console.error("[INDEXER] Error:", err.message);
    }

    await sleep(POLL_INTERVAL);
  }
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

// ── Entry Point ──

syncLoop().catch((err) => {
  console.error("[INDEXER] Fatal:", err);
  process.exit(1);
});
