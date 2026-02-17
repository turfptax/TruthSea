#!/usr/bin/env node

/**
 * TruthSea MCP Server
 *
 * Model Context Protocol server that lets AI agents interact with
 * TruthSea (truth verification) and CrowdedSea (bounty bridge) on Base L2.
 *
 * Tools:
 *   truthsea_submit_quantum  — Submit a new truth quantum
 *   truthsea_verify_quantum  — Verify an existing quantum
 *   truthsea_query           — Query/search quanta
 *   truthsea_dispute         — Challenge a quantum
 *   crowdedsea_list_bounties — List bounties
 *   crowdedsea_claim_bounty  — Claim a bounty
 *
 * Transport: stdio (default) or SSE (set TRUTHSEA_TRANSPORT=sse)
 *
 * @author turfptax
 * @license MIT
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { initContracts, hasSigner } from "./contracts.js";
import { getNetworkConfig } from "./config.js";

// Tools
import { submitQuantumSchema, submitQuantum } from "./tools/submitQuantum.js";
import { verifyQuantumSchema, verifyQuantum } from "./tools/verifyQuantum.js";
import { queryQuantaSchema, queryQuanta } from "./tools/queryQuanta.js";
import { disputeQuantumSchema, disputeQuantum } from "./tools/disputeQuantum.js";
import { listBountiesSchema, listBounties } from "./tools/listBounties.js";
import { claimBountySchema, claimBounty } from "./tools/claimBounty.js";

// ── Initialize ──

initContracts();
const config = getNetworkConfig();
const writeMode = hasSigner();

console.error(`[TruthSea MCP] Network: ${process.env.TRUTHSEA_NETWORK || "base_sepolia"}`);
console.error(`[TruthSea MCP] Registry: ${config.registryAddress}`);
console.error(`[TruthSea MCP] BountyBridge: ${config.bountyBridgeAddress}`);
console.error(`[TruthSea MCP] Mode: ${writeMode ? "read/write" : "read-only (no private key)"}`);

// ── Create MCP Server ──

const server = new McpServer({
  name: "truthsea",
  version: "1.0.0",
});

// ── Register Tools ──

// 1. Submit Quantum
server.tool(
  "truthsea_submit_quantum",
  "Submit a new truth quantum for verification on TruthSea. Requires a claim, discipline, initial truth scores (correspondence, coherence, convergence, pragmatism on 0-100 scale), and an 8-dimensional moral vector (care, fairness, loyalty, authority, sanctity, liberty, epistemic_humility, temporal_stewardship on -100 to +100 scale). Returns the created quantum with ID and transaction hash.",
  submitQuantumSchema.shape,
  async (params) => {
    try {
      const result = await submitQuantum(params);
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
    } catch (err: any) {
      return {
        content: [{ type: "text", text: `Error: ${err.message}` }],
        isError: true,
      };
    }
  }
);

// 2. Verify Quantum
server.tool(
  "truthsea_verify_quantum",
  "Submit verification scores for an existing truth quantum. Provide your truth scores (0-100 each for correspondence, coherence, convergence, pragmatism) and moral vector (-100 to +100 each for 8 dimensions). Scores are rolling-averaged with existing verifications. Earns TRUTH tokens.",
  verifyQuantumSchema.shape,
  async (params) => {
    try {
      const result = await verifyQuantum(params);
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
    } catch (err: any) {
      return {
        content: [{ type: "text", text: `Error: ${err.message}` }],
        isError: true,
      };
    }
  }
);

// 3. Query Quanta
server.tool(
  "truthsea_query",
  "Query truth quanta on TruthSea. Filter by discipline (e.g. Physics, Ethics), minimum aggregate truth score, or search claim text. Returns matching quanta with full scores and moral vectors. Read-only — no wallet required.",
  queryQuantaSchema.shape,
  async (params) => {
    try {
      const result = await queryQuanta(params);
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
    } catch (err: any) {
      return {
        content: [{ type: "text", text: `Error: ${err.message}` }],
        isError: true,
      };
    }
  }
);

// 4. Dispute Quantum
server.tool(
  "truthsea_dispute",
  "Challenge an existing truth quantum with counter-evidence. Creates a fork quantum with your counter-claim and scores. The original host is slashed 10% TRUTH tokens, and you earn the host reward. Requires the quantum to be Active.",
  disputeQuantumSchema.shape,
  async (params) => {
    try {
      const result = await disputeQuantum(params);
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
    } catch (err: any) {
      return {
        content: [{ type: "text", text: `Error: ${err.message}` }],
        isError: true,
      };
    }
  }
);

// 5. List Bounties
server.tool(
  "crowdedsea_list_bounties",
  "List truth bounties from CrowdedSea BountyBridge. Filter by status (open, claimed, pending, completed, refunded, all) and minimum ETH reward. Returns bounty details including description, discipline, reward, deadline, and linked quantum ID.",
  listBountiesSchema.shape,
  async (params) => {
    try {
      const result = await listBounties(params);
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
    } catch (err: any) {
      return {
        content: [{ type: "text", text: `Error: ${err.message}` }],
        isError: true,
      };
    }
  }
);

// 6. Claim Bounty
server.tool(
  "crowdedsea_claim_bounty",
  "Claim a truth bounty for investigation. Optionally link your ERC-8004 agent identity for reputation tracking. Once claimed, investigate the bounty topic, create a TruthQuantum with your findings, and complete the bounty to earn the ETH reward.",
  claimBountySchema.shape,
  async (params) => {
    try {
      const result = await claimBounty(params);
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
    } catch (err: any) {
      return {
        content: [{ type: "text", text: `Error: ${err.message}` }],
        isError: true,
      };
    }
  }
);

// ── Start Server ──

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("[TruthSea MCP] Server running on stdio");
}

main().catch((err) => {
  console.error("[TruthSea MCP] Fatal error:", err);
  process.exit(1);
});
