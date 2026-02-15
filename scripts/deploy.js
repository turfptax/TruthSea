const hre = require("hardhat");

async function main() {
  console.log("=== TruthSea Deployment ===");
  console.log("Network:", hre.network.name);

  // ── Step 1: Deploy TruthToken ──
  console.log("\n[1/3] Deploying TruthToken...");
  const TruthToken = await hre.ethers.getContractFactory("TruthToken");
  const token = await TruthToken.deploy();
  await token.waitForDeployment();
  const tokenAddress = await token.getAddress();
  console.log("TruthToken deployed to:", tokenAddress);

  // ── Step 2: Deploy TruthRegistry ──
  console.log("\n[2/3] Deploying TruthRegistry...");
  const TruthRegistry = await hre.ethers.getContractFactory("TruthRegistry");
  const registry = await TruthRegistry.deploy(tokenAddress);
  await registry.waitForDeployment();
  const registryAddress = await registry.getAddress();
  console.log("TruthRegistry deployed to:", registryAddress);

  // ── Step 3: Grant minter role ──
  console.log("\n[3/3] Granting TruthRegistry minter role on TruthToken...");
  const tx = await token.setMinter(registryAddress, true);
  await tx.wait();
  console.log("Minter role granted.");

  // Verify on non-local networks
  if (hre.network.name !== "hardhat") {
    console.log("\nWaiting for confirmations...");
    await token.deploymentTransaction().wait(5);
    await registry.deploymentTransaction().wait(5);

    console.log("Verifying TruthToken...");
    try {
      await hre.run("verify:verify", {
        address: tokenAddress,
        constructorArguments: [],
      });
      console.log("TruthToken verified!");
    } catch (err) {
      console.log("Verification failed (may already be verified):", err.message);
    }

    console.log("Verifying TruthRegistry...");
    try {
      await hre.run("verify:verify", {
        address: registryAddress,
        constructorArguments: [tokenAddress],
      });
      console.log("TruthRegistry verified!");
    } catch (err) {
      console.log("Verification failed (may already be verified):", err.message);
    }
  }

  console.log("\n=== Deployment Summary ===");
  console.log("TRUTH_TOKEN_ADDRESS=" + tokenAddress);
  console.log("TRUTH_REGISTRY_ADDRESS=" + registryAddress);
  console.log("\nAdd these to your .env file.");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
