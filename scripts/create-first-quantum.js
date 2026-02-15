const hre = require("hardhat");

/**
 * Creates the first truth quantum on the TruthRegistry.
 *
 * This is the founding claim of the Truth Quantization protocol —
 * a statement about truth itself, scored across the 4 epistemological pillars.
 *
 * Usage:
 *   npx hardhat run scripts/create-first-quantum.js --network amoy
 */
async function main() {
  const registryAddress = process.env.TRUTH_REGISTRY_ADDRESS;
  if (!registryAddress) {
    console.error("TRUTH_REGISTRY_ADDRESS not set in .env");
    process.exit(1);
  }

  console.log("=== Creating First Truth Quantum ===");
  console.log("Network:", hre.network.name);
  console.log("Registry:", registryAddress);

  const registry = await hre.ethers.getContractAt("TruthRegistry", registryAddress);
  const tokenAddress = await registry.truthToken();
  const token = await hre.ethers.getContractAt("TruthToken", tokenAddress);

  // ── The founding claim ──
  // A placeholder CID (in production this would be a real IPFS content hash)
  const ipfsCid = hre.ethers.encodeBytes32String("TQ-GENESIS-QUANTUM-001");
  const discipline = "Epistemology";
  const claim = "Truth is not binary but exists on a spectrum that can be measured across multiple philosophical frameworks";
  const scores = {
    correspondence: 7500,  // 0.75 — partially mappable to observable reality
    coherence: 8500,       // 0.85 — logically consistent with epistemological theory
    pragmatism: 8000,      // 0.80 — practically useful for building verification systems
    relativism: 7000,      // 0.70 — acknowledged cultural variance in truth perception
  };

  console.log("\nClaim:", claim);
  console.log("Discipline:", discipline);
  console.log("Scores:", scores);

  // ── Create the quantum ──
  console.log("\nSubmitting transaction...");
  const tx = await registry.createQuantum(ipfsCid, discipline, claim, scores);
  const receipt = await tx.wait();
  console.log("Transaction hash:", tx.hash);

  // ── Read it back ──
  const quantumId = await registry.nextQuantumId() - 1n;
  const quantum = await registry.getQuantum(quantumId);
  const aggregate = await registry.aggregateScore(quantumId);

  console.log("\n=== Quantum #" + quantumId + " Created ===");
  console.log("Host:", quantum.host);
  console.log("Discipline:", quantum.discipline);
  console.log("Claim:", quantum.claim);
  console.log("Status:", ["Active", "Disputed", "Archived", "Forked"][Number(quantum.status)]);
  console.log("Pillar Scores:");
  console.log("  Correspondence:", Number(quantum.scores.correspondence) / 100 + "%");
  console.log("  Coherence:     ", Number(quantum.scores.coherence) / 100 + "%");
  console.log("  Pragmatism:    ", Number(quantum.scores.pragmatism) / 100 + "%");
  console.log("  Relativism:    ", Number(quantum.scores.relativism) / 100 + "%");
  console.log("Aggregate Score:", Number(aggregate) / 100 + "%");
  console.log("Consensus Threshold: 70%", Number(aggregate) >= 7000 ? "✅ MEETS" : "❌ BELOW");

  // ── Check TRUTH balance ──
  const [deployer] = await hre.ethers.getSigners();
  const truthBalance = await token.balanceOf(deployer.address);
  console.log("\nHost TRUTH balance:", hre.ethers.formatEther(truthBalance), "TRUTH");

  if (hre.network.name !== "hardhat") {
    console.log("\nView on Polygonscan:");
    console.log("https://amoy.polygonscan.com/tx/" + tx.hash);
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
