/**
 * TruthSea Data API Server
 *
 * REST + GraphQL API for truth quanta, bounties, and agent reputation.
 * Backed by PostgreSQL (Prisma) with on-chain event indexing.
 *
 * Security:
 *   - Helmet for HTTP security headers (CSP enabled)
 *   - CORS origin whitelist (configurable via CORS_ORIGINS env)
 *   - Rate limiting (100 req/min global, 30 req/min GraphQL)
 *   - Global error handler (no stack trace leaks in production)
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
import rateLimit from "express-rate-limit";
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

// ── Security Middleware ──

// HTTP security headers with Content Security Policy
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: [
          "'self'",
          "'unsafe-inline'",
          "https://cdn.tailwindcss.com",
          "https://cdn.jsdelivr.net",
        ],
        styleSrc: [
          "'self'",
          "'unsafe-inline'",
          "https://fonts.googleapis.com",
          "https://cdn.tailwindcss.com",
        ],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        imgSrc: ["'self'", "data:"],
        connectSrc: ["'self'"],
      },
    },
  })
);

// CORS with origin whitelist
const allowedOrigins = (
  process.env.CORS_ORIGINS || "http://localhost:3001"
).split(",");
app.use(
  cors({
    origin: allowedOrigins,
    methods: ["GET", "POST"],
    allowedHeaders: ["Content-Type", "Authorization", "X-API-Key"],
  })
);

// Global rate limiter: 100 requests per minute per IP
const globalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests, please try again later" },
});
app.use(globalLimiter);

// Stricter rate limiter for GraphQL: 30 requests per minute per IP
const graphqlLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "GraphQL rate limit exceeded" },
});

app.use(morgan("short"));
app.use(express.json());

// ── Static Files ──

app.use(express.static("public"));

// ── Health Check ──

app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    service: "truthsea-api",
    version: "2.5.0",
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
    graphqlLimiter,
    expressMiddleware(apollo, {
      context: async ({ req }) => ({ req }),
    }) as any
  );

  // ── API Docs ──

  app.get("/api/v1", (_req, res) => {
    res.json({
      name: "TruthSea Data API",
      version: "2.5.0",
      endpoints: {
        rest: {
          "GET /api/v1/quanta": "List quanta (paginated, filterable)",
          "GET /api/v1/quanta/:id":
            "Get quantum by ID (full scores + moral vector)",
          "GET /api/v1/quanta/:id/verifications":
            "Get all verifications for a quantum",
          "GET /api/v1/quanta/search?q=":
            "Full-text search across claims",
          "GET /api/v1/bounties":
            "List bounties (filterable by status, discipline)",
          "GET /api/v1/bounties/:id":
            "Get bounty by ID with linked quantum",
          "GET /api/v1/disciplines":
            "List all discipline categories with counts",
          "GET /api/v1/agents/:address/reputation":
            "Get agent verification reputation",
          "GET /api/v1/agents/leaderboard":
            "Top agents by reputation score",
        },
        graphql: "POST /api/v1/graphql",
        v2_dag: {
          "GET /api/v2/edges": "List on-chain DAG edges (filterable)",
          "GET /api/v2/edges/:id": "Get edge with connected quanta",
          "GET /api/v2/edges/:id/flags":
            "Get weak link flags for edge",
          "GET /api/v2/dag/quantum/:id/ancestors":
            "Transitive dependencies (BFS up)",
          "GET /api/v2/dag/quantum/:id/descendants":
            "Dependents (BFS down)",
          "GET /api/v2/dag/quantum/:id/chain-score":
            "Propagated chain score",
          "GET /api/v2/dag/quantum/:id/weakest-path":
            "Critical path of weakest links",
          "GET /api/v2/dag/axioms":
            "Quanta with no dependencies (depth=0)",
          "GET /api/v2/dag/crowns": "Quanta with no dependents",
          "GET /api/v2/chains": "List chain definitions",
          "GET /api/v2/chains/:id": "Chain with nodes, edges, scores",
          "GET /api/v2/chains/:id/weakest-links":
            "Weakest links in chain",
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

  // ── Global Error Handler ──

  app.use(
    (
      err: any,
      _req: express.Request,
      res: express.Response,
      _next: express.NextFunction
    ) => {
      console.error("Unhandled error:", err.message);
      res.status(err.status || 500).json({
        error:
          process.env.NODE_ENV === "production"
            ? "Internal server error"
            : err.message,
      });
    }
  );

  // ── Start ──

  app.listen(PORT, () => {
    console.log(`\n🌊 TruthSea API running on http://localhost:${PORT}`);
    console.log(`   REST:    http://localhost:${PORT}/api/v1`);
    console.log(`   GraphQL: http://localhost:${PORT}/api/v1/graphql`);
    console.log(`   Health:  http://localhost:${PORT}/health`);
    console.log(`   Security: rate-limiting, CORS whitelist, CSP enabled\n`);
  });
}

startServer().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
