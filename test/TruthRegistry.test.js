const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("TruthRegistry", function () {
  let token, registry, owner, host, verifier1, verifier2, challenger;

  const SAMPLE_CID = ethers.encodeBytes32String("QmTestCID12345678901");
  const COUNTER_CID = ethers.encodeBytes32String("QmCounterEvidence0001");
  const SCORES = { correspondence: 8000, coherence: 7500, pragmatism: 9000, relativism: 6500 };
  const HOST_REWARD = ethers.parseEther("100");
  const VET_REWARD = ethers.parseEther("10");

  beforeEach(async () => {
    [owner, host, verifier1, verifier2, challenger] = await ethers.getSigners();

    const TokenFactory = await ethers.getContractFactory("TruthToken");
    token = await TokenFactory.deploy();

    const RegistryFactory = await ethers.getContractFactory("TruthRegistry");
    registry = await RegistryFactory.deploy(await token.getAddress());

    // Grant registry the minter role on token
    await token.setMinter(await registry.getAddress(), true);
  });

  // ── Deployment ─────────────────────────────────────
  describe("deployment", () => {
    it("links to the correct TruthToken", async () => {
      expect(await registry.truthToken()).to.equal(await token.getAddress());
    });

    it("deployer is the owner", async () => {
      expect(await registry.owner()).to.equal(owner.address);
    });

    it("nextQuantumId starts at 0", async () => {
      expect(await registry.nextQuantumId()).to.equal(0);
    });

    it("has correct default rewards", async () => {
      expect(await registry.hostReward()).to.equal(HOST_REWARD);
      expect(await registry.vetReward()).to.equal(VET_REWARD);
      expect(await registry.minStake()).to.equal(ethers.parseEther("50"));
    });

    it("CONSENSUS_THRESHOLD is 7000", async () => {
      expect(await registry.CONSENSUS_THRESHOLD()).to.equal(7000);
    });
  });

  // ── Create Quantum ─────────────────────────────────
  describe("createQuantum", () => {
    it("creates a quantum and emits QuantumCreated", async () => {
      await expect(
        registry.connect(host).createQuantum(SAMPLE_CID, "Physics", "Speed of light is constant", SCORES)
      )
        .to.emit(registry, "QuantumCreated")
        .withArgs(0, host.address, SAMPLE_CID, "Physics");
    });

    it("stores quantum with correct fields", async () => {
      await registry.connect(host).createQuantum(SAMPLE_CID, "Physics", "Speed of light is constant", SCORES);
      const q = await registry.getQuantum(0);

      expect(q.id).to.equal(0);
      expect(q.host).to.equal(host.address);
      expect(q.ipfsCid).to.equal(SAMPLE_CID);
      expect(q.discipline).to.equal("Physics");
      expect(q.claim).to.equal("Speed of light is constant");
      expect(q.scores.correspondence).to.equal(8000);
      expect(q.scores.coherence).to.equal(7500);
      expect(q.scores.pragmatism).to.equal(9000);
      expect(q.scores.relativism).to.equal(6500);
      expect(q.status).to.equal(0); // Active
      expect(q.verifierCount).to.equal(0);
    });

    it("mints hostReward (100 TRUTH) to the host", async () => {
      await registry.connect(host).createQuantum(SAMPLE_CID, "Physics", "test claim", SCORES);
      expect(await token.balanceOf(host.address)).to.equal(HOST_REWARD);
    });

    it("increments nextQuantumId", async () => {
      await registry.connect(host).createQuantum(SAMPLE_CID, "A", "claim A", SCORES);
      await registry.connect(host).createQuantum(SAMPLE_CID, "B", "claim B", SCORES);
      expect(await registry.nextQuantumId()).to.equal(2);
    });

    it("reverts on empty CID", async () => {
      await expect(
        registry.connect(host).createQuantum(ethers.ZeroHash, "Physics", "test", SCORES)
      ).to.be.revertedWith("Empty CID");
    });

    it("reverts on empty discipline", async () => {
      await expect(
        registry.connect(host).createQuantum(SAMPLE_CID, "", "test", SCORES)
      ).to.be.revertedWith("Empty discipline");
    });

    it("reverts on empty claim", async () => {
      await expect(
        registry.connect(host).createQuantum(SAMPLE_CID, "Physics", "", SCORES)
      ).to.be.revertedWith("Empty claim");
    });
  });

  // ── Verify ─────────────────────────────────────────
  describe("verify", () => {
    const V_SCORES = { correspondence: 7000, coherence: 8000, pragmatism: 8500, relativism: 7000 };

    beforeEach(async () => {
      await registry.connect(host).createQuantum(SAMPLE_CID, "Physics", "Speed of light is constant", SCORES);
    });

    it("verifier can submit scores and emits QuantumVerified", async () => {
      await expect(registry.connect(verifier1).verify(0, V_SCORES))
        .to.emit(registry, "QuantumVerified");
    });

    it("verifier earns vetReward (10 TRUTH)", async () => {
      await registry.connect(verifier1).verify(0, V_SCORES);
      expect(await token.balanceOf(verifier1.address)).to.equal(VET_REWARD);
    });

    it("increments verifierCount", async () => {
      await registry.connect(verifier1).verify(0, V_SCORES);
      const q = await registry.getQuantum(0);
      expect(q.verifierCount).to.equal(1);
    });

    // NOTE: Known MVP behavior — first verifier overwrites host's initial scores
    // because verifierCount starts at 0, so _avg(current, incoming, 0) = incoming.
    // The host's scores effectively serve as a placeholder until the first verifier.
    it("first verifier replaces initial scores (MVP behavior: verifierCount=0)", async () => {
      await registry.connect(verifier1).verify(0, V_SCORES);
      const q = await registry.getQuantum(0);
      expect(q.scores.correspondence).to.equal(V_SCORES.correspondence);
      expect(q.scores.coherence).to.equal(V_SCORES.coherence);
      expect(q.scores.pragmatism).to.equal(V_SCORES.pragmatism);
      expect(q.scores.relativism).to.equal(V_SCORES.relativism);
    });

    it("second verifier averages with first verifier's scores", async () => {
      await registry.connect(verifier1).verify(0, V_SCORES);

      const V2_SCORES = { correspondence: 9000, coherence: 6000, pragmatism: 7500, relativism: 8000 };
      await registry.connect(verifier2).verify(0, V2_SCORES);

      const q = await registry.getQuantum(0);
      // Rolling average: (old * 1 + new) / 2
      expect(q.scores.correspondence).to.equal(
        Math.floor((V_SCORES.correspondence * 1 + V2_SCORES.correspondence) / 2)
      );
      expect(q.scores.coherence).to.equal(
        Math.floor((V_SCORES.coherence * 1 + V2_SCORES.coherence) / 2)
      );
      expect(q.scores.pragmatism).to.equal(
        Math.floor((V_SCORES.pragmatism * 1 + V2_SCORES.pragmatism) / 2)
      );
      expect(q.scores.relativism).to.equal(
        Math.floor((V_SCORES.relativism * 1 + V2_SCORES.relativism) / 2)
      );
      expect(q.verifierCount).to.equal(2);
    });

    it("host cannot self-verify", async () => {
      await expect(registry.connect(host).verify(0, V_SCORES))
        .to.be.revertedWith("Host cannot self-verify");
    });

    it("same verifier cannot verify twice", async () => {
      await registry.connect(verifier1).verify(0, V_SCORES);
      await expect(registry.connect(verifier1).verify(0, V_SCORES))
        .to.be.revertedWith("Already verified");
    });

    it("cannot verify non-Active quantum", async () => {
      // Dispute to change status
      await registry.connect(challenger).dispute(0, COUNTER_CID, "counter claim", V_SCORES);
      await expect(registry.connect(verifier1).verify(0, V_SCORES))
        .to.be.revertedWith("Not active");
    });
  });

  // ── Dispute ────────────────────────────────────────
  describe("dispute", () => {
    const D_SCORES = { correspondence: 9000, coherence: 8500, pragmatism: 8000, relativism: 7000 };

    beforeEach(async () => {
      await registry.connect(host).createQuantum(SAMPLE_CID, "History", "Event happened in 1945", SCORES);
    });

    it("marks original quantum as Disputed", async () => {
      await registry.connect(challenger).dispute(0, COUNTER_CID, "counter evidence", D_SCORES);
      const q = await registry.getQuantum(0);
      expect(q.status).to.equal(1); // Disputed
    });

    it("creates a fork quantum with Active status", async () => {
      await registry.connect(challenger).dispute(0, COUNTER_CID, "counter evidence", D_SCORES);
      const fork = await registry.getQuantum(1);

      expect(fork.id).to.equal(1);
      expect(fork.host).to.equal(challenger.address);
      expect(fork.ipfsCid).to.equal(COUNTER_CID);
      expect(fork.discipline).to.equal("History"); // inherits from original
      expect(fork.claim).to.equal("counter evidence");
      expect(fork.status).to.equal(0); // Active
      expect(fork.verifierCount).to.equal(0);
    });

    it("emits QuantumDisputed with fork ID", async () => {
      await expect(
        registry.connect(challenger).dispute(0, COUNTER_CID, "counter evidence", D_SCORES)
      )
        .to.emit(registry, "QuantumDisputed")
        .withArgs(0, challenger.address, 1);
    });

    it("slashes original host 10%", async () => {
      // Host has 100 TRUTH from createQuantum
      const balanceBefore = await token.balanceOf(host.address);
      await registry.connect(challenger).dispute(0, COUNTER_CID, "counter evidence", D_SCORES);
      const balanceAfter = await token.balanceOf(host.address);

      const expectedSlash = (balanceBefore * 1000n) / 10000n; // 10%
      expect(balanceBefore - balanceAfter).to.equal(expectedSlash);
    });

    it("rewards challenger with hostReward (100 TRUTH)", async () => {
      await registry.connect(challenger).dispute(0, COUNTER_CID, "counter evidence", D_SCORES);
      expect(await token.balanceOf(challenger.address)).to.equal(HOST_REWARD);
    });

    it("cannot dispute non-Active quantum", async () => {
      await registry.connect(challenger).dispute(0, COUNTER_CID, "first dispute", D_SCORES);
      // Original is now Disputed, can't dispute again
      await expect(
        registry.connect(verifier1).dispute(0, COUNTER_CID, "second dispute", D_SCORES)
      ).to.be.revertedWith("Not active");
    });
  });

  // ── Aggregate Score ────────────────────────────────
  describe("aggregateScore", () => {
    it("returns average of 4 pillar scores", async () => {
      await registry.connect(host).createQuantum(SAMPLE_CID, "Physics", "test claim", SCORES);
      const avg = await registry.aggregateScore(0);
      // (8000 + 7500 + 9000 + 6500) / 4 = 7750
      expect(avg).to.equal(7750);
    });

    it("meets consensus threshold when average >= 7000", async () => {
      await registry.connect(host).createQuantum(SAMPLE_CID, "Physics", "test claim", SCORES);
      const avg = await registry.aggregateScore(0);
      expect(avg).to.be.gte(await registry.CONSENSUS_THRESHOLD());
    });
  });

  // ── Admin ──────────────────────────────────────────
  describe("admin", () => {
    it("owner can update rewards", async () => {
      await registry.setRewards(
        ethers.parseEther("200"),
        ethers.parseEther("20"),
        ethers.parseEther("100")
      );
      expect(await registry.hostReward()).to.equal(ethers.parseEther("200"));
      expect(await registry.vetReward()).to.equal(ethers.parseEther("20"));
      expect(await registry.minStake()).to.equal(ethers.parseEther("100"));
    });

    it("non-owner cannot update rewards", async () => {
      await expect(
        registry.connect(host).setRewards(ethers.parseEther("1"), ethers.parseEther("1"), ethers.parseEther("1"))
      ).to.be.revertedWith("Not owner");
    });

    it("owner can transfer ownership", async () => {
      await registry.transferOwnership(host.address);
      expect(await registry.owner()).to.equal(host.address);
    });

    it("cannot transfer to zero address", async () => {
      await expect(registry.transferOwnership(ethers.ZeroAddress))
        .to.be.revertedWith("Zero address");
    });
  });
});
