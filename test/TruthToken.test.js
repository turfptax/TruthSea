const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("TruthToken", function () {
  let token, owner, minter, user1, user2;
  const ONE_TRUTH = ethers.parseEther("1.0");
  const HUNDRED_TRUTH = ethers.parseEther("100.0");

  beforeEach(async () => {
    [owner, minter, user1, user2] = await ethers.getSigners();
    const Factory = await ethers.getContractFactory("TruthToken");
    token = await Factory.deploy();
    await token.setMinter(minter.address, true);
  });

  // ── Deployment ─────────────────────────────────────
  describe("deployment", () => {
    it("has correct name and symbol", async () => {
      expect(await token.name()).to.equal("Truth");
      expect(await token.symbol()).to.equal("TRUTH");
    });

    it("sets MAX_SUPPLY to 1 billion", async () => {
      expect(await token.MAX_SUPPLY()).to.equal(ethers.parseEther("1000000000"));
    });

    it("records deployedAt timestamp", async () => {
      const deployedAt = await token.deployedAt();
      expect(deployedAt).to.be.gt(0);
    });

    it("starts with zero minted and burned", async () => {
      expect(await token.totalMinted()).to.equal(0);
      expect(await token.totalBurned()).to.equal(0);
    });

    it("deployer is the owner", async () => {
      expect(await token.owner()).to.equal(owner.address);
    });
  });

  // ── Minter Management ─────────────────────────────
  describe("setMinter", () => {
    it("owner can add a minter", async () => {
      await expect(token.setMinter(user1.address, true))
        .to.emit(token, "MinterUpdated")
        .withArgs(user1.address, true);
      expect(await token.minters(user1.address)).to.equal(true);
    });

    it("owner can remove a minter", async () => {
      await token.setMinter(user1.address, true);
      await expect(token.setMinter(user1.address, false))
        .to.emit(token, "MinterUpdated")
        .withArgs(user1.address, false);
      expect(await token.minters(user1.address)).to.equal(false);
    });

    it("non-owner cannot set minter", async () => {
      await expect(token.connect(user1).setMinter(user2.address, true))
        .to.be.revertedWithCustomError(token, "OwnableUnauthorizedAccount");
    });
  });

  // ── Minting ────────────────────────────────────────
  describe("mint", () => {
    it("minter can mint tokens", async () => {
      await token.connect(minter).mint(user1.address, HUNDRED_TRUTH, "quantum-host");
      expect(await token.balanceOf(user1.address)).to.equal(HUNDRED_TRUTH);
    });

    it("emits TruthMinted event", async () => {
      await expect(token.connect(minter).mint(user1.address, HUNDRED_TRUTH, "quantum-host"))
        .to.emit(token, "TruthMinted")
        .withArgs(user1.address, HUNDRED_TRUTH, "quantum-host");
    });

    it("increments totalMinted", async () => {
      await token.connect(minter).mint(user1.address, HUNDRED_TRUTH, "test");
      expect(await token.totalMinted()).to.equal(HUNDRED_TRUTH);
    });

    it("non-minter cannot mint", async () => {
      await expect(token.connect(user1).mint(user2.address, ONE_TRUTH, "test"))
        .to.be.revertedWith("Not a minter");
    });

    it("reverts if minting would exceed MAX_SUPPLY", async () => {
      const maxSupply = await token.MAX_SUPPLY();
      await token.connect(minter).mint(user1.address, maxSupply, "fill");
      await expect(token.connect(minter).mint(user1.address, 1, "overflow"))
        .to.be.revertedWith("Exceeds max supply");
    });
  });

  // ── Burning ────────────────────────────────────────
  describe("burn", () => {
    beforeEach(async () => {
      await token.connect(minter).mint(user1.address, HUNDRED_TRUTH, "setup");
    });

    it("holder can burn their own tokens", async () => {
      await token.connect(user1).burn(ONE_TRUTH, "query-fee");
      expect(await token.balanceOf(user1.address)).to.equal(HUNDRED_TRUTH - ONE_TRUTH);
    });

    it("emits TruthBurned event", async () => {
      await expect(token.connect(user1).burn(ONE_TRUTH, "query-fee"))
        .to.emit(token, "TruthBurned")
        .withArgs(user1.address, ONE_TRUTH, "query-fee");
    });

    it("increments totalBurned", async () => {
      await token.connect(user1).burn(ONE_TRUTH, "test");
      expect(await token.totalBurned()).to.equal(ONE_TRUTH);
    });

    it("reverts if burning more than balance", async () => {
      const tooMuch = HUNDRED_TRUTH + ONE_TRUTH;
      await expect(token.connect(user1).burn(tooMuch, "test"))
        .to.be.reverted;
    });
  });

  // ── Slashing ───────────────────────────────────────
  describe("slash", () => {
    beforeEach(async () => {
      await token.connect(minter).mint(user1.address, HUNDRED_TRUTH, "setup");
    });

    it("minter can slash at minimum (5%)", async () => {
      const expectedSlash = (HUNDRED_TRUTH * 500n) / 10000n; // 5 TRUTH
      await expect(token.connect(minter).slash(user1.address, 500))
        .to.emit(token, "TruthSlashed")
        .withArgs(user1.address, expectedSlash, 500);

      expect(await token.balanceOf(user1.address)).to.equal(HUNDRED_TRUTH - expectedSlash);
    });

    it("minter can slash at maximum (20%)", async () => {
      const expectedSlash = (HUNDRED_TRUTH * 2000n) / 10000n; // 20 TRUTH
      await token.connect(minter).slash(user1.address, 2000);
      expect(await token.balanceOf(user1.address)).to.equal(HUNDRED_TRUTH - expectedSlash);
    });

    it("increments totalBurned on slash", async () => {
      await token.connect(minter).slash(user1.address, 1000);
      const expectedSlash = (HUNDRED_TRUTH * 1000n) / 10000n;
      expect(await token.totalBurned()).to.equal(expectedSlash);
    });

    it("reverts if bps below minimum (500)", async () => {
      await expect(token.connect(minter).slash(user1.address, 499))
        .to.be.revertedWith("Invalid slash bps");
    });

    it("reverts if bps above maximum (2000)", async () => {
      await expect(token.connect(minter).slash(user1.address, 2001))
        .to.be.revertedWith("Invalid slash bps");
    });

    it("non-minter cannot slash", async () => {
      await expect(token.connect(user2).slash(user1.address, 500))
        .to.be.revertedWith("Not a minter");
    });
  });

  // ── Halving / Era ──────────────────────────────────
  describe("halving", () => {
    it("currentEra is 0 at deploy", async () => {
      expect(await token.currentEra()).to.equal(0);
    });

    it("eraEmissionCap is 400M in era 0", async () => {
      expect(await token.eraEmissionCap()).to.equal(ethers.parseEther("400000000"));
    });

    it("era advances to 1 after 4 years", async () => {
      await time.increase(4 * 365 * 24 * 60 * 60); // 4 years
      expect(await token.currentEra()).to.equal(1);
    });

    it("eraEmissionCap halves to 200M in era 1", async () => {
      await time.increase(4 * 365 * 24 * 60 * 60);
      expect(await token.eraEmissionCap()).to.equal(ethers.parseEther("200000000"));
    });
  });
});
