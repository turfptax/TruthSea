const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("TruthDAG", function () {
  let token, registry, staking, dag;
  let owner, proposer, challenger, verifier;

  const SAMPLE_CID = ethers.encodeBytes32String("QmTestCID12345678901");
  const COUNTER_CID = ethers.encodeBytes32String("QmCounterEvidence0001");
  const EVIDENCE_CID = ethers.encodeBytes32String("QmEdgeEvidence000001");

  const TRUTH_SCORES = {
    correspondence: 8000,
    coherence: 7500,
    convergence: 8500,
    pragmatism: 9000,
  };

  const MORAL_VECTOR = {
    care: 7000, fairness: 6500, loyalty: 3000, authority: -2000,
    sanctity: 1000, liberty: 8000, epistemicHumility: 9000, temporalStewardship: 5500,
  };

  const LOW_SCORES = {
    correspondence: 4000,
    coherence: 3500,
    convergence: 3000,
    pragmatism: 3500,
  };

  const MIN_EDGE_STAKE = ethers.parseEther("10");

  // Helper: compute stake key matching the contract's _edgeStakeKey
  function edgeStakeKey(edgeId) {
    return ethers.keccak256(ethers.AbiCoder.defaultAbiCoder().encode(["string", "uint256"], ["edge", edgeId]));
  }

  // Helper: create a quantum on the registry
  async function createQuantum(signer, claim, scores) {
    const tx = await registry.connect(signer).createQuantum(
      SAMPLE_CID, "Physics", claim, scores || TRUTH_SCORES, MORAL_VECTOR
    );
    await tx.wait();
  }

  // Helper: stake and create an edge
  async function stakeAndCreateEdge(signer, sourceId, targetId, edgeType, confidence) {
    const nextEdgeId = await dag.nextEdgeId();
    const key = edgeStakeKey(nextEdgeId);
    await token.connect(signer).approve(await staking.getAddress(), ethers.MaxUint256);
    await staking.connect(signer).stake(key, MIN_EDGE_STAKE);
    return dag.connect(signer).createEdge(sourceId, targetId, edgeType || 0, EVIDENCE_CID, confidence || 8000);
  }

  beforeEach(async () => {
    [owner, proposer, challenger, verifier] = await ethers.getSigners();

    // Deploy TruthToken
    const TokenFactory = await ethers.getContractFactory("TruthToken");
    token = await TokenFactory.deploy();

    // Deploy TruthRegistryV2
    const RegistryFactory = await ethers.getContractFactory("TruthRegistryV2");
    registry = await RegistryFactory.deploy(await token.getAddress());
    await token.setMinter(await registry.getAddress(), true);

    // Deploy TruthStaking
    const StakingFactory = await ethers.getContractFactory("TruthStaking");
    staking = await StakingFactory.deploy(await token.getAddress());

    // Deploy TruthDAG
    const DAGFactory = await ethers.getContractFactory("TruthDAG");
    dag = await DAGFactory.deploy(
      await registry.getAddress(),
      await token.getAddress(),
      await staking.getAddress()
    );

    // Grant minter role to DAG
    await token.setMinter(await dag.getAddress(), true);

    // Authorize DAG on staking
    await staking.setAuthorized(await dag.getAddress(), true);

    // Mint tokens to proposer and challenger for staking
    await token.setMinter(owner.address, true);
    await token.mint(proposer.address, ethers.parseEther("10000"), "test-setup");
    await token.mint(challenger.address, ethers.parseEther("10000"), "test-setup");
  });

  // ── Deployment ────────────────────────────────────
  describe("deployment", () => {
    it("links to the correct registry", async () => {
      expect(await dag.registry()).to.equal(await registry.getAddress());
    });

    it("links to the correct token", async () => {
      expect(await dag.truthToken()).to.equal(await token.getAddress());
    });

    it("links to the correct staking contract", async () => {
      expect(await dag.staking()).to.equal(await staking.getAddress());
    });

    it("nextEdgeId starts at 0", async () => {
      expect(await dag.nextEdgeId()).to.equal(0);
    });

    it("has correct default config", async () => {
      expect(await dag.minEdgeStake()).to.equal(MIN_EDGE_STAKE);
      expect(await dag.propagationFloor()).to.equal(3000);
      expect(await dag.propagationDamping()).to.equal(7000);
      expect(await dag.contradictionPenalty()).to.equal(1500);
      expect(await dag.contradictionFloor()).to.equal(4000);
    });

    it("has correct default weights summing to 10000", async () => {
      const w1 = Number(await dag.weightCorrespondence());
      const w2 = Number(await dag.weightCoherence());
      const w3 = Number(await dag.weightConvergence());
      const w4 = Number(await dag.weightPragmatism());
      expect(w1 + w2 + w3 + w4).to.equal(10000);
    });
  });

  // ── Edge Creation ─────────────────────────────────
  describe("createEdge", () => {
    beforeEach(async () => {
      // Create 3 quanta: Q0 (axiom), Q1 (depends on Q0), Q2
      await createQuantum(proposer, "Speed of light is constant");
      await createQuantum(proposer, "E=mc^2 depends on speed of light");
      await createQuantum(proposer, "Mass-energy equivalence");
    });

    it("creates an edge and emits EdgeCreated", async () => {
      await expect(stakeAndCreateEdge(proposer, 0, 1, 0, 8000))
        .to.emit(dag, "EdgeCreated")
        .withArgs(0, 0, 1, 0, proposer.address);
    });

    it("stores correct edge data", async () => {
      await stakeAndCreateEdge(proposer, 0, 1, 0, 8500);
      const edge = await dag.getEdge(0);
      expect(edge.sourceQuantumId).to.equal(0);
      expect(edge.targetQuantumId).to.equal(1);
      expect(edge.edgeType).to.equal(0); // Depends
      expect(edge.status).to.equal(0); // Active
      expect(edge.proposer).to.equal(proposer.address);
      expect(edge.confidence).to.equal(8500);
    });

    it("increments nextEdgeId", async () => {
      await stakeAndCreateEdge(proposer, 0, 1);
      await stakeAndCreateEdge(proposer, 0, 2);
      expect(await dag.nextEdgeId()).to.equal(2);
    });

    it("updates adjacency lists", async () => {
      await stakeAndCreateEdge(proposer, 0, 1); // Q1 depends on Q0
      // outgoingEdges[1] should contain edge 0 (Q1's dependency on Q0)
      const outEdges = await dag.getOutgoingEdges(1);
      expect(outEdges.length).to.equal(1);
      expect(outEdges[0]).to.equal(0);

      // incomingEdges[0] should contain edge 0 (Q0 is depended upon by Q1)
      const inEdges = await dag.getIncomingEdges(0);
      expect(inEdges.length).to.equal(1);
      expect(inEdges[0]).to.equal(0);
    });

    it("reverts on self-reference", async () => {
      const key = edgeStakeKey(0);
      await token.connect(proposer).approve(await staking.getAddress(), ethers.MaxUint256);
      await staking.connect(proposer).stake(key, MIN_EDGE_STAKE);
      await expect(dag.connect(proposer).createEdge(0, 0, 0, EVIDENCE_CID, 8000))
        .to.be.revertedWith("Self-reference");
    });

    it("reverts on duplicate edge", async () => {
      await stakeAndCreateEdge(proposer, 0, 1);
      await expect(stakeAndCreateEdge(proposer, 0, 1))
        .to.be.revertedWith("Edge already exists");
    });

    it("reverts if source quantum does not exist", async () => {
      const key = edgeStakeKey(0);
      await token.connect(proposer).approve(await staking.getAddress(), ethers.MaxUint256);
      await staking.connect(proposer).stake(key, MIN_EDGE_STAKE);
      await expect(dag.connect(proposer).createEdge(99, 1, 0, EVIDENCE_CID, 8000))
        .to.be.revertedWith("Source quantum does not exist");
    });

    it("reverts if target quantum does not exist", async () => {
      const key = edgeStakeKey(0);
      await token.connect(proposer).approve(await staking.getAddress(), ethers.MaxUint256);
      await staking.connect(proposer).stake(key, MIN_EDGE_STAKE);
      await expect(dag.connect(proposer).createEdge(0, 99, 0, EVIDENCE_CID, 8000))
        .to.be.revertedWith("Target quantum does not exist");
    });

    it("reverts if insufficient stake", async () => {
      // Don't stake, just try to create
      await expect(dag.connect(proposer).createEdge(0, 1, 0, EVIDENCE_CID, 8000))
        .to.be.revertedWith("Insufficient stake");
    });

    it("reverts on confidence > 10000", async () => {
      const key = edgeStakeKey(0);
      await token.connect(proposer).approve(await staking.getAddress(), ethers.MaxUint256);
      await staking.connect(proposer).stake(key, MIN_EDGE_STAKE);
      await expect(dag.connect(proposer).createEdge(0, 1, 0, EVIDENCE_CID, 10001))
        .to.be.revertedWith("Confidence out of range");
    });

    it("allows Supports edges between same quanta as Depends", async () => {
      await stakeAndCreateEdge(proposer, 0, 1, 0); // Depends
      await stakeAndCreateEdge(proposer, 0, 1, 1); // Supports — different type, allowed
      expect(await dag.nextEdgeId()).to.equal(2);
    });
  });

  // ── Cycle Detection ───────────────────────────────
  describe("cycle detection", () => {
    beforeEach(async () => {
      await createQuantum(proposer, "A");
      await createQuantum(proposer, "B");
      await createQuantum(proposer, "C");
    });

    it("allows acyclic chain A→B→C", async () => {
      await stakeAndCreateEdge(proposer, 0, 1); // B depends on A
      await stakeAndCreateEdge(proposer, 1, 2); // C depends on B
      expect(await dag.nextEdgeId()).to.equal(2);
    });

    it("reverts on direct cycle A→B, B→A", async () => {
      await stakeAndCreateEdge(proposer, 0, 1); // B depends on A
      await expect(stakeAndCreateEdge(proposer, 1, 0)) // A depends on B — cycle!
        .to.be.revertedWith("Would create cycle");
    });

    it("reverts on transitive cycle A→B→C, C→A", async () => {
      await stakeAndCreateEdge(proposer, 0, 1); // B depends on A
      await stakeAndCreateEdge(proposer, 1, 2); // C depends on B
      await expect(stakeAndCreateEdge(proposer, 2, 0)) // A depends on C — cycle through B!
        .to.be.revertedWith("Would create cycle");
    });

    it("isAcyclic returns true for valid edge", async () => {
      expect(await dag.isAcyclic(0, 1)).to.be.true;
    });

    it("isAcyclic returns false for cycle", async () => {
      await stakeAndCreateEdge(proposer, 0, 1);
      expect(await dag.isAcyclic(1, 0)).to.be.false;
    });
  });

  // ── Edge Removal ──────────────────────────────────
  describe("removeEdge", () => {
    beforeEach(async () => {
      await createQuantum(proposer, "A");
      await createQuantum(proposer, "B");
      await stakeAndCreateEdge(proposer, 0, 1);
    });

    it("proposer can remove edge", async () => {
      await expect(dag.connect(proposer).removeEdge(0))
        .to.emit(dag, "EdgeRemoved")
        .withArgs(0);
      const edge = await dag.getEdge(0);
      expect(edge.status).to.equal(3); // Removed
    });

    it("refunds stake on removal", async () => {
      const balBefore = await token.balanceOf(proposer.address);
      await dag.connect(proposer).removeEdge(0);
      const balAfter = await token.balanceOf(proposer.address);
      expect(balAfter).to.be.gt(balBefore);
    });

    it("clears dedup key so edge can be re-created", async () => {
      await dag.connect(proposer).removeEdge(0);
      // Should be able to create same edge again
      await stakeAndCreateEdge(proposer, 0, 1);
      expect(await dag.nextEdgeId()).to.equal(2);
    });

    it("non-proposer cannot remove edge", async () => {
      await expect(dag.connect(challenger).removeEdge(0))
        .to.be.revertedWith("Not proposer");
    });
  });

  // ── Edge Dispute ──────────────────────────────────
  describe("disputeEdge", () => {
    beforeEach(async () => {
      await createQuantum(proposer, "A");
      await createQuantum(proposer, "B depends on A");
      await stakeAndCreateEdge(proposer, 0, 1);
    });

    it("marks edge as Disputed", async () => {
      await dag.connect(challenger).disputeEdge(0);
      const edge = await dag.getEdge(0);
      expect(edge.status).to.equal(1); // Disputed
    });

    it("emits EdgeDisputed", async () => {
      await expect(dag.connect(challenger).disputeEdge(0))
        .to.emit(dag, "EdgeDisputed")
        .withArgs(0, challenger.address);
    });

    it("slashes proposer stake and rewards challenger", async () => {
      const challengerBalBefore = await token.balanceOf(challenger.address);
      await dag.connect(challenger).disputeEdge(0);
      const challengerBalAfter = await token.balanceOf(challenger.address);
      // Challenger should receive: 60% of remaining stake after slash + edgeSurvivalReward mint
      expect(challengerBalAfter).to.be.gt(challengerBalBefore);
    });

    it("cannot dispute own edge", async () => {
      await expect(dag.connect(proposer).disputeEdge(0))
        .to.be.revertedWith("Cannot dispute own edge");
    });

    it("cannot dispute non-active edge", async () => {
      await dag.connect(challenger).disputeEdge(0);
      await expect(dag.connect(verifier).disputeEdge(0))
        .to.be.revertedWith("Edge not active");
    });
  });

  // ── Score Propagation ─────────────────────────────
  describe("propagateScore", () => {
    beforeEach(async () => {
      // Create axiom Q0 with high scores and Q1 with high scores
      await createQuantum(proposer, "Axiom: Speed of light", TRUTH_SCORES);
      await createQuantum(proposer, "Depends on axiom: E=mc^2", TRUTH_SCORES);
    });

    it("axiom (no deps) gets intrinsic score as chain score", async () => {
      await dag.propagateScore(0);
      const score = await dag.getChainScore(0);

      // intrinsic = (8000*3000 + 7500*2500 + 8500*2500 + 9000*2000) / 10000
      // = (24000000 + 18750000 + 21250000 + 18000000) / 10000 = 8200
      expect(score.chainScore).to.equal(8200);
      expect(score.depth).to.equal(0);
    });

    it("single dependency attenuates correctly", async () => {
      await stakeAndCreateEdge(proposer, 0, 1, 0, 9000); // Q1 depends on Q0, confidence 9000

      // First propagate axiom
      await dag.propagateScore(0);
      const axiomScore = await dag.getChainScore(0);

      // Now propagate Q1
      await dag.propagateScore(1);
      const depScore = await dag.getChainScore(1);

      // Q1 intrinsic = 8200 (same scores)
      // Effective weakest = min(axiomChainScore, edgeConfidence) = min(8200, 9000) = 8200
      // chainScore = 8200 * (3000 + 7000 * 8200 / 10000) / 10000
      // = 8200 * (3000 + 5740) / 10000 = 8200 * 8740 / 10000 = 7166
      expect(depScore.chainScore).to.equal(7166);
      expect(depScore.depth).to.equal(1);
      expect(depScore.weakestLinkEdgeId).to.equal(0);
    });

    it("identifies weakest link among multiple dependencies", async () => {
      // Create Q2 (low scores axiom)
      await createQuantum(proposer, "Weak axiom", LOW_SCORES);

      // Q1 depends on Q0 (strong) and Q2 (weak)
      await stakeAndCreateEdge(proposer, 0, 1, 0, 9000); // edge 0: Q1 depends on Q0
      await stakeAndCreateEdge(proposer, 2, 1, 0, 9000); // edge 1: Q1 depends on Q2

      // Propagate axioms first
      await dag.propagateScore(0);
      await dag.propagateScore(2);

      const q2Score = await dag.getChainScore(2);
      // Q2 intrinsic = (4000*3000 + 3500*2500 + 3000*2500 + 3500*2000) / 10000
      // = (12000000 + 8750000 + 7500000 + 7000000) / 10000 = 3525

      // Now propagate Q1
      await dag.propagateScore(1);
      const q1Score = await dag.getChainScore(1);

      // Weakest is Q2 with chainScore 3525 (edge confidence 9000, so effective = 3525)
      expect(q1Score.weakestLinkScore).to.equal(q2Score.chainScore);
      expect(q1Score.weakestLinkEdgeId).to.equal(1); // edge 1 is the weak link
    });

    it("contradiction penalty reduces score", async () => {
      // Create Q2 that contradicts Q0
      await createQuantum(proposer, "Contradicts axiom");

      // Q1 depends on Q0
      await stakeAndCreateEdge(proposer, 0, 1, 0, 9000);
      // Q2 contradicts Q1
      await stakeAndCreateEdge(proposer, 2, 1, 2, 9000); // edgeType 2 = Contradicts

      // Propagate
      await dag.propagateScore(0);
      await dag.propagateScore(1);
      const score = await dag.getChainScore(1);

      // Should be less than without contradiction
      // contradiction multiplier: max(4000, 10000 - 1 * 1500) = 8500
      // chainScore after = chainScore * 8500 / 10000
      // Without contradiction: 7166, with: 7166 * 8500 / 10000 = 6091
      expect(score.chainScore).to.equal(6091);
    });

    it("emits ScorePropagated", async () => {
      await expect(dag.propagateScore(0))
        .to.emit(dag, "ScorePropagated");
    });

    it("rewards propagation trigger with TRUTH", async () => {
      const balBefore = await token.balanceOf(proposer.address);
      await dag.connect(proposer).propagateScore(0);
      const balAfter = await token.balanceOf(proposer.address);
      expect(balAfter - balBefore).to.equal(ethers.parseEther("2"));
    });
  });

  // ── Batch Propagation ─────────────────────────────
  describe("batchPropagateScores", () => {
    it("processes array of quanta", async () => {
      await createQuantum(proposer, "A");
      await createQuantum(proposer, "B");
      await createQuantum(proposer, "C");
      await stakeAndCreateEdge(proposer, 0, 1); // B depends on A
      await stakeAndCreateEdge(proposer, 1, 2); // C depends on B

      // Batch propagate bottom-up
      await dag.batchPropagateScores([0, 1, 2]);

      const scoreA = await dag.getChainScore(0);
      const scoreB = await dag.getChainScore(1);
      const scoreC = await dag.getChainScore(2);

      expect(scoreA.depth).to.equal(0);
      expect(scoreB.depth).to.equal(1);
      expect(scoreC.depth).to.equal(2);
      // Each layer should be strictly less than the previous due to attenuation
      expect(scoreB.chainScore).to.be.lt(scoreA.chainScore);
      expect(scoreC.chainScore).to.be.lt(scoreB.chainScore);
    });
  });

  // ── Weak Link Flagging ────────────────────────────
  describe("flagWeakLink", () => {
    beforeEach(async () => {
      await createQuantum(proposer, "A");
      await createQuantum(proposer, "B");
      await stakeAndCreateEdge(proposer, 0, 1);
    });

    it("records flag and emits WeakLinkFlagged", async () => {
      await expect(dag.connect(challenger).flagWeakLink(0))
        .to.emit(dag, "WeakLinkFlagged")
        .withArgs(0, challenger.address);

      const flags = await dag.getWeakLinkFlags(0);
      expect(flags.length).to.equal(1);
      expect(flags[0].flagger).to.equal(challenger.address);
      expect(flags[0].resolved).to.be.false;
    });

    it("reverts on non-active edge", async () => {
      await dag.connect(proposer).removeEdge(0);
      await expect(dag.connect(challenger).flagWeakLink(0))
        .to.be.revertedWith("Edge not active");
    });
  });

  // ── Edge Maturity Reward ──────────────────────────
  describe("claimEdgeReward", () => {
    beforeEach(async () => {
      await createQuantum(proposer, "A");
      await createQuantum(proposer, "B");
      await stakeAndCreateEdge(proposer, 0, 1);
    });

    it("reverts before maturity period", async () => {
      await expect(dag.connect(proposer).claimEdgeReward(0))
        .to.be.revertedWith("Not mature");
    });

    it("allows claim after maturity and pays reward", async () => {
      // Advance time past maturity
      await ethers.provider.send("evm_increaseTime", [7 * 24 * 60 * 60 + 1]);
      await ethers.provider.send("evm_mine");

      const balBefore = await token.balanceOf(proposer.address);
      await dag.connect(proposer).claimEdgeReward(0);
      const balAfter = await token.balanceOf(proposer.address);
      expect(balAfter - balBefore).to.equal(ethers.parseEther("20"));
    });

    it("cannot claim twice", async () => {
      await ethers.provider.send("evm_increaseTime", [7 * 24 * 60 * 60 + 1]);
      await ethers.provider.send("evm_mine");
      await dag.connect(proposer).claimEdgeReward(0);
      await expect(dag.connect(proposer).claimEdgeReward(0))
        .to.be.revertedWith("Already claimed");
    });

    it("non-proposer cannot claim", async () => {
      await ethers.provider.send("evm_increaseTime", [7 * 24 * 60 * 60 + 1]);
      await ethers.provider.send("evm_mine");
      await expect(dag.connect(challenger).claimEdgeReward(0))
        .to.be.revertedWith("Not proposer");
    });
  });

  // ── Admin ─────────────────────────────────────────
  describe("admin", () => {
    it("owner can update config", async () => {
      await dag.setConfig(
        ethers.parseEther("20"), // minEdgeStake
        2000, // propagationFloor
        8000, // propagationDamping
        2000, // contradictionPenalty
        3000, // contradictionFloor
        60 * 24 * 60 * 60, // weakLinkRewardWindow
        14 * 24 * 60 * 60, // edgeMaturityPeriod
        ethers.parseEther("5"), // propagationReward
        ethers.parseEther("30"), // edgeSurvivalReward
        ethers.parseEther("200"), // weakLinkBounty
      );
      expect(await dag.minEdgeStake()).to.equal(ethers.parseEther("20"));
      expect(await dag.propagationFloor()).to.equal(2000);
    });

    it("non-owner cannot update config", async () => {
      await expect(
        dag.connect(proposer).setConfig(0, 0, 0, 0, 0, 0, 0, 0, 0, 0)
      ).to.be.revertedWith("Not owner");
    });

    it("owner can update weights", async () => {
      await dag.setWeights(2500, 2500, 2500, 2500);
      expect(await dag.weightCorrespondence()).to.equal(2500);
    });

    it("weights must sum to 10000", async () => {
      await expect(dag.setWeights(2500, 2500, 2500, 3000))
        .to.be.revertedWith("Weights must sum to 10000");
    });
  });
});
