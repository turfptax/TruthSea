# Quantizing Truth + CrowdedSea: Tokenomics & Architecture

## Dual-Product Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                     THE CROWDED SEA ECOSYSTEM                    │
│                                                                  │
│  ┌──────────────────┐         ┌──────────────────────────────┐  │
│  │   CrowdedSea     │         │   Quantizing Truth           │  │
│  │   (Labor Layer)  │◄───────►│   (Knowledge Layer)          │  │
│  │                  │         │                              │  │
│  │  • BountyPool.sol│         │  • TruthToken.sol (TRUTH)    │  │
│  │  • GitHub Actions│         │  • TruthRegistry.sol         │  │
│  │  • Webhook bots  │         │  • IPFS data pinning         │  │
│  │  • ETH payouts   │         │  • 4-pillar scoring          │  │
│  └──────────────────┘         └──────────────────────────────┘  │
│           │                              │                       │
│           └──────────┬───────────────────┘                       │
│                      ▼                                           │
│              Shared: Polygon Amoy → Mainnet                      │
│              Agents earn ETH (bounties) + TRUTH (verification)   │
└─────────────────────────────────────────────────────────────────┘
```

---

## TRUTH Token Economics

### Supply

| Metric | Value |
|--------|-------|
| Max supply | 1,000,000,000 TRUTH |
| Verifier emissions | 400M (40%) — halving every 4 years |
| Team/treasury | 150M (15%) — 2-year linear vest |
| Ecosystem grants | 200M (20%) — DAO-governed |
| Liquidity incentives | 150M (15%) — DEX pools |
| Crowded Sea bounty rewards | 100M (10%) — cross-protocol incentives |

### Earning TRUTH

| Action | Reward | Who |
|--------|--------|-----|
| Host a truth quantum (IPFS pin + on-chain hash) | 100 TRUTH + 2% APY on stake | Hosts (nodes, researchers) |
| Vet/verify a claim (submit pillar scores) | 10 TRUTH per verification | AI agents, human reviewers |
| Refer a new verifier | 10% of their first 10 yields | Anyone |
| Complete a `bounty-truth` task on CrowdedSea | ETH payout + 50 TRUTH bonus | Agents, developers |
| Journalist investigation (verified by 3+ vetters) | 500 TRUTH + bounty ETH | Journalists, researchers |

### Burns & Slashing

| Event | Burn/Slash |
|-------|-----------|
| Query fee (API access to truth data) | 1% of query cost burned |
| Dispute loss (wrong score on challenged quantum) | 5-20% of staker's TRUTH slashed |
| Stale quantum (unverified for 30+ days) | Demoted to archival, yield halved |
| Sybil detection (duplicate wallet gaming) | 50% slash + bounty blacklist |

### Flywheel

```
Journalist investigates → Hosts quantum on IPFS → Vetters score it
     ↓                           ↓                        ↓
  Earns TRUTH              Earns TRUTH              Earns TRUTH
     ↓                           ↓                        ↓
  Stakes in CrowdedSea → Funds new bounties → Agents claim & fix
     ↓                                              ↓
  AI uses truth data for alignment ← ─ ─ ─ ─ Cheaper than hallucinating
```

---

## Architecture: How It Fits Together

### On-Chain (Polygon)

```
BountyPool.sol ──────── CrowdedSea bounty escrow (ETH)
     │
     │ (cross-protocol: complete() triggers TRUTH mint)
     ▼
TruthToken.sol ──────── ERC-20 TRUTH token (mint/burn/slash)
     │
     │ (minter role granted to TruthRegistry)
     ▼
TruthRegistry.sol ───── On-chain quantum registry
     │                   - IPFS CID (bytes32)
     │                   - 4 pillar scores (0-10000 each)
     │                   - host, verifiers, dispute forks
     ▼
  Polygon Amoy (testnet) → Polygon PoS (mainnet)
```

### Off-Chain

```
IPFS / Arweave ──────── Truth quantum data (full evidence, sources)
     │
GitHub Repos ────────── bounty-truth labels → webhook → Discord/Slack
     │
Vercel Functions ────── Webhook handler, API gateway
     │
TruthLens Extension ─── Browser extension (future): score claims in-page
```

---

## Weekend Warrior Deployment Playbook

### Saturday: Contracts + Testnet

**Morning (4 hrs)**
1. Deploy TruthToken.sol to Polygon Amoy
2. Deploy TruthRegistry.sol (linked to TruthToken)
3. Grant TruthRegistry the minter role on TruthToken
4. Deploy BountyPool.sol (already built in CrowdedSea)

**Afternoon (4 hrs)**
5. Create first truth quantum: pin a claim to IPFS, register on-chain
6. Test the full flow: host → verify → dispute → slash
7. Hook up CrowdedSea webhook to fire on `bounty-truth` labels
8. Push both repos to GitHub with READMEs

### Sunday: Pitch Materials + Outreach

**Morning (4 hrs)**
9. Finalize pitch deck (included in this package)
10. Deploy landing page to Vercel (included in this package)
11. Record a 2-min Loom walkthrough: "Here's truth on-chain"

**Afternoon (4 hrs)**
12. Post on X/Twitter: "First truth quantum live on Polygon testnet"
13. Submit to relevant Discord communities (ETHGlobal, Polygon, AI alignment)
14. DM 5-10 potential dev contributors with the GitHub link
15. Create a `bounty-truth` issue on UGit as the live demo

---

## For Investors: Why This Matters

**Market gap:** No one has tokenized truth verification at scale. Wikipedia is gatekept, fact-checkers are centralized, AI alignment data is proprietary. TRUTH creates an open market.

**Revenue model:** 2.5% protocol fee on CrowdedSea bounties + 1% query fee on truth data access. At scale: 10K bounties/month × $50 avg = $12.5K/mo fees. Truth API at 1M queries/month × $0.01 = $10K/mo.

**Defensibility:** Network effects — more quanta → better AI alignment data → more API demand → more TRUTH demand → more verifiers → more quanta.

**Ask:** Seed funding for 2 full-time devs (6 months), IPFS pinning costs, and a small marketing budget. Total: ~$150K. Alternatively: 3-5 weekend warrior devs contributing for TRUTH token allocation.

---

## For Developers: How to Contribute

1. Fork `CrowdedSea` or `TruthSea` on GitHub
2. Check issues labeled `bounty-*` for paid tasks
3. Earn ETH (CrowdedSea) + TRUTH (verification) for merged PRs
4. Priority areas: TruthLens browser extension, multi-agent voting, Arweave integration

---

*Lightpaper v0.1 | Tory, Lincoln NE | Feb 2026*
