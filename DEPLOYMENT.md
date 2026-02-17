# TruthSea Deployment Guide

Deploy the TruthSea stack for **$0/month** (free tiers) with easy scaling when needed.

## Architecture

```
┌─────────────────┐     ┌──────────────────┐
│  Vercel (Free)  │────▶│ Supabase Postgres │◀──── Event Indexer
│  API + GraphQL  │     │   (Free tier)     │      (Railway Free)
└────────┬────────┘     └──────────────────┘
         │                       ▲
         │              ┌────────┴────────┐
         └─────────────▶│  Base Sepolia    │
                        │  Smart Contracts │
                        └─────────────────┘
```

## Step 1: Deploy API to Vercel (Free)

```bash
# Install Vercel CLI
npm i -g vercel

# From the api/ directory
cd api

# Login & deploy
vercel login
vercel

# Set environment variables
vercel env add DATABASE_URL         # paste your Supabase pooler URL
vercel env add BASE_SEPOLIA_REGISTRY_V2    # 0xbEE32455c12002b32bE654c8E70E876Fd557d653
vercel env add BASE_SEPOLIA_BOUNTY_BRIDGE  # 0xA255A98F2D497c47a7068c4D1ad1C1968f88E0C5
vercel env add BASE_SEPOLIA_TRUTH_TOKEN    # 0x18D825cE88089beFC99B0e293f39318D992FA07D

# Deploy to production
vercel --prod
```

Your API will be at: `https://your-project.vercel.app/api/v1`

**Free tier limits:** 100GB bandwidth, 100K function invocations/month

## Step 2: Deploy Indexer to Railway (Free)

The event indexer is a persistent process that can't run on Vercel (serverless). Railway's free tier is perfect.

```bash
# Install Railway CLI
npm i -g @railway/cli

# Login
railway login

# From the api/ directory
cd api

# Create project and deploy
railway init
railway up

# Set environment variables in Railway dashboard:
# DATABASE_URL = your Supabase pooler URL
# BASE_SEPOLIA_RPC_URL = https://sepolia.base.org
# BASE_SEPOLIA_REGISTRY_V2 = 0xbEE32455c12002b32bE654c8E70E876Fd557d653
# BASE_SEPOLIA_BOUNTY_BRIDGE = 0xA255A98F2D497c47a7068c4D1ad1C1968f88E0C5
```

**Free tier limits:** 500 hours/month, 512MB RAM, 1GB disk

## Step 3: Publish MCP Server to npm

```bash
cd mcp-server
npm publish --access public
```

Now anyone can use TruthSea via:
```json
{
  "mcpServers": {
    "truthsea": {
      "command": "npx",
      "args": ["-y", "@truthsea/mcp-server"]
    }
  }
}
```

## Cost Breakdown

| Service | Free Tier | First Paid Tier | When to Upgrade |
|---------|-----------|-----------------|-----------------|
| **Vercel** | 100K requests/mo | $20/mo (Pro) | >100K API calls |
| **Railway** | 500 hrs/mo | $5/mo (Hobby) | Always-on needed |
| **Supabase** | 500MB, 50K rows | $25/mo (Pro) | >500MB data |
| **Base Sepolia** | Free testnet | Gas costs on mainnet | Going to production |
| **npm** | Free forever | Free forever | Never |

**Total to start: $0/month**
**Total at scale: ~$50/month** (handles thousands of users)

## Going to Production (Base Mainnet)

When ready to go live:

1. Deploy contracts to Base Mainnet: `npx hardhat run scripts/deploy-v2.js --network base`
2. Update all env vars with mainnet addresses
3. Switch RPC URL to `https://mainnet.base.org`
4. Fund deployer wallet with real ETH on Base
5. Upgrade Supabase to Pro if needed

## Domain Setup (Optional)

Point a custom domain to your Vercel deployment:
- `api.truthsea.xyz` → Vercel project
- Configure in Vercel Dashboard → Settings → Domains
