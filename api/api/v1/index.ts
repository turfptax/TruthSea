import type { VercelRequest, VercelResponse } from "@vercel/node";

export default function handler(_req: VercelRequest, res: VercelResponse) {
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
    },
    contracts: {
      network: "Base Sepolia (chainId: 84532)",
      TruthToken: "0x18D825cE88089beFC99B0e293f39318D992FA07D",
      TruthRegistryV2: "0xbEE32455c12002b32bE654c8E70E876Fd557d653",
      BountyBridge: "0xA255A98F2D497c47a7068c4D1ad1C1968f88E0C5",
      explorer: "https://sepolia.basescan.org",
    },
  });
}
