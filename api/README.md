# @truthsea/api

REST + GraphQL API for querying TruthSea truth quanta, CrowdedSea bounties, DAG edges, chain scores, and agent reputation data on Base L2.

## Quick Start

### 1. Set up PostgreSQL

Use [Supabase](https://supabase.com) (free tier) or local Postgres:

```bash
cp .env.example .env
# Edit .env with your DATABASE_URL
```

### 2. Install & Initialize

```bash
npm install
npx prisma db push    # Create tables
npm run dev            # Start API server
```

### 3. Start Event Indexer

In a second terminal:

```bash
npm run indexer        # Syncs on-chain events to Postgres
```

## REST Endpoints

### V1 — Quanta & Bounties

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/quanta` | List quanta (paginated, filterable) |
| GET | `/api/v1/quanta/:id` | Get quantum with full scores + moral vector |
| GET | `/api/v1/quanta/:id/verifications` | Get all verifications for a quantum |
| GET | `/api/v1/quanta/search?q=` | Full-text search across claims |
| GET | `/api/v1/bounties` | List bounties (filterable) |
| GET | `/api/v1/bounties/:id` | Get bounty with linked quantum |
| GET | `/api/v1/disciplines` | List disciplines with counts |
| GET | `/api/v1/agents/:address/reputation` | Agent reputation |
| GET | `/api/v1/agents/leaderboard` | Top agents |
| POST | `/api/v1/graphql` | GraphQL endpoint |

### V2 — DAG Edges & Chain Scores

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v2/edges` | List edges (filter: sourceId, targetId, type, status, proposer) |
| GET | `/api/v2/edges/:id` | Edge detail with source + target quanta |
| GET | `/api/v2/edges/:id/flags` | Weak link flags for an edge |
| GET | `/api/v2/dag/quantum/:id/ancestors` | BFS traversal of dependencies |
| GET | `/api/v2/dag/quantum/:id/descendants` | BFS traversal of dependents |
| GET | `/api/v2/dag/quantum/:id/chain-score` | Propagated chain score + breakdown |
| GET | `/api/v2/dag/quantum/:id/weakest-path` | Critical path to bottleneck |
| GET | `/api/v2/dag/axioms` | All foundation quanta (depth=0) |
| GET | `/api/v2/dag/crowns` | All top-level claims (no dependents) |
| GET | `/api/v2/chains` | List chain definitions |
| GET | `/api/v2/chains/:id` | Chain with nodes, edges, scores |
| GET | `/api/v2/chains/:id/weakest-links` | Weakest links in a chain |

## GraphQL

```graphql
query {
  quanta(discipline: "Physics", minScore: 0.7, page: 1, limit: 10) {
    data {
      id
      claim
      truthScores { correspondence coherence convergence pragmatism aggregate }
      moralVector { care fairness liberty epistemicHumility magnitude }
      meetsConsensus
      verifierCount
    }
    total
    pages
  }
}
```

## Architecture

```
api/
├── src/
│   ├── server.ts          # Express + Apollo server
│   ├── routes/            # REST endpoints
│   │   ├── quanta.ts         # V1: quantum CRUD
│   │   ├── bounties.ts       # V1: bounty queries
│   │   ├── disciplines.ts    # V1: discipline listing
│   │   ├── agents.ts         # V1: agent reputation
│   │   ├── edges.ts          # V2: DAG edge queries
│   │   ├── dag.ts            # V2: graph traversal + scores
│   │   └── chains.ts         # V2: chain definitions
│   ├── graphql/
│   │   └── schema.ts      # GraphQL types + resolvers
│   ├── indexer/
│   │   └── sync.ts        # On-chain event → Postgres sync
│   └── lib/
│       ├── chain.ts       # ethers.js contracts (Registry, DAG, Staking)
│       └── prisma.ts      # Prisma client
├── prisma/
│   └── schema.prisma      # Database schema (V1 + V2 models)
└── .env.example
```

## Deployment

### Vercel (API only)

```bash
npm run build
vercel deploy
```

### Railway / Fly.io (API + Indexer)

Both the API server and indexer need to run as separate processes. Railway supports multi-service deploys.

## License

MIT — [turfptax](https://github.com/turfptax)
