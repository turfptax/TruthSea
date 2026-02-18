/**
 * backfill-edges.js — Migrate offline chain data to on-chain TruthDAG
 *
 * Reads the 161 quanta from agent-toolkit/output/*.jsonl and the dependency
 * graphs from agent-toolkit/chains/*.json, then:
 *   1. Submits quanta not yet on-chain to TruthRegistryV2
 *   2. Creates dependency edges on TruthDAG
 *   3. Batch-propagates chain scores bottom-up
 *
 * Prerequisites:
 *   - TruthRegistryV2, TruthToken, TruthStaking, TruthDAG deployed
 *   - Deployer has minter role on TruthToken
 *   - DEPLOYER_PRIVATE_KEY set in env (or hardhat local signer)
 *   - Env vars: TRUTH_TOKEN_ADDRESS, TRUTH_REGISTRY_V2_ADDRESS,
 *               TRUTH_STAKING_ADDRESS, TRUTH_DAG_ADDRESS
 *
 * Usage:
 *   npx hardhat run scripts/backfill-edges.js --network base_sepolia
 *   npx hardhat run scripts/backfill-edges.js --network localhost
 */

const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

const CHAINS_DIR = path.join(__dirname, "..", "agent-toolkit", "chains");
const OUTPUT_DIR = path.join(__dirname, "..", "agent-toolkit", "output");

// Edge type enum matching TruthDAG.sol
const EDGE_TYPE = { depends: 0, supports: 1, contradicts: 2 };

async function main() {
  console.log("=== TruthSea DAG Backfill ===");
  console.log("Network:", hre.network.name);

  const [deployer] = await hre.ethers.getSigners();
  console.log("Deployer:", deployer.address);

  // ── Load contracts ──
  const TOKEN_ADDR = process.env.TRUTH_TOKEN_ADDRESS;
  const REGISTRY_ADDR = process.env.TRUTH_REGISTRY_V2_ADDRESS;
  const STAKING_ADDR = process.env.TRUTH_STAKING_ADDRESS;
  const DAG_ADDR = process.env.TRUTH_DAG_ADDRESS;

  if (!TOKEN_ADDR || !REGISTRY_ADDR || !STAKING_ADDR || !DAG_ADDR) {
    console.error("ERROR: Set all contract addresses in .env:");
    console.error("  TRUTH_TOKEN_ADDRESS, TRUTH_REGISTRY_V2_ADDRESS,");
    console.error("  TRUTH_STAKING_ADDRESS, TRUTH_DAG_ADDRESS");
    process.exit(1);
  }

  const registry = await hre.ethers.getContractAt("TruthRegistryV2", REGISTRY_ADDR);
  const token = await hre.ethers.getContractAt("TruthToken", TOKEN_ADDR);
  const staking = await hre.ethers.getContractAt("TruthStaking", STAKING_ADDR);
  const dag = await hre.ethers.getContractAt("TruthDAG", DAG_ADDR);

  console.log("Registry:", REGISTRY_ADDR);
  console.log("TruthDAG:", DAG_ADDR);
  console.log("TruthStaking:", STAKING_ADDR);

  // ── Phase 1: Load all quanta from JSONL files ──
  console.log("\n[Phase 1] Loading quanta from JSONL files...");

  const quantaById = new Map(); // nodeId -> quanta data
  const jsonlFiles = fs.readdirSync(OUTPUT_DIR).filter((f) => f.endsWith(".jsonl"));

  for (const file of jsonlFiles) {
    const lines = fs
      .readFileSync(path.join(OUTPUT_DIR, file), "utf-8")
      .split("\n")
      .filter((l) => l.trim());
    for (const line of lines) {
      const q = JSON.parse(line);
      quantaById.set(q.id, q);
    }
  }

  console.log(`Loaded ${quantaById.size} quanta from ${jsonlFiles.length} chain files.`);

  // ── Phase 2: Submit quanta to registry ──
  console.log("\n[Phase 2] Submitting quanta to TruthRegistryV2...");

  const nodeToOnChainId = new Map(); // nodeId -> on-chain quantumId

  // Check how many quanta are already on-chain
  const nextQId = Number(await registry.nextQuantumId());
  console.log(`Registry has ${nextQId} existing quanta.`);

  // Try to match existing on-chain quanta to node IDs by claim text
  for (let i = 0; i < nextQId; i++) {
    try {
      const raw = await registry.getQuantum(i);
      if (raw.host === "0x0000000000000000000000000000000000000000") continue;

      // Match by claim text
      for (const [nodeId, q] of quantaById) {
        if (q.claim === raw.claim && !nodeToOnChainId.has(nodeId)) {
          nodeToOnChainId.set(nodeId, i);
          break;
        }
      }
    } catch {
      continue;
    }
  }

  console.log(`Matched ${nodeToOnChainId.size} existing on-chain quanta.`);

  // Submit missing quanta
  let submitted = 0;
  for (const [nodeId, q] of quantaById) {
    if (nodeToOnChainId.has(nodeId)) continue;

    // Skip alternatives (layer -1) — they are counter-claims, not primary chain nodes
    if (q.layer === -1) continue;

    try {
      // Create evidence CID
      const evidenceHash = hre.ethers.keccak256(
        hre.ethers.toUtf8Bytes(
          JSON.stringify({
            id: q.id,
            evidence: q.evidence || [],
            timestamp: q.timestamp,
          })
        )
      );

      // Scale scores: 0-100 -> 0-10000
      const truthScores = [
        Math.round(q.scores.correspondence * 100),
        Math.round(q.scores.coherence * 100),
        Math.round(q.scores.convergence * 100),
        Math.round(q.scores.pragmatism * 100),
      ];

      // Scale moral vector: -100 to +100 -> -10000 to +10000
      const moralVector = [
        Math.round(q.moralVector.care * 100),
        Math.round(q.moralVector.fairness * 100),
        Math.round(q.moralVector.loyalty * 100),
        Math.round(q.moralVector.authority * 100),
        Math.round(q.moralVector.sanctity * 100),
        Math.round(q.moralVector.liberty * 100),
        Math.round(q.moralVector.epistemicHumility * 100),
        Math.round(q.moralVector.temporalStewardship * 100),
      ];

      const discipline = q.discipline || "General";

      const tx = await registry.createQuantum(
        evidenceHash,
        discipline,
        q.claim,
        truthScores,
        moralVector
      );
      const receipt = await tx.wait();

      // Parse QuantumCreated event to get ID
      const event = receipt.logs.find(
        (log) => log.fragment?.name === "QuantumCreated"
      );
      const onChainId = event ? Number(event.args[0]) : Number(await registry.nextQuantumId()) - 1;

      nodeToOnChainId.set(nodeId, onChainId);
      submitted++;

      if (submitted % 10 === 0) {
        console.log(`  Submitted ${submitted} quanta... (latest: #${onChainId} "${q.claim.substring(0, 60)}...")`);
      }
    } catch (err) {
      console.error(`  Failed to submit ${nodeId}: ${err.message}`);
    }
  }

  console.log(`Submitted ${submitted} new quanta. Total mapped: ${nodeToOnChainId.size}.`);

  // ── Phase 3: Create edges ──
  console.log("\n[Phase 3] Creating edges on TruthDAG...");

  const chainFiles = fs.readdirSync(CHAINS_DIR).filter((f) => f.endsWith(".json"));
  const minEdgeStake = await dag.minEdgeStake();

  // Approve TruthStaking to spend our TRUTH tokens (large allowance)
  const allowance = await token.allowance(deployer.address, STAKING_ADDR);
  if (allowance < hre.ethers.parseEther("100000")) {
    console.log("  Approving TruthStaking to spend TRUTH tokens...");
    const approveTx = await token.approve(STAKING_ADDR, hre.ethers.MaxUint256);
    await approveTx.wait();
  }

  let edgesCreated = 0;
  let edgesSkipped = 0;
  const allEdges = []; // for tracking propagation order

  for (const file of chainFiles) {
    const chain = JSON.parse(fs.readFileSync(path.join(CHAINS_DIR, file), "utf-8"));
    console.log(`\n  Chain: ${chain.name} (${chain.edges.length} edges)`);

    for (const edge of chain.edges) {
      const sourceOnChainId = nodeToOnChainId.get(edge.source);
      const targetOnChainId = nodeToOnChainId.get(edge.target);

      if (sourceOnChainId === undefined || targetOnChainId === undefined) {
        edgesSkipped++;
        continue;
      }

      const edgeType = EDGE_TYPE[edge.type] ?? 0;

      // Check if edge already exists
      const edgeKey = hre.ethers.keccak256(
        hre.ethers.AbiCoder.defaultAbiCoder().encode(
          ["uint256", "uint256", "uint8"],
          [sourceOnChainId, targetOnChainId, edgeType]
        )
      );

      const exists = await dag.edgeExists(edgeKey);
      if (exists) {
        edgesSkipped++;
        continue;
      }

      try {
        // Get next edge ID for stake key
        const nextEdgeId = Number(await dag.nextEdgeId());
        const stakeKey = hre.ethers.keccak256(
          hre.ethers.AbiCoder.defaultAbiCoder().encode(
            ["string", "uint256"],
            ["edge", nextEdgeId]
          )
        );

        // Stake TRUTH for this edge
        const stakeTx = await staking.stake(stakeKey, minEdgeStake);
        await stakeTx.wait();

        // Create evidence CID
        const evidenceCid = hre.ethers.keccak256(
          hre.ethers.toUtf8Bytes(
            JSON.stringify({
              chain: chain.id,
              source: edge.source,
              target: edge.target,
              type: edge.type,
            })
          )
        );

        // Default confidence: 90% for depends, 80% for supports, 70% for contradicts
        const confidence =
          edgeType === 0 ? 9000 : edgeType === 1 ? 8000 : 7000;

        const tx = await dag.createEdge(
          sourceOnChainId,
          targetOnChainId,
          edgeType,
          evidenceCid,
          confidence
        );
        await tx.wait();

        edgesCreated++;
        allEdges.push({
          sourceOnChainId,
          targetOnChainId,
          edgeType,
        });

        if (edgesCreated % 10 === 0) {
          console.log(`    Created ${edgesCreated} edges...`);
        }
      } catch (err) {
        console.error(`    Failed edge ${edge.source} -> ${edge.target}: ${err.message}`);
        edgesSkipped++;
      }
    }
  }

  console.log(`\nEdges created: ${edgesCreated}, skipped: ${edgesSkipped}`);

  // ── Phase 4: Propagate scores bottom-up ──
  console.log("\n[Phase 4] Propagating chain scores...");

  // Build layers from JSONL data (layer field)
  const layerMap = new Map(); // layer number -> [onChainId]
  for (const [nodeId, q] of quantaById) {
    if (q.layer === -1) continue; // skip alternatives
    const onChainId = nodeToOnChainId.get(nodeId);
    if (onChainId === undefined) continue;

    const layer = q.layer || 0;
    if (!layerMap.has(layer)) layerMap.set(layer, []);
    layerMap.get(layer).push(onChainId);
  }

  // Sort layers and propagate bottom-up
  const sortedLayers = Array.from(layerMap.keys()).sort((a, b) => a - b);
  console.log(`Layers: ${sortedLayers.join(", ")}`);

  for (const layer of sortedLayers) {
    const ids = layerMap.get(layer);
    console.log(`  Layer ${layer}: ${ids.length} quanta`);

    // Batch propagate in groups of 10 to avoid gas limits
    for (let i = 0; i < ids.length; i += 10) {
      const batch = ids.slice(i, i + 10);
      try {
        const tx = await dag.batchPropagateScores(batch);
        await tx.wait();
        console.log(`    Propagated batch ${Math.floor(i / 10) + 1} (${batch.length} quanta)`);
      } catch (err) {
        // Fall back to individual propagation
        for (const id of batch) {
          try {
            const tx = await dag.propagateScore(id);
            await tx.wait();
          } catch (innerErr) {
            console.error(`    Failed to propagate quantum #${id}: ${innerErr.message}`);
          }
        }
      }
    }
  }

  // ── Summary ──
  console.log("\n=== Backfill Complete ===");
  console.log(`Quanta loaded:    ${quantaById.size}`);
  console.log(`Quanta submitted: ${submitted}`);
  console.log(`Quanta mapped:    ${nodeToOnChainId.size}`);
  console.log(`Edges created:    ${edgesCreated}`);
  console.log(`Edges skipped:    ${edgesSkipped}`);
  console.log(`Layers propagated: ${sortedLayers.length}`);

  // Output mapping for reference
  const mappingPath = path.join(__dirname, "..", "agent-toolkit", "onchain-mapping.json");
  const mapping = {};
  for (const [nodeId, onChainId] of nodeToOnChainId) {
    mapping[nodeId] = onChainId;
  }
  fs.writeFileSync(mappingPath, JSON.stringify(mapping, null, 2));
  console.log(`\nMapping saved to: ${mappingPath}`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
