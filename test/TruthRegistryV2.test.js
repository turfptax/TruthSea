const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("TruthRegistryV2", function () {
  let token, registry, owner, host, verifier1, verifier2, challenger;

  const SAMPLE_CID = ethers.encodeBytes32String("QmTestCID12345678901");
  const COUNTER_CID = ethers.encodeBytes32String("QmCounterEvidence0001");
  const AGENT_ID = ethers.encodeBytes32String("erc8004-agent-001");

  // Full framework scores
  const TRUTH_SCORES = {
    correspondence: 8000,
    coherence: 7500,
    convergence: 8500,
    pragmatism: 9000,
  };

  const MORAL_VECTOR = {
    care: 7000,
    fairness: 6500,
    loyalty: 3000,
    authority: -2000,
    sanctity: 1000,
    liberty: 8000,
    epistemicHumility: 9000,
    temporalStewardship: 5500,
  };

  const HOST_REWARD = ethers.parseEther("100");
  const VET_REWARD = ethers.parseEther("10");

  beforeEach(async () => {
    [owner, host, verifier1, verifier2, challenger] = await ethers.getSigners();

    const TokenFactory = await ethers.getContractFactory("TruthToken");
    token = await TokenFactory.deploy();

    const RegistryFactory = await ethers.getContractFactory("TruthRegistryV2");
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

    it("MAX_TRUTH_SCORE is 10000", async () => {
      expect(await registry.MAX_TRUTH_SCORE()).to.equal(10000);
    });

    it("moral score bounds are -10000 to +10000", async () => {
      expect(await registry.MIN_MORAL_SCORE()).to.equal(-10000);
      expect(await registry.MAX_MORAL_SCORE()).to.equal(10000);
    });
  });

  // ── Agent Identity ─────────────────────────────────
  describe("agent identity", () => {
    it("links ERC-8004 agent identity", async () => {
      await expect(registry.connect(host).linkAgentIdentity(AGENT_ID))
        .to.emit(registry, "AgentIdentityLinked")
        .withArgs(host.address, AGENT_ID);

      expect(await registry.agentIdentities(host.address)).to.equal(AGENT_ID);
    });

    it("reverts on empty agent ID", async () => {
      await expect(
        registry.connect(host).linkAgentIdentity(ethers.ZeroHash)
      ).to.be.revertedWith("Empty agent ID");
    });

    it("quantum inherits host's agent identity", async () => {
      await registry.connect(host).linkAgentIdentity(AGENT_ID);
      await registry.connect(host).createQuantum(
        SAMPLE_CID, "Physics", "Speed of light", TRUTH_SCORES, MORAL_VECTOR
      );
      const q = await registry.getQuantum(0);
      expect(q.erc8004AgentId).to.equal(AGENT_ID);
    });

    it("quantum has zero agent ID if host has no linked identity", async () => {
      await registry.connect(host).createQuantum(
        SAMPLE_CID, "Physics", "Speed of light", TRUTH_SCORES, MORAL_VECTOR
      );
      const q = await registry.getQuantum(0);
      expect(q.erc8004AgentId).to.equal(ethers.ZeroHash);
    });
  });

  // ── Create Quantum ─────────────────────────────────
  describe("createQuantum", () => {
    it("creates a quantum and emits QuantumCreated", async () => {
      await expect(
        registry.connect(host).createQuantum(
          SAMPLE_CID, "Physics", "Speed of light is constant", TRUTH_SCORES, MORAL_VECTOR
        )
      )
        .to.emit(registry, "QuantumCreated")
        .withArgs(0, host.address, SAMPLE_CID, "Physics", ethers.ZeroHash);
    });

    it("stores quantum with correct truth scores", async () => {
      await registry.connect(host).createQuantum(
        SAMPLE_CID, "Physics", "Speed of light is constant", TRUTH_SCORES, MORAL_VECTOR
      );
      const q = await registry.getQuantum(0);

      expect(q.truthScores.correspondence).to.equal(8000);
      expect(q.truthScores.coherence).to.equal(7500);
      expect(q.truthScores.convergence).to.equal(8500);
      expect(q.truthScores.pragmatism).to.equal(9000);
    });

    it("stores quantum with correct moral vector", async () => {
      await registry.connect(host).createQuantum(
        SAMPLE_CID, "Physics", "Speed of light", TRUTH_SCORES, MORAL_VECTOR
      );
      const q = await registry.getQuantum(0);

      expect(q.moralVector.care).to.equal(7000);
      expect(q.moralVector.fairness).to.equal(6500);
      expect(q.moralVector.loyalty).to.equal(3000);
      expect(q.moralVector.authority).to.equal(-2000);
      expect(q.moralVector.sanctity).to.equal(1000);
      expect(q.moralVector.liberty).to.equal(8000);
      expect(q.moralVector.epistemicHumility).to.equal(9000);
      expect(q.moralVector.temporalStewardship).to.equal(5500);
    });

    it("stores negative moral values correctly", async () => {
      const negativeMoral = {
        care: -5000, fairness: -3000, loyalty: -1000, authority: -9999,
        sanctity: -10000, liberty: -500, epistemicHumility: -7500, temporalStewardship: -2500,
      };
      await registry.connect(host).createQuantum(
        SAMPLE_CID, "Ethics", "negative test", TRUTH_SCORES, negativeMoral
      );
      const q = await registry.getQuantum(0);
      expect(q.moralVector.care).to.equal(-5000);
      expect(q.moralVector.sanctity).to.equal(-10000);
      expect(q.moralVector.authority).to.equal(-9999);
    });

    it("mints hostReward (100 TRUTH) to the host", async () => {
      await registry.connect(host).createQuantum(
        SAMPLE_CID, "Physics", "test claim", TRUTH_SCORES, MORAL_VECTOR
      );
      expect(await token.balanceOf(host.address)).to.equal(HOST_REWARD);
    });

    it("increments nextQuantumId", async () => {
      await registry.connect(host).createQuantum(SAMPLE_CID, "A", "claim A", TRUTH_SCORES, MORAL_VECTOR);
      await registry.connect(host).createQuantum(SAMPLE_CID, "B", "claim B", TRUTH_SCORES, MORAL_VECTOR);
      expect(await registry.nextQuantumId()).to.equal(2);
    });

    it("reverts on empty CID", async () => {
      await expect(
        registry.connect(host).createQuantum(ethers.ZeroHash, "Physics", "test", TRUTH_SCORES, MORAL_VECTOR)
      ).to.be.revertedWith("Empty CID");
    });

    it("reverts on empty discipline", async () => {
      await expect(
        registry.connect(host).createQuantum(SAMPLE_CID, "", "test", TRUTH_SCORES, MORAL_VECTOR)
      ).to.be.revertedWith("Empty discipline");
    });

    it("reverts on empty claim", async () => {
      await expect(
        registry.connect(host).createQuantum(SAMPLE_CID, "Physics", "", TRUTH_SCORES, MORAL_VECTOR)
      ).to.be.revertedWith("Empty claim");
    });

    it("reverts on truth score > 10000", async () => {
      const badScores = { correspondence: 10001, coherence: 7500, convergence: 8500, pragmatism: 9000 };
      await expect(
        registry.connect(host).createQuantum(SAMPLE_CID, "Physics", "test", badScores, MORAL_VECTOR)
      ).to.be.revertedWith("Truth score out of range");
    });

    it("reverts on moral score > 10000", async () => {
      const badMoral = { ...MORAL_VECTOR, care: 10001 };
      await expect(
        registry.connect(host).createQuantum(SAMPLE_CID, "Physics", "test", TRUTH_SCORES, badMoral)
      ).to.be.reverted;
    });
  });

  // ── Verify ─────────────────────────────────────────
  describe("verify", () => {
    const V_TRUTH = { correspondence: 7000, coherence: 8000, convergence: 7500, pragmatism: 8500 };
    const V_MORAL = {
      care: 5000, fairness: 4000, loyalty: 2000, authority: -1000,
      sanctity: 500, liberty: 6000, epistemicHumility: 7000, temporalStewardship: 3000,
    };

    beforeEach(async () => {
      await registry.connect(host).createQuantum(
        SAMPLE_CID, "Physics", "Speed of light is constant", TRUTH_SCORES, MORAL_VECTOR
      );
    });

    it("verifier can submit scores and emits QuantumVerified", async () => {
      await expect(registry.connect(verifier1).verify(0, V_TRUTH, V_MORAL))
        .to.emit(registry, "QuantumVerified");
    });

    it("verifier earns vetReward (10 TRUTH)", async () => {
      await registry.connect(verifier1).verify(0, V_TRUTH, V_MORAL);
      expect(await token.balanceOf(verifier1.address)).to.equal(VET_REWARD);
    });

    it("increments verifierCount", async () => {
      await registry.connect(verifier1).verify(0, V_TRUTH, V_MORAL);
      const q = await registry.getQuantum(0);
      expect(q.verifierCount).to.equal(1);
    });

    it("first verifier replaces initial scores (MVP behavior: verifierCount=0)", async () => {
      await registry.connect(verifier1).verify(0, V_TRUTH, V_MORAL);
      const q = await registry.getQuantum(0);

      // Truth scores
      expect(q.truthScores.correspondence).to.equal(V_TRUTH.correspondence);
      expect(q.truthScores.convergence).to.equal(V_TRUTH.convergence);

      // Moral vector
      expect(q.moralVector.care).to.equal(V_MORAL.care);
      expect(q.moralVector.authority).to.equal(V_MORAL.authority);
    });

    it("second verifier averages truth scores correctly", async () => {
      await registry.connect(verifier1).verify(0, V_TRUTH, V_MORAL);

      const V2_TRUTH = { correspondence: 9000, coherence: 6000, convergence: 8500, pragmatism: 7500 };
      const V2_MORAL = {
        care: 3000, fairness: 2000, loyalty: 4000, authority: -3000,
        sanctity: 2000, liberty: 4000, epistemicHumility: 5000, temporalStewardship: 1000,
      };
      await registry.connect(verifier2).verify(0, V2_TRUTH, V2_MORAL);

      const q = await registry.getQuantum(0);

      // Rolling average: (old * 1 + new) / 2
      expect(q.truthScores.correspondence).to.equal(
        Math.floor((V_TRUTH.correspondence * 1 + V2_TRUTH.correspondence) / 2)
      );
      expect(q.truthScores.convergence).to.equal(
        Math.floor((V_TRUTH.convergence * 1 + V2_TRUTH.convergence) / 2)
      );
    });

    it("second verifier averages moral vector correctly (including negative)", async () => {
      await registry.connect(verifier1).verify(0, V_TRUTH, V_MORAL);

      const V2_MORAL = {
        care: 3000, fairness: 2000, loyalty: 4000, authority: -3000,
        sanctity: 2000, liberty: 4000, epistemicHumility: 5000, temporalStewardship: 1000,
      };
      await registry.connect(verifier2).verify(0, V_TRUTH, V2_MORAL);

      const q = await registry.getQuantum(0);

      // authority: (-1000 * 1 + -3000) / 2 = -2000
      expect(q.moralVector.authority).to.equal(
        Math.floor((V_MORAL.authority * 1 + V2_MORAL.authority) / 2)
      );
      // care: (5000 * 1 + 3000) / 2 = 4000
      expect(q.moralVector.care).to.equal(
        Math.floor((V_MORAL.care * 1 + V2_MORAL.care) / 2)
      );
    });

    it("host cannot self-verify", async () => {
      await expect(registry.connect(host).verify(0, V_TRUTH, V_MORAL))
        .to.be.revertedWith("Host cannot self-verify");
    });

    it("same verifier cannot verify twice", async () => {
      await registry.connect(verifier1).verify(0, V_TRUTH, V_MORAL);
      await expect(registry.connect(verifier1).verify(0, V_TRUTH, V_MORAL))
        .to.be.revertedWith("Already verified");
    });

    it("cannot verify non-Active quantum", async () => {
      const D_TRUTH = { correspondence: 9000, coherence: 8500, convergence: 8000, pragmatism: 7000 };
      await registry.connect(challenger).dispute(0, COUNTER_CID, "counter claim", D_TRUTH, MORAL_VECTOR);
      await expect(registry.connect(verifier1).verify(0, V_TRUTH, V_MORAL))
        .to.be.revertedWith("Not active");
    });
  });

  // ── Dispute ────────────────────────────────────────
  describe("dispute", () => {
    const D_TRUTH = { correspondence: 9000, coherence: 8500, convergence: 8000, pragmatism: 7000 };
    const D_MORAL = {
      care: 8000, fairness: 7000, loyalty: 5000, authority: 1000,
      sanctity: 3000, liberty: 9000, epistemicHumility: 8500, temporalStewardship: 6000,
    };

    beforeEach(async () => {
      await registry.connect(host).createQuantum(
        SAMPLE_CID, "History", "Event happened in 1945", TRUTH_SCORES, MORAL_VECTOR
      );
    });

    it("marks original quantum as Disputed", async () => {
      await registry.connect(challenger).dispute(0, COUNTER_CID, "counter evidence", D_TRUTH, D_MORAL);
      const q = await registry.getQuantum(0);
      expect(q.status).to.equal(1); // Disputed
    });

    it("creates a fork quantum with Active status and moral vector", async () => {
      await registry.connect(challenger).dispute(0, COUNTER_CID, "counter evidence", D_TRUTH, D_MORAL);
      const fork = await registry.getQuantum(1);

      expect(fork.id).to.equal(1);
      expect(fork.host).to.equal(challenger.address);
      expect(fork.discipline).to.equal("History");
      expect(fork.status).to.equal(0); // Active

      // Check moral vector on fork
      expect(fork.moralVector.care).to.equal(8000);
      expect(fork.moralVector.liberty).to.equal(9000);
    });

    it("emits QuantumDisputed with fork ID", async () => {
      await expect(
        registry.connect(challenger).dispute(0, COUNTER_CID, "counter evidence", D_TRUTH, D_MORAL)
      )
        .to.emit(registry, "QuantumDisputed")
        .withArgs(0, challenger.address, 1);
    });

    it("slashes original host 10%", async () => {
      const balanceBefore = await token.balanceOf(host.address);
      await registry.connect(challenger).dispute(0, COUNTER_CID, "counter evidence", D_TRUTH, D_MORAL);
      const balanceAfter = await token.balanceOf(host.address);

      const expectedSlash = (balanceBefore * 1000n) / 10000n;
      expect(balanceBefore - balanceAfter).to.equal(expectedSlash);
    });

    it("cannot dispute non-Active quantum", async () => {
      await registry.connect(challenger).dispute(0, COUNTER_CID, "first dispute", D_TRUTH, D_MORAL);
      await expect(
        registry.connect(verifier1).dispute(0, COUNTER_CID, "second dispute", D_TRUTH, D_MORAL)
      ).to.be.revertedWith("Not active");
    });
  });

  // ── Aggregate & Magnitude ──────────────────────────
  describe("scoring views", () => {
    beforeEach(async () => {
      await registry.connect(host).createQuantum(
        SAMPLE_CID, "Physics", "test claim", TRUTH_SCORES, MORAL_VECTOR
      );
    });

    it("aggregateTruthScore returns average of 4 frameworks", async () => {
      const avg = await registry.aggregateTruthScore(0);
      // (8000 + 7500 + 8500 + 9000) / 4 = 8250
      expect(avg).to.equal(8250);
    });

    it("meetsConsensus returns true when average >= 7000", async () => {
      expect(await registry.meetsConsensus(0)).to.be.true;
    });

    it("meetsConsensus returns false when average < 7000", async () => {
      const lowScores = { correspondence: 3000, coherence: 4000, convergence: 2000, pragmatism: 5000 };
      await registry.connect(host).createQuantum(SAMPLE_CID, "Test", "low claim", lowScores, MORAL_VECTOR);
      expect(await registry.meetsConsensus(1)).to.be.false;
    });

    it("moralMagnitude returns nonzero for nonzero vector", async () => {
      const mag = await registry.moralMagnitude(0);
      expect(mag).to.be.gt(0);
    });

    it("moralMagnitude returns 0 for zero vector", async () => {
      const zeroMoral = {
        care: 0, fairness: 0, loyalty: 0, authority: 0,
        sanctity: 0, liberty: 0, epistemicHumility: 0, temporalStewardship: 0,
      };
      await registry.connect(host).createQuantum(SAMPLE_CID, "Test", "neutral", TRUTH_SCORES, zeroMoral);
      const mag = await registry.moralMagnitude(1);
      expect(mag).to.equal(0);
    });

    it("getTruthScores returns just truth scores", async () => {
      const scores = await registry.getTruthScores(0);
      expect(scores.correspondence).to.equal(8000);
      expect(scores.convergence).to.equal(8500);
    });

    it("getMoralVector returns just moral vector", async () => {
      const moral = await registry.getMoralVector(0);
      expect(moral.care).to.equal(7000);
      expect(moral.authority).to.equal(-2000);
      expect(moral.epistemicHumility).to.equal(9000);
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
  });
});
