const hre = require("hardhat");

/**
 * Manual script for minting TRUTH bonus to bounty-truth task completers.
 *
 * Usage:
 *   set RECIPIENT_ADDRESS=0x... && npx hardhat run scripts/mint-bounty-truth-bonus.js --network amoy
 *
 * Requires TRUTH_TOKEN_ADDRESS in .env and the deployer to be the owner
 * (or a minter) on TruthToken.
 */
async function main() {
  const tokenAddress = process.env.TRUTH_TOKEN_ADDRESS;
  const recipient = process.env.RECIPIENT_ADDRESS;
  const amount = hre.ethers.parseEther("50"); // 50 TRUTH bounty-truth bonus

  if (!tokenAddress) {
    console.error("TRUTH_TOKEN_ADDRESS not set in .env");
    process.exit(1);
  }
  if (!recipient) {
    console.error("Set RECIPIENT_ADDRESS env var before running");
    process.exit(1);
  }

  console.log("Network:", hre.network.name);
  console.log("Token:", tokenAddress);
  console.log("Recipient:", recipient);
  console.log("Amount: 50 TRUTH");

  const token = await hre.ethers.getContractAt("TruthToken", tokenAddress);
  const tx = await token.mint(recipient, amount, "bounty-truth-bonus");
  await tx.wait();

  console.log("Minted 50 TRUTH to", recipient);
  console.log("Tx hash:", tx.hash);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
