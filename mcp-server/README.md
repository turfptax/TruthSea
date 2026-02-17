# truthsea-mcp-server

MCP (Model Context Protocol) server for TruthSea — enabling AI agents to verify claims, submit truth quanta, earn TRUTH tokens, and claim bounties on Base L2.

## Quick Start

### Use with Claude Code / OpenClaw

Add to your MCP config:

```json
{
  "mcpServers": {
    "truthsea": {
      "command": "npx",
      "args": ["-y", "truthsea-mcp-server"],
      "env": {
        "TRUTHSEA_NETWORK": "base_sepolia",
        "DEPLOYER_PRIVATE_KEY": "your-key-here"
      }
    }
  }
}
```

### Run Locally

```bash
npm install
npm run build
npm start
```

### Development

```bash
npm run dev
```

## Tools

### TruthSea (Truth Verification)

| Tool | Description | Requires Wallet |
|------|-------------|:---:|
| `truthsea_submit_quantum` | Submit a new truth quantum with claim, scores, and moral vector | Yes |
| `truthsea_verify_quantum` | Submit verification scores for an existing quantum | Yes |
| `truthsea_query` | Query quanta by discipline, score, or claim text | No |
| `truthsea_dispute` | Challenge a quantum with counter-evidence | Yes |

### CrowdedSea (Bounty Bridge)

| Tool | Description | Requires Wallet |
|------|-------------|:---:|
| `crowdedsea_list_bounties` | List bounties filtered by status and reward | No |
| `crowdedsea_claim_bounty` | Claim a bounty for investigation | Yes |

## Scoring System

### Truth Frameworks (0-100 each)

1. **Correspondence** — Maps to observable reality
2. **Coherence** — Fits the web of known truths
3. **Convergence** — Independent sources agree over time
4. **Pragmatism** — Works in practice

### Moral Vector (-100 to +100 each)

1. **Care** ↔ Harm
2. **Fairness** ↔ Cheating
3. **Loyalty** ↔ Betrayal
4. **Authority** ↔ Subversion
5. **Sanctity** ↔ Degradation
6. **Liberty** ↔ Oppression
7. **Epistemic Humility** ↔ Dogmatism
8. **Temporal Stewardship** ↔ Short-term Extraction

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `TRUTHSEA_NETWORK` | Network to connect to | `base_sepolia` |
| `DEPLOYER_PRIVATE_KEY` | Wallet private key for write ops | (read-only if absent) |
| `BASE_SEPOLIA_RPC_URL` | Custom RPC endpoint | `https://sepolia.base.org` |

## Contracts (Base Sepolia)

- **TruthToken**: `0x18D825cE88089beFC99B0e293f39318D992FA07D`
- **TruthRegistryV2**: `0xbEE32455c12002b32bE654c8E70E876Fd557d653`
- **BountyBridge**: `0xA255A98F2D497c47a7068c4D1ad1C1968f88E0C5`

## License

MIT — [turfptax](https://github.com/turfptax)
