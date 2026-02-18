const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("TruthStaking", function () {
  let token, staking, owner, user1, user2, authorizedContract;

  const STAKE_AMOUNT = ethers.parseEther("100");
  const STAKE_KEY = ethers.keccak256(ethers.AbiCoder.defaultAbiCoder().encode(["string", "uint256"], ["edge", 0]));

  beforeEach(async () => {
    [owner, user1, user2, authorizedContract] = await ethers.getSigners();

    const TokenFactory = await ethers.getContractFactory("TruthToken");
    token = await TokenFactory.deploy();

    const StakingFactory = await ethers.getContractFactory("TruthStaking");
    staking = await StakingFactory.deploy(await token.getAddress());

    // Grant token minter to owner for test setup
    await token.setMinter(owner.address, true);

    // Mint tokens to user1 for staking
    await token.mint(user1.address, ethers.parseEther("1000"), "test-setup");

    // Authorize the mock contract
    await staking.setAuthorized(authorizedContract.address, true);

    // User1 approves staking contract
    await token.connect(user1).approve(await staking.getAddress(), ethers.MaxUint256);
  });

  // ── Deployment ────────────────────────────────────
  describe("deployment", () => {
    it("links to the correct TruthToken", async () => {
      expect(await staking.truthToken()).to.equal(await token.getAddress());
    });

    it("deployer is the owner", async () => {
      expect(await staking.owner()).to.equal(owner.address);
    });
  });

  // ── Staking ───────────────────────────────────────
  describe("stake", () => {
    it("stakes tokens and records the amount", async () => {
      await staking.connect(user1).stake(STAKE_KEY, STAKE_AMOUNT);
      expect(await staking.getStake(user1.address, STAKE_KEY)).to.equal(STAKE_AMOUNT);
    });

    it("transfers tokens from user to staking contract", async () => {
      const balBefore = await token.balanceOf(user1.address);
      await staking.connect(user1).stake(STAKE_KEY, STAKE_AMOUNT);
      const balAfter = await token.balanceOf(user1.address);
      expect(balBefore - balAfter).to.equal(STAKE_AMOUNT);
    });

    it("emits Staked event", async () => {
      await expect(staking.connect(user1).stake(STAKE_KEY, STAKE_AMOUNT))
        .to.emit(staking, "Staked")
        .withArgs(user1.address, STAKE_KEY, STAKE_AMOUNT);
    });

    it("reverts on zero amount", async () => {
      await expect(staking.connect(user1).stake(STAKE_KEY, 0))
        .to.be.revertedWith("Zero amount");
    });

    it("allows multiple stakes on different keys", async () => {
      const key2 = ethers.keccak256(ethers.AbiCoder.defaultAbiCoder().encode(["string", "uint256"], ["edge", 1]));
      await staking.connect(user1).stake(STAKE_KEY, STAKE_AMOUNT);
      await staking.connect(user1).stake(key2, STAKE_AMOUNT);
      expect(await staking.getStake(user1.address, STAKE_KEY)).to.equal(STAKE_AMOUNT);
      expect(await staking.getStake(user1.address, key2)).to.equal(STAKE_AMOUNT);
    });

    it("accumulates stakes on the same key", async () => {
      await staking.connect(user1).stake(STAKE_KEY, STAKE_AMOUNT);
      await staking.connect(user1).stake(STAKE_KEY, STAKE_AMOUNT);
      expect(await staking.getStake(user1.address, STAKE_KEY)).to.equal(STAKE_AMOUNT * 2n);
    });
  });

  // ── Unstaking ─────────────────────────────────────
  describe("unstake", () => {
    beforeEach(async () => {
      await staking.connect(user1).stake(STAKE_KEY, STAKE_AMOUNT);
    });

    it("returns tokens to user", async () => {
      const balBefore = await token.balanceOf(user1.address);
      await staking.connect(user1).unstake(STAKE_KEY);
      const balAfter = await token.balanceOf(user1.address);
      expect(balAfter - balBefore).to.equal(STAKE_AMOUNT);
    });

    it("clears the stake record", async () => {
      await staking.connect(user1).unstake(STAKE_KEY);
      expect(await staking.getStake(user1.address, STAKE_KEY)).to.equal(0);
    });

    it("emits Unstaked event", async () => {
      await expect(staking.connect(user1).unstake(STAKE_KEY))
        .to.emit(staking, "Unstaked")
        .withArgs(user1.address, STAKE_KEY, STAKE_AMOUNT);
    });

    it("reverts if stake is locked", async () => {
      await staking.connect(authorizedContract).lockStake(user1.address, STAKE_KEY);
      await expect(staking.connect(user1).unstake(STAKE_KEY))
        .to.be.revertedWith("Stake is locked");
    });

    it("reverts if no stake exists", async () => {
      const emptyKey = ethers.keccak256(ethers.toUtf8Bytes("nonexistent"));
      await expect(staking.connect(user1).unstake(emptyKey))
        .to.be.revertedWith("No stake");
    });
  });

  // ── Authorized Operations ─────────────────────────
  describe("authorized operations", () => {
    beforeEach(async () => {
      await staking.connect(user1).stake(STAKE_KEY, STAKE_AMOUNT);
    });

    it("authorized contract can lock stake", async () => {
      await staking.connect(authorizedContract).lockStake(user1.address, STAKE_KEY);
      expect(await staking.isLocked(user1.address, STAKE_KEY)).to.be.true;
    });

    it("authorized contract can unlock stake", async () => {
      await staking.connect(authorizedContract).lockStake(user1.address, STAKE_KEY);
      await staking.connect(authorizedContract).unlockStake(user1.address, STAKE_KEY);
      expect(await staking.isLocked(user1.address, STAKE_KEY)).to.be.false;
    });

    it("authorized contract can slash stake", async () => {
      await staking.connect(authorizedContract).slash(user1.address, STAKE_KEY, 1000); // 10%
      const remaining = await staking.getStake(user1.address, STAKE_KEY);
      expect(remaining).to.equal(STAKE_AMOUNT - (STAKE_AMOUNT * 1000n / 10000n));
    });

    it("slash emits Slashed event", async () => {
      const slashAmount = STAKE_AMOUNT * 1000n / 10000n;
      await expect(staking.connect(authorizedContract).slash(user1.address, STAKE_KEY, 1000))
        .to.emit(staking, "Slashed")
        .withArgs(user1.address, STAKE_KEY, slashAmount, authorizedContract.address);
    });

    it("authorized contract can transfer stake to another address", async () => {
      const transferAmount = ethers.parseEther("50");
      await staking.connect(authorizedContract).transferStake(user1.address, STAKE_KEY, user2.address, transferAmount);
      expect(await staking.getStake(user1.address, STAKE_KEY)).to.equal(STAKE_AMOUNT - transferAmount);
      expect(await token.balanceOf(user2.address)).to.equal(transferAmount);
    });

    it("authorized contract can refund full stake", async () => {
      await staking.connect(authorizedContract).lockStake(user1.address, STAKE_KEY);
      const balBefore = await token.balanceOf(user1.address);
      await staking.connect(authorizedContract).refundStake(user1.address, STAKE_KEY);
      const balAfter = await token.balanceOf(user1.address);
      expect(balAfter - balBefore).to.equal(STAKE_AMOUNT);
      expect(await staking.getStake(user1.address, STAKE_KEY)).to.equal(0);
      expect(await staking.isLocked(user1.address, STAKE_KEY)).to.be.false;
    });

    it("unauthorized address cannot lock stake", async () => {
      await expect(staking.connect(user2).lockStake(user1.address, STAKE_KEY))
        .to.be.revertedWith("Not authorized");
    });

    it("unauthorized address cannot slash", async () => {
      await expect(staking.connect(user2).slash(user1.address, STAKE_KEY, 1000))
        .to.be.revertedWith("Not authorized");
    });

    it("unauthorized address cannot transfer stake", async () => {
      await expect(staking.connect(user2).transferStake(user1.address, STAKE_KEY, user2.address, STAKE_AMOUNT))
        .to.be.revertedWith("Not authorized");
    });
  });

  // ── Admin ─────────────────────────────────────────
  describe("admin", () => {
    it("owner can set authorized", async () => {
      await expect(staking.setAuthorized(user2.address, true))
        .to.emit(staking, "AuthorizationUpdated")
        .withArgs(user2.address, true);
      expect(await staking.authorized(user2.address)).to.be.true;
    });

    it("non-owner cannot set authorized", async () => {
      await expect(staking.connect(user1).setAuthorized(user2.address, true))
        .to.be.revertedWith("Not owner");
    });

    it("owner can transfer ownership", async () => {
      await staking.transferOwnership(user1.address);
      expect(await staking.owner()).to.equal(user1.address);
    });
  });
});
