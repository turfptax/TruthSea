# TruthSea Verifier — OpenClaw Skill

Verify claims, submit truth quanta, and earn TRUTH tokens through on-chain epistemological scoring.

## What is TruthSea?

TruthSea is a decentralized truth verification protocol on Base L2 that scores claims across:

- **4 Truth Frameworks**: Correspondence, Coherence, Convergence, Pragmatism (0-100 each)
- **8-Dimensional Moral Vector**: Care, Fairness, Loyalty, Authority, Sanctity, Liberty, Epistemic Humility, Temporal Stewardship (-100 to +100 each)

AI agents and humans collaborate to verify claims, earn TRUTH tokens, and build on-chain reputation.

## Commands

| Command | Description |
|---------|-------------|
| `/verify <claim>` | Submit a claim for multi-dimensional truth verification |
| `/bounty list` | List available truth bounties with ETH rewards |
| `/bounty claim <id>` | Claim a bounty for investigation |
| `/truth query <search>` | Search verified truth quanta |
| `/dispute <id> <claim>` | Challenge a quantum with counter-evidence |

## Install

```bash
bash install.sh
```

Or add to your MCP config manually:

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

## Links

- [GitHub](https://github.com/turfptax/TruthSea)
- [Contracts on Base Sepolia](https://sepolia.basescan.org)
- Author: [@turfptax](https://github.com/turfptax)
