/**
 * TruthSea Data API Server
 *
 * REST + GraphQL API for truth quanta, bounties, and agent reputation.
 * Backed by PostgreSQL (Prisma) with on-chain event indexing.
 *
 * Usage:
 *   npm run dev     — development with hot reload
 *   npm run build   — compile TypeScript
 *   npm start       — production server
 *
 * @author turfptax
 * @license MIT
 */

import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import { ApolloServer } from "@apollo/server";
import { expressMiddleware } from "@apollo/server/express4";

import quantaRouter from "./routes/quanta.js";
import bountiesRouter from "./routes/bounties.js";
import disciplinesRouter from "./routes/disciplines.js";
import agentsRouter from "./routes/agents.js";
import edgesRouter from "./routes/edges.js";
import dagRouter from "./routes/dag.js";
import chainsRouter from "./routes/chains.js";
import { typeDefs, resolvers } from "./graphql/schema.js";

const PORT = Number(process.env.PORT) || 3001;
const app = express();

// ── Middleware ──

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors());
app.use(morgan("short"));
app.use(express.json());

// ── Health Check ──

app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    service: "truthsea-api",
    version: "1.0.0",
    network: process.env.TRUTHSEA_NETWORK || "base_sepolia",
  });
});

// ── REST Routes ──

app.use("/api/v1/quanta", quantaRouter);
app.use("/api/v1/bounties", bountiesRouter);
app.use("/api/v1/disciplines", disciplinesRouter);
app.use("/api/v1/agents", agentsRouter);

// V2: DAG endpoints
app.use("/api/v2/edges", edgesRouter);
app.use("/api/v2/dag", dagRouter);
app.use("/api/v2/chains", chainsRouter);

// ── GraphQL ──

async function startServer() {
  const apollo = new ApolloServer({ typeDefs, resolvers });
  await apollo.start();

  app.use(
    "/api/v1/graphql",
    expressMiddleware(apollo, {
      context: async ({ req }) => ({ req }),
    }) as any
  );

  // ── API Docs ──

  app.get("/api/v1", (_req, res) => {
    res.json({
      name: "TruthSea Data API",
      version: "1.0.0",
      endpoints: {
        rest: {
          "GET /api/v1/quanta": "List quanta (paginated, filterable)",
          "GET /api/v1/quanta/:id": "Get quantum by ID (full scores + moral vector)",
          "GET /api/v1/quanta/:id/verifications": "Get all verifications for a quantum",
          "GET /api/v1/quanta/search?q=": "Full-text search across claims",
          "GET /api/v1/bounties": "List bounties (filterable by status, discipline)",
          "GET /api/v1/bounties/:id": "Get bounty by ID with linked quantum",
          "GET /api/v1/disciplines": "List all discipline categories with counts",
          "GET /api/v1/agents/:address/reputation": "Get agent verification reputation",
          "GET /api/v1/agents/leaderboard": "Top agents by reputation score",
        },
        graphql: "POST /api/v1/graphql",
        v2_dag: {
          "GET /api/v2/edges": "List on-chain DAG edges (filterable)",
          "GET /api/v2/edges/:id": "Get edge with connected quanta",
          "GET /api/v2/edges/:id/flags": "Get weak link flags for edge",
          "GET /api/v2/dag/quantum/:id/ancestors": "Transitive dependencies (BFS up)",
          "GET /api/v2/dag/quantum/:id/descendants": "Dependents (BFS down)",
          "GET /api/v2/dag/quantum/:id/chain-score": "Propagated chain score",
          "GET /api/v2/dag/quantum/:id/weakest-path": "Critical path of weakest links",
          "GET /api/v2/dag/axioms": "Quanta with no dependencies (depth=0)",
          "GET /api/v2/dag/crowns": "Quanta with no dependents",
          "GET /api/v2/chains": "List chain definitions",
          "GET /api/v2/chains/:id": "Chain with nodes, edges, scores",
          "GET /api/v2/chains/:id/weakest-links": "Weakest links in chain",
        },
      },
      contracts: {
        network: "Base Sepolia (chainId: 84532)",
        TruthToken: "0x18D825cE88089beFC99B0e293f39318D992FA07D",
        TruthRegistryV2: "0xbEE32455c12002b32bE654c8E70E876Fd557d653",
        BountyBridge: "0xA255A98F2D497c47a7068c4D1ad1C1968f88E0C5",
        explorer: "https://sepolia.basescan.org",
      },
    });
  });

  // ── Start ──

  app.listen(PORT, () => {
    console.log(`\n🌊 TruthSea API running on http://localhost:${PORT}`);
    console.log(`   REST:    http://localhost:${PORT}/api/v1`);
    console.log(`   GraphQL: http://localhost:${PORT}/api/v1/graphql`);
    console.log(`   Health:  http://localhost:${PORT}/health\n`);
  });
}

startServer().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
