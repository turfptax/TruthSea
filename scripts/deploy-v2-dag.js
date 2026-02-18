const hre = require("hardhat");

async function main() {
  console.log("=== TruthSea v2 DAG Deployment ===");
  console.log("Network:", hre.network.name);

  const [deployer] = await hre.ethers.getSigners();
  console.log("Deployer:", deployer.address);
  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log("Balance:", hre.ethers.formatEther(balance), "ETH\n");

  // ── Existing contract addresses (from .env or hardcoded for testnet) ──
  const TOKEN_ADDR = process.env.TRUTH_TOKEN_ADDRESS;
  const REGISTRY_ADDR = process.env.TRUTH_REGISTRY_V2_ADDRESS;

  if (!TOKEN_ADDR || !REGISTRY_ADDR) {
    console.error("ERROR: Set TRUTH_TOKEN_ADDRESS and TRUTH_REGISTRY_V2_ADDRESS in .env");
    console.error("These are the existing deployed V1 contracts that the DAG will integrate with.");
    process.exit(1);
  }

  console.log("Existing TruthToken:", TOKEN_ADDR);
  console.log("Existing TruthRegistryV2:", REGISTRY_ADDR);

  // ── Step 1: Deploy TruthStaking ──
  console.log("\n[1/3] Deploying TruthStaking...");
  const StakingFactory = await hre.ethers.getContractFactory("TruthStaking");
  const staking = await StakingFactory.deploy(TOKEN_ADDR);
  await staking.waitForDeployment();
  const stakingAddress = await staking.getAddress();
  console.log("TruthStaking deployed to:", stakingAddress);

  // ── Step 2: Deploy TruthDAG ──
  console.log("\n[2/3] Deploying TruthDAG...");
  const DAGFactory = await hre.ethers.getContractFactory("TruthDAG");
  const dag = await DAGFactory.deploy(REGISTRY_ADDR, TOKEN_ADDR, stakingAddress);
  await dag.waitForDeployment();
  const dagAddress = await dag.getAddress();
  console.log("TruthDAG deployed to:", dagAddress);

  // ── Step 3: Grant permissions ──
  console.log("\n[3/3] Granting permissions...");

  // Grant TruthDAG as minter on TruthToken
  const token = await hre.ethers.getContractAt("TruthToken", TOKEN_ADDR);
  const tx1 = await token.setMinter(dagAddress, true);
  await tx1.wait();
  console.log("TruthDAG granted minter role on TruthToken.");

  // Authorize TruthDAG on TruthStaking
  const tx2 = await staking.setAuthorized(dagAddress, true);
  await tx2.wait();
  console.log("TruthDAG authorized on TruthStaking.");

  // Verify on non-local networks
  if (hre.network.name !== "hardhat" && hre.network.name !== "localhost") {
    console.log("\nWaiting for confirmations before verification...");
    await new Promise((r) => setTimeout(r, 15000));

    const contracts = [
      { name: "TruthStaking", address: stakingAddress, args: [TOKEN_ADDR] },
      { name: "TruthDAG", address: dagAddress, args: [REGISTRY_ADDR, TOKEN_ADDR, stakingAddress] },
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

  console.log("\n=== v2 DAG Deployment Summary ===");
  console.log("Network:                     ", hre.network.name);
  console.log("TRUTH_STAKING_ADDRESS=       ", stakingAddress);
  console.log("TRUTH_DAG_ADDRESS=           ", dagAddress);
  console.log("(Using existing Token:       ", TOKEN_ADDR, ")");
  console.log("(Using existing Registry:    ", REGISTRY_ADDR, ")");
  console.log("\nSave these addresses! Add them to your .env.");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
