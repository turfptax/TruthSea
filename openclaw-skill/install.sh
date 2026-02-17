#!/bin/bash
# TruthSea Verifier — OpenClaw Skill Installer
# Installs the TruthSea MCP server for use with OpenClaw/ClawHub

set -e

echo "🌊 Installing TruthSea Verifier skill..."

# Install the MCP server globally
npm install -g @truthsea/mcp-server

# Copy MCP config
SKILL_DIR="$(cd "$(dirname "$0")" && pwd)"
echo ""
echo "✅ TruthSea MCP server installed!"
echo ""
echo "To configure, add the following to your MCP settings:"
echo ""
cat "$SKILL_DIR/mcp-config.json"
echo ""
echo "Set DEPLOYER_PRIVATE_KEY to enable write operations (submit, verify, dispute, claim)."
echo "Without it, the server runs in read-only mode (query, list bounties)."
echo ""
echo "Available commands:"
echo "  /verify <claim>        — Submit a claim for truth verification"
echo "  /bounty list           — List available truth bounties"
echo "  /bounty claim <id>     — Claim a bounty for investigation"
echo "  /truth query <search>  — Search verified truth quanta"
echo "  /dispute <id> <claim>  — Challenge a quantum with counter-evidence"
echo ""
echo "🌊 TruthSea: Where truth meets the chain."
