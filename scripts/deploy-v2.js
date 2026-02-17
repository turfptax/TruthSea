const hre = require("hardhat");

async function main() {
  console.log("=== TruthSea v2 Deployment ===");
  console.log("Network:", hre.network.name);

  const [deployer] = await hre.ethers.getSigners();
  console.log("Deployer:", deployer.address);
  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log("Balance:", hre.ethers.formatEther(balance), "ETH\n");

  // ── Step 1: Deploy fresh TruthToken ──
  console.log("[1/4] Deploying TruthToken...");
  const TruthToken = await hre.ethers.getContractFactory("TruthToken");
  const token = await TruthToken.deploy();
  await token.waitForDeployment();
  const tokenAddress = await token.getAddress();
  console.log("TruthToken deployed to:", tokenAddress);

  // ── Step 2: Deploy TruthRegistryV2 ──
  console.log("\n[2/4] Deploying TruthRegistryV2...");
  const TruthRegistryV2 = await hre.ethers.getContractFactory("TruthRegistryV2");
  const registry = await TruthRegistryV2.deploy(tokenAddress);
  await registry.waitForDeployment();
  const registryAddress = await registry.getAddress();
  console.log("TruthRegistryV2 deployed to:", registryAddress);

  // ── Step 3: Deploy BountyBridge ──
  console.log("\n[3/4] Deploying BountyBridge...");
  const BountyBridge = await hre.ethers.getContractFactory("BountyBridge");
  const bridge = await BountyBridge.deploy(registryAddress);
  await bridge.waitForDeployment();
  const bridgeAddress = await bridge.getAddress();
  console.log("BountyBridge deployed to:", bridgeAddress);

  // ── Step 4: Grant minter roles ──
  console.log("\n[4/4] Granting minter roles...");
  const tx = await token.setMinter(registryAddress, true);
  await tx.wait();
  console.log("TruthRegistryV2 granted minter role on TruthToken.");

  // Verify on non-local networks
  if (hre.network.name !== "hardhat" && hre.network.name !== "localhost") {
    console.log("\nWaiting for confirmations before verification...");
    // Wait for a few blocks
    await new Promise((r) => setTimeout(r, 15000));

    const contracts = [
      { name: "TruthToken", address: tokenAddress, args: [] },
      { name: "TruthRegistryV2", address: registryAddress, args: [tokenAddress] },
      { name: "BountyBridge", address: bridgeAddress, args: [registryAddress] },
    ];

    for (const c of contracts) {
      console.log(`\nVerifying ${c.name}...`);
      try {
        await hre.run("verify:verify", {
          address: c.address,
          constructorArguments: c.args,
        });
        console.log(`${c.name} verified!`);
      } catch (err) {
        console.log(`Verification note: ${err.message}`);
      }
    }
  }

  console.log("\n=== v2 Deployment Summary ===");
  console.log("Network:                   ", hre.network.name);
  console.log("TRUTH_TOKEN_ADDRESS=       ", tokenAddress);
  console.log("TRUTH_REGISTRY_V2_ADDRESS= ", registryAddress);
  console.log("BOUNTY_BRIDGE_ADDRESS=     ", bridgeAddress);
  console.log("\nSave these addresses! Add them to your .env under the correct network section.");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
