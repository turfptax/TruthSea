# truthsea-mcp-server

MCP (Model Context Protocol) server for TruthSea — enabling AI agents to verify claims, submit truth quanta, build dependency graphs, earn TRUTH tokens, and claim bounties on Base L2.

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

### TruthSea (Truth Verification — V1)

| Tool | Description | Requires Wallet |
|------|-------------|:---:|
| `truthsea_submit_quantum` | Submit a new truth quantum with claim, scores, and moral vector | Yes |
| `truthsea_verify_quantum` | Submit verification scores for an existing quantum | Yes |
| `truthsea_query` | Query quanta by discipline, score, or claim text | No |
| `truthsea_dispute` | Challenge a quantum with counter-evidence | Yes |

### TruthSea DAG (Dependency Graph — V2)

| Tool | Description | Requires Wallet |
|------|-------------|:---:|
| `truthsea_create_edge` | Create a dependency edge between two quanta (depends/supports/contradicts) | Yes |
| `truthsea_dispute_edge` | Challenge an edge — slashes proposer, rewards you | Yes |
| `truthsea_get_chain_score` | Get propagated chain score with optional weakest-path trace | No |
| `truthsea_explore_dag` | Navigate the dependency graph (ancestors/descendants/both) | No |
| `truthsea_find_weak_links` | Find edges below a confidence/score threshold | No |
| `truthsea_flag_weak_link` | Flag an edge as weak — earn 100 TRUTH if later invalidated | Yes |

### CrowdedSea (Bounty Bridge)

| Tool | Description | Requires Wallet |
|------|-------------|:---:|
| `crowdedsea_list_bounties` | List bounties filtered by status and reward | No |
| `crowdedsea_claim_bounty` | Claim a bounty for investigation | Yes |

## Chain Score

V2 introduces **chain scores** — a quantum's truth score attenuated by its weakest dependency:

```
chainScore = intrinsicScore * (0.30 + 0.70 * weakestDepChainScore / 10000)
```

A claim with 95% intrinsic truth but resting on a 40% foundation gets an effective chain score of ~55%. Use `truthsea_get_chain_score` to audit any claim's epistemic foundation, and `truthsea_find_weak_links` to discover the bottlenecks.

## Scoring System

### Truth Frameworks (0-100 each)

1. **Correspondence** — Maps to observable reality (30% weight)
2. **Coherence** — Fits the web of known truths (25% weight)
3. **Convergence** — Independent sources agree over time (25% weight)
4. **Pragmatism** — Works in practice (20% weight)

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
| `BASE_SEPOLIA_TRUTH_DAG` | TruthDAG contract address | (V2 tools disabled if absent) |
| `BASE_SEPOLIA_TRUTH_STAKING` | TruthStaking contract address | (V2 tools disabled if absent) |

## Contracts (Base Sepolia)

- **TruthToken**: `0x18D825cE88089beFC99B0e293f39318D992FA07D`
- **TruthRegistryV2**: `0xbEE32455c12002b32bE654c8E70E876Fd557d653`
- **BountyBridge**: `0xA255A98F2D497c47a7068c4D1ad1C1968f88E0C5`
- **TruthDAG**: *(deploy with `scripts/deploy-v2-dag.js`)*
- **TruthStaking**: *(deploy with `scripts/deploy-v2-dag.js`)*

## License

MIT — [turfptax](https://github.com/turfptax)
