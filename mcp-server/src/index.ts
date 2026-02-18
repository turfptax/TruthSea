#!/usr/bin/env node

/**
 * TruthSea MCP Server
 *
 * Model Context Protocol server that lets AI agents interact with
 * TruthSea (truth verification) and CrowdedSea (bounty bridge) on Base L2.
 *
 * Tools (V1):
 *   truthsea_submit_quantum  — Submit a new truth quantum
 *   truthsea_verify_quantum  — Verify an existing quantum
 *   truthsea_query           — Query/search quanta
 *   truthsea_dispute         — Challenge a quantum
 *   crowdedsea_list_bounties — List bounties
 *   crowdedsea_claim_bounty  — Claim a bounty
 *
 * Tools (V2 — DAG):
 *   truthsea_create_edge     — Create dependency edge between quanta
 *   truthsea_dispute_edge    — Challenge an existing edge
 *   truthsea_get_chain_score — Get propagated chain score
 *   truthsea_explore_dag     — Navigate the dependency graph
 *   truthsea_find_weak_links — Find edges below threshold
 *   truthsea_flag_weak_link  — Flag an edge as potentially weak
 *
 * Transport: stdio (default) or SSE (set TRUTHSEA_TRANSPORT=sse)
 *
 * @author turfptax
 * @license MIT
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { initContracts, hasSigner, hasDAG } from "./contracts.js";
import { getNetworkConfig } from "./config.js";

// V1 Tools
import { submitQuantumSchema, submitQuantum } from "./tools/submitQuantum.js";
import { verifyQuantumSchema, verifyQuantum } from "./tools/verifyQuantum.js";
import { queryQuantaSchema, queryQuanta } from "./tools/queryQuanta.js";
import { disputeQuantumSchema, disputeQuantum } from "./tools/disputeQuantum.js";
import { listBountiesSchema, listBounties } from "./tools/listBounties.js";
import { claimBountySchema, claimBounty } from "./tools/claimBounty.js";

// V2 DAG Tools
import { createEdgeSchema, createEdge } from "./tools/createEdge.js";
import { disputeEdgeSchema, disputeEdge } from "./tools/disputeEdge.js";
import { getChainScoreSchema, getChainScore } from "./tools/getChainScore.js";
import { exploreDAGSchema, exploreDAG } from "./tools/exploreDAG.js";
import { findWeakLinksSchema, findWeakLinks } from "./tools/findWeakLinks.js";
import { flagWeakLinkSchema, flagWeakLink } from "./tools/flagWeakLink.js";

// ── Initialize ──

initContracts();
const config = getNetworkConfig();
const writeMode = hasSigner();

const dagEnabled = hasDAG();

console.error(`[TruthSea MCP] Network: ${process.env.TRUTHSEA_NETWORK || "base_sepolia"}`);
console.error(`[TruthSea MCP] Registry: ${config.registryAddress}`);
console.error(`[TruthSea MCP] BountyBridge: ${config.bountyBridgeAddress}`);
if (dagEnabled) {
  console.error(`[TruthSea MCP] TruthDAG: ${config.truthDAGAddress}`);
  console.error(`[TruthSea MCP] TruthStaking: ${config.truthStakingAddress}`);
}
console.error(`[TruthSea MCP] Mode: ${writeMode ? "read/write" : "read-only (no private key)"}`);
console.error(`[TruthSea MCP] V2 DAG: ${dagEnabled ? "enabled" : "disabled (no DAG address)"}`);

// ── Create MCP Server ──

const server = new McpServer({
  name: "truthsea",
  version: "2.0.0",
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

// ── V2 DAG Tools (only registered if TruthDAG is configured) ──

if (dagEnabled) {
  // 7. Create Edge
  server.tool(
    "truthsea_create_edge",
    "Create a dependency edge between two truth quanta in the TruthSea DAG. Declare that one quantum depends on, supports, or contradicts another. Requires TRUTH token stake. Edge types: 'depends' (epistemological dependency — the target's truth relies on the source), 'supports' (corroborating evidence), 'contradicts' (counter-evidence). Confidence (0-100) indicates the strength of the inferential link.",
    createEdgeSchema.shape,
    async (params) => {
      try {
        const result = await createEdge(params);
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

  // 8. Dispute Edge
  server.tool(
    "truthsea_dispute_edge",
    "Challenge an existing edge in the TruthSea DAG. Marks the edge as Disputed, slashes the proposer's TRUTH stake by 10%, and transfers 60% of the remaining stake to you. You also earn TRUTH tokens. Use this when you believe a dependency relationship is incorrect or unjustified.",
    disputeEdgeSchema.shape,
    async (params) => {
      try {
        const result = await disputeEdge(params);
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

  // 9. Get Chain Score
  server.tool(
    "truthsea_get_chain_score",
    "Get the propagated chain score for a truth quantum. The chain score attenuates a quantum's intrinsic truth score by its weakest dependency — a brilliant inference built on shaky evidence scores lower. Optionally trace the critical path of weakest links to find the bottleneck. Read-only — no wallet required.",
    getChainScoreSchema.shape,
    async (params) => {
      try {
        const result = await getChainScore(params);
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

  // 10. Explore DAG
  server.tool(
    "truthsea_explore_dag",
    "Navigate the TruthSea dependency graph around a quantum. Traverse ancestors (what it depends on), descendants (what depends on it), or both. Returns a subgraph of connected quanta with their chain scores and the edges between them. Read-only — no wallet required.",
    exploreDAGSchema.shape,
    async (params) => {
      try {
        const result = await exploreDAG(params);
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

  // 11. Find Weak Links
  server.tool(
    "truthsea_find_weak_links",
    "Find weak links in a quantum's dependency chain. Traverses the DAG and identifies edges with confidence or chain scores below a threshold. Useful for auditing the epistemic foundation of any claim. Read-only — no wallet required.",
    findWeakLinksSchema.shape,
    async (params) => {
      try {
        const result = await findWeakLinks(params);
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

  // 12. Flag Weak Link
  server.tool(
    "truthsea_flag_weak_link",
    "Flag an edge as a potential weak link in the TruthSea DAG. If the edge is later invalidated or disputed within 30 days, you earn a 100 TRUTH bounty. Use this after identifying weak links with truthsea_find_weak_links.",
    flagWeakLinkSchema.shape,
    async (params) => {
      try {
        const result = await flagWeakLink(params);
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
}

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
