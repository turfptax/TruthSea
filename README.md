# Quantizing Truth: A Decentralized Ledger for Verifiable Reality

## Deployed Contracts (Base Sepolia Testnet)

| Contract | Address | Explorer |
|----------|---------|----------|
| **TruthToken** | `0x18D825cE88089beFC99B0e293f39318D992FA07D` | [Basescan](https://sepolia.basescan.org/address/0x18D825cE88089beFC99B0e293f39318D992FA07D) |
| **TruthRegistryV2** | `0xbEE32455c12002b32bE654c8E70E876Fd557d653` | [Basescan](https://sepolia.basescan.org/address/0xbEE32455c12002b32bE654c8E70E876Fd557d653) |
| **BountyBridge** (CrowdedSea) | `0xA255A98F2D497c47a7068c4D1ad1C1968f88E0C5` | [Basescan](https://sepolia.basescan.org/address/0xA255A98F2D497c47a7068c4D1ad1C1968f88E0C5) |
| **TruthDAG** | *Deploy with `deploy-v2-dag.js`* | — |
| **TruthStaking** | *Deploy with `deploy-v2-dag.js`* | — |

> **161 quanta scored** across 20 epistemological chains spanning 14 disciplines, from the speed of light to the age of the universe.

---

## Abstract

In an era where AI swarms hallucinate histories and fork facts like rogue code, *Quantizing Truth* emerges as the anchor: a crypto-native protocol that tokenizes veracity itself. Drawing from four pillars of epistemology — Correspondence, Coherence, Convergence, and Pragmatism — we break "truth" into finite, discipline-specific quanta, rewarding agents and humans for vetting sources, dispatching scouts, and upholding the ledger. Tied to the **Crowded Sea** bounty marketplace, it turns truth quests into payable gigs. Gaming? Punished by stake-slashing and rep decay. No central oracle, just tidal math that self-corrects.

## Architecture

```
                    ┌─────────────────────────────────────┐
                    │          AI Agents (MCP)             │
                    │  12 tools: submit, verify, query,    │
                    │  dispute, create edge, explore DAG,  │
                    │  get chain score, find weak links... │
                    └──────────┬──────────────────────────┘
                               │
              ┌────────────────┼────────────────┐
              ▼                ▼                 ▼
     ┌────────────────┐ ┌───────────┐ ┌──────────────────┐
     │ REST API (V1)  │ │ REST API  │ │ Event Indexer    │
     │ /api/v1/quanta │ │ (V2)      │ │ Polls Base L2    │
     │ /api/v1/bounties│ │ /api/v2/  │ │ every 12s        │
     └────────┬───────┘ │ edges,dag │ └────────┬─────────┘
              │         │ chains    │          │
              │         └─────┬─────┘          │
              │               │                │
              ▼               ▼                ▼
     ┌─────────────────────────────────────────────────┐
     │              PostgreSQL (Prisma ORM)             │
     │  Quantum, Verification, Bounty, OnChainEdge,    │
     │  PropagatedScore, WeakLinkFlag, ChainDefinition  │
     └──────────────────────┬──────────────────────────┘
                            │
              ┌─────────────┼─────────────┐
              ▼             ▼             ▼
     ┌──────────────┐ ┌──────────┐ ┌────────────┐
     │ TruthRegistry│ │ TruthDAG │ │ BountyBridge│
     │ V2 (Quanta)  │ │ (Edges,  │ │ (CrowdedSea)│
     │              │ │ Scores)  │ │             │
     └──────────────┘ └─────┬────┘ └─────────────┘
                            │
                     ┌──────┴──────┐
                     │TruthStaking │
                     │ (Vault)     │
                     └──────┬──────┘
                            │
                     ┌──────┴──────┐
                     │ TruthToken  │
                     │ (ERC-20)    │
                     └─────────────┘
                     Base L2 (Sepolia)
```

## The Quantization Framework: Four Pillars

Truth isn't binary — it's a spectrum, sliced into quanta via four epistemological lenses. Each quantum is a claim tagged with evidence, scored per pillar, and categorized by discipline.

| Pillar | Description | Scoring Metric | Weight |
|--------|-------------|----------------|--------|
| **Correspondence** | Maps to observable reality (empiricist anchor) | Evidence match (0-100): source fidelity + replication rate | 30% |
| **Coherence** | Fits the web of known truths (holistic check) | Network consistency (0-100): cross-links to established quanta | 25% |
| **Convergence** | Independent sources agree over time | Multi-source agreement (0-100): replicated across institutions | 25% |
| **Pragmatism** | Works in practice (utility test) | Outcome efficacy (0-100): real-world applications + predictions | 20% |

### Moral Vector (8 Dimensions, -100 to +100)

Every quantum also carries a moral vector: Care, Fairness, Loyalty, Authority, Sanctity, Liberty, Epistemic Humility, and Temporal Stewardship.

---

## V2: Chain of Truth DAG

V2 brings the dependency graph on-chain. Quanta become nodes in a **directed acyclic graph** where edges represent epistemological relationships.

### Edge Types

| Type | Meaning | Example |
|------|---------|---------|
| **Depends** | Target requires source to be true | "Universe is 13.8 Gyr" depends on "CMB anisotropies" |
| **Supports** | Source provides corroborating evidence | "Gaia parallax data" supports "distance ladder" |
| **Contradicts** | Source challenges the target | "Tired light hypothesis" contradicts "Doppler redshift" |

### Chain Score Propagation

A claim's **chain score** attenuates its intrinsic truth score by its weakest dependency. A brilliant inference built on shaky evidence scores lower:

```
chainScore = intrinsicScore * (floor + damping * weakestDepChainScore / 10000)
```

Where `floor = 0.30`, `damping = 0.70`. Contradictions further penalize:

```
chainScore *= max(contradictionFloor, 1.0 - count * 0.15)
```

Axioms (no dependencies) have `chainScore = intrinsicScore`.

### Weak Link Bounties

Anyone can flag an edge as potentially weak. If that edge is later invalidated or disputed within 30 days, the flagger earns **100 TRUTH**. This incentivizes agents to audit the entire dependency chain, not just the crown claims.

### Edge Disputes

Challenge any edge by calling `disputeEdge()`. The proposer's stake is slashed 10%, 60% of the remainder transfers to you, and you earn TRUTH tokens. This extends V1's fork-based dispute model to individual inferential links.

---

## Tokenomics: Truth as the Ultimate Yield Farm

**TRUTH** token powers the loop:

| Action | Reward |
|--------|--------|
| Host a quantum | 100 TRUTH |
| Verify a quantum | 10 TRUTH |
| Create edge (survives 7 days) | 20 TRUTH |
| Dispute edge (win) | 60% of proposer's stake + 20 TRUTH |
| Flag weak link (validated) | 100 TRUTH |
| Trigger propagation | 2 TRUTH gas subsidy |

- **Supply**: 1B total, 40% emissions for verifiers (halving every 4 years).
- **Burns**: 1% query fee burned; disputed quanta/edges slash stakers 5-20%.
- **Self-sufficiency**: 70% of fees recycle to top verifiers.

---

## Tying the Knot: Crowded Sea as the Bounty Horizon

**CrowdedSea BountyBridge** lets anyone post ETH-backed bounties for truth investigations. Agents claim bounties, research claims, submit quanta, and earn rewards. The hybrid: CrowdedSea funds the labor; Quantizing Truth quantifies the output.

---

## Safeguards: No Gaming the Gale

- **Stake-Slashing**: Every edge requires TRUTH collateral. Bad edges get slashed.
- **Cycle Detection**: Bounded DFS (max depth 20) prevents circular dependency attacks.
- **Rep Decay**: Verifier score decays with losses. Below threshold = bounty blacklisting.
- **Dispute Forks**: Challenge quanta or edges with counter-evidence; losers burn.
- **Pillar Balance**: No paradigm dominance via capped weights (30/25/25/20).

---

## Project Structure

```
TruthSea/
├── contracts/              # Solidity smart contracts
│   ├── TruthRegistryV2.sol   # Quantum CRUD + scoring
│   ├── TruthToken.sol         # ERC-20 with mint/burn/slash
│   ├── TruthDAG.sol           # V2: On-chain dependency graph
│   ├── TruthStaking.sol       # V2: TRUTH staking vault
│   ├── BountyBridge.sol       # CrowdedSea bounties
│   └── ITruthRegistryV2.sol   # Interface for cross-contract reads
├── api/                    # REST + GraphQL API
│   ├── src/routes/            # V1 + V2 endpoints
│   ├── src/indexer/           # On-chain event indexer
│   └── prisma/                # Database schema
├── mcp-server/             # MCP server (12 tools for AI agents)
├── agent-toolkit/          # Research missions, scored quanta, chains
│   ├── chains/                # 20 dependency chain definitions
│   ├── output/                # 161 scored quanta (JSONL)
│   └── missions/              # Research task assignments
├── openclaw-skill/         # OpenClaw skill integration
├── scripts/                # Deploy + migration scripts
│   ├── deploy-v2.js           # Deploy V1 contracts
│   ├── deploy-v2-dag.js       # Deploy V2 DAG contracts
│   └── backfill-edges.js      # Migrate offline chains to on-chain
└── test/                   # 178 passing tests
    ├── TruthRegistryV2.test.js
    ├── TruthDAG.test.js       # 48 tests
    └── TruthStaking.test.js   # 25 tests
```

---

## Roadmap

- **Phase 1** (Complete): TruthToken + TruthRegistryV2 + BountyBridge deployed on Base Sepolia
- **Phase 2** (Complete): On-chain DAG (TruthDAG + TruthStaking), chain score propagation, edge disputes, weak-link bounties, 6 new MCP tools, V2 API endpoints, event indexer, 161 quanta scored across 20 chains
- **Phase 3**: Mainnet deployment on Base L2, frontend explorer, Paradigm DAOs

---

*Lightpaper v0.2 | Tory | Feb 2026*

*Contributions: Fork on [GitHub](https://github.com/turfptax/TruthSea). Bounty your doubts.*
