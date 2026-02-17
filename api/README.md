# @truthsea/api

REST + GraphQL API for querying TruthSea truth quanta, CrowdedSea bounties, and agent reputation data on Base L2.

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
│   │   ├── quanta.ts
│   │   ├── bounties.ts
│   │   ├── disciplines.ts
│   │   └── agents.ts
│   ├── graphql/
│   │   └── schema.ts      # GraphQL types + resolvers
│   ├── indexer/
│   │   └── sync.ts        # On-chain event → Postgres sync
│   └── lib/
│       ├── chain.ts       # ethers.js contracts
│       └── prisma.ts      # Prisma client
├── prisma/
│   └── schema.prisma      # Database schema
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
