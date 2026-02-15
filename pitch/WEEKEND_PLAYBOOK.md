# Weekend Warrior Deployment Playbook

*You + Claude. Two days. Ship it.*

---

## Prerequisites (15 min)

- [ ] MetaMask wallet with a fresh account for testnet
- [ ] Node.js 20+ installed
- [ ] Git configured
- [ ] GitHub account with a test repo (e.g., UGit)
- [ ] Discord server with a channel for bounty alerts (or create one)
- [ ] Vercel account (free tier is fine)

---

## Saturday: Smart Contracts + Infrastructure

### Morning Block (4 hours)

#### 1. Get Testnet Funds (10 min)
```bash
# Go to Polygon Amoy faucet
open https://faucet.polygon.technology/
# Select "Amoy" → paste your wallet address → request POL
# Backup: https://www.alchemy.com/faucets/polygon-amoy
```

#### 2. Deploy CrowdedSea Contracts (30 min)
```bash
cd CrowdedSea
npm install
cp .env.example .env
# Edit .env: add DEPLOYER_PRIVATE_KEY, AMOY_RPC_URL

# Test locally first
npm test  # all 15 tests should pass

# Deploy to Amoy
npm run deploy:amoy
# Save the contract address → put in .env as BOUNTYPOOL_ADDRESS
```

#### 3. Deploy TruthSea Contracts (30 min)
```bash
cd TruthSea
npm install
# Add Hardhat config (copy pattern from CrowdedSea)

# Deploy TruthToken first
npx hardhat run scripts/deploy-truth-token.js --network amoy
# Save address → TRUTH_TOKEN_ADDRESS

# Deploy TruthRegistry (needs TruthToken address)
npx hardhat run scripts/deploy-registry.js --network amoy
# Save address → TRUTH_REGISTRY_ADDRESS

# Grant TruthRegistry the minter role on TruthToken
npx hardhat run scripts/grant-minter.js --network amoy
```

#### 4. Create First Truth Quantum (30 min)
```bash
# Pin a claim to IPFS (use web3.storage or nft.storage — both free)
# Claim: "96% of GitHub repos have no active maintainer (2024)"
# Upload evidence JSON to IPFS → get CID

# Register on-chain via Hardhat console:
npx hardhat console --network amoy
> const reg = await ethers.getContractAt("TruthRegistry", "0x...");
> await reg.createQuantum(
    ethers.encodeBytes32String("bafybei..."),  // IPFS CID digest
    "Technology",
    "96% of GitHub repos have no active maintainer (2024)",
    { correspondence: 8500, coherence: 7000, pragmatism: 9200, relativism: 6000 }
  );
```

#### 5. Push Repos to GitHub (20 min)
```bash
# CrowdedSea
cd CrowdedSea
git init && git add -A && git commit -m "Initial: BountyPool + Actions + Webhook"
gh repo create CrowdedSea --public --push

# TruthSea
cd ../TruthSea
git init && git add -A && git commit -m "Initial: TruthToken + TruthRegistry + Pitch"
gh repo create TruthSea --public --push
```

### Afternoon Block (4 hours)

#### 6. Set Up Discord Webhook (15 min)
```
Discord → Server Settings → Integrations → Webhooks → New Webhook
Name: "CrowdedSea Bounty Bot"
Channel: #bounties
Copy webhook URL → save for Vercel env
```

#### 7. Deploy Vercel Webhook Function (30 min)
```bash
cd CrowdedSea
npm install -g vercel
vercel
# Follow prompts → link to CrowdedSea repo
# In Vercel dashboard → Settings → Environment Variables:
#   GITHUB_WEBHOOK_SECRET = (generate with: openssl rand -hex 20)
#   DISCORD_WEBHOOK_URL = (from step 6)
#   SLACK_WEBHOOK_URL = (optional)
```

#### 8. Configure GitHub Webhook (15 min)
```
GitHub → CrowdedSea repo → Settings → Webhooks → Add webhook
Payload URL: https://your-app.vercel.app/api/webhook
Content type: application/json
Secret: (same as GITHUB_WEBHOOK_SECRET)
Events: ✓ Issues, ✓ Pull requests
```

#### 9. Set GitHub Action Secrets (10 min)
```
GitHub → CrowdedSea repo → Settings → Secrets → Actions
Add: AMOY_RPC_URL
Add: BOUNTYPOOL_ADDRESS
```

#### 10. Test the Full Loop (30 min)
```bash
# Create a test issue on your UGit or CrowdedSea repo
gh issue create --title "Fix OTA timeout handling" \
  --body "Timeout on OTA updates needs retry logic. Bounty: 0.001 ETH" \
  --label "bounty-bug"

# Check Discord — should see: "🌊 CrowdedSea — New Bounty Live!"

# Create a test PR
git checkout -b fix/ota-timeout
echo "// retry logic" >> src/ota.js
git add . && git commit -m "Fix OTA timeout"
git push -u origin fix/ota-timeout
gh pr create --title "Fix OTA timeout" --body "Adds retry logic"

# Check: GitHub Action should run tests + post balance comment
# Add 'approved' label when ready → auto-merge fires
```

---

## Sunday: Pitch Materials + Outreach

### Morning Block (4 hours)

#### 11. Deploy Landing Page (20 min)
```bash
# The landing page is in TruthSea/pitch/index.html
# Option A: Deploy to Vercel
cd TruthSea/pitch
vercel --prod
# Your site: https://crowdedsea.vercel.app

# Option B: If you own CrowdedSea.io
# Point domain to Vercel in DNS settings
```

#### 12. Review + Customize Pitch Deck (30 min)
```
Open TruthSea/pitch/CrowdedSea_Pitch_Deck.pptx in PowerPoint
- Update contract addresses with real deployed ones
- Add your personal story (the Zatara's watch narrative)
- Tweak any numbers based on actual testnet results
```

#### 13. Record a Loom Walkthrough (30 min)
```
Script:
1. "This is CrowdedSea — crypto bounties for open-source" (show landing page)
2. "I deployed this contract 24 hours ago" (show Polygonscan)
3. "Watch: I label an issue..." (do it live, show Discord alert)
4. "Agents deposit, work, PR, auto-merge, payout" (show the flow)
5. "Plus: TRUTH token for verified reality" (show TruthRegistry)
6. "Weekend build. Looking for 3-5 devs to join." (CTA)
```

### Afternoon Block (4 hours)

#### 14. Social Media Push
```
X/Twitter post:
"Built a crypto bounty system for AI agents in a weekend.

Agents deposit ETH to claim GitHub issues.
Tests pass + human approves = auto-merge + payout.

Plus: a TRUTH token for verified reality.

Contracts live on Polygon testnet. Looking for devs.

[link to repo] [link to landing page]"
```

#### 15. Community Outreach
```
Post to:
- r/ethereum — "Show & Tell: Agent-funded bounties on Polygon"
- ETHGlobal Discord — #showcase channel
- Polygon Discord — #builders channel
- AI alignment forums — "Tokenized truth verification"
- Hacker News — "Show HN: CrowdedSea"

DM 5-10 devs who:
- Contribute to open-source bounty platforms
- Build AI agent frameworks
- Work on Web3 + AI intersections
```

#### 16. Create First Real Bounty (15 min)
```bash
# On your UGit repo (or any repo you own):
gh issue create --title "Add retry logic to OTA timeout — 0.001 ETH bounty" \
  --body "First CrowdedSea bounty! Fix the OTA timeout, earn 0.001 ETH on Amoy testnet." \
  --label "bounty-bug"

# Deposit 0.001 ETH to BountyPool via Hardhat console:
npx hardhat console --network amoy
> const pool = await ethers.getContractAt("BountyPool", "0x...");
> await pool.deposit("your-user/UGit#1", { value: ethers.parseEther("0.001") });
```

---

## What You'll Have by Sunday Night

| Deliverable | Status |
|-------------|--------|
| BountyPool.sol deployed on Polygon Amoy | Testnet |
| TruthToken.sol (ERC-20) deployed | Testnet |
| TruthRegistry.sol deployed | Testnet |
| GitHub Action (tests + balance + auto-merge) | Live |
| Webhook → Discord + Slack | Live |
| Landing page on Vercel | Live |
| Pitch deck (8 slides, investor-ready) | Done |
| Tokenomics doc | Done |
| First truth quantum on IPFS | Live |
| First real bounty on a repo | Live |
| Social media announcement | Posted |

---

## Scaling: Week 2 and Beyond

| Week | Goal | Who |
|------|------|-----|
| Week 2 | Recruit 3-5 weekend warrior devs from outreach | You |
| Week 3 | Multi-agent voting on PR quality | Dev team |
| Week 4 | TruthLens browser extension MVP | Dev team |
| Month 2 | 100 quanta live, 10+ active bounties | Community |
| Month 3 | ClawHub/OpenClaw skill integration | Dev team |
| Q3 2026 | Multi-chain deploy (Base for cheap votes) | Dev team |
| Q4 2026 | Mainnet launch + Paradigm DAOs | Full team |

---

## Cost Estimate (Weekend)

| Item | Cost |
|------|------|
| Polygon Amoy testnet gas | Free (faucet) |
| Vercel hosting | Free tier |
| IPFS pinning (web3.storage) | Free tier |
| Domain (CrowdedSea.io) | ~$12/year |
| Discord server | Free |
| Your time + Claude tokens | Priceless |

**Total cash outlay: ~$12**

---

*The sea gets crowded — good. More ships, more cargo, more freedom.*
