/**
 * POST /api/v1/graphql — GraphQL endpoint (Vercel serverless)
 */
import { ApolloServer } from "@apollo/server";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { PrismaClient } from "@prisma/client";
import gql from "graphql-tag";

const prisma = new PrismaClient();

const typeDefs = gql`
  type TruthScores {
    correspondence: Float!
    coherence: Float!
    convergence: Float!
    pragmatism: Float!
    aggregate: Float!
  }

  type MoralVector {
    care: Float!
    fairness: Float!
    loyalty: Float!
    authority: Float!
    sanctity: Float!
    liberty: Float!
    epistemicHumility: Float!
    temporalStewardship: Float!
    magnitude: Float!
  }

  type Quantum {
    id: Int!
    host: String!
    discipline: String!
    claim: String!
    status: String!
    truthScores: TruthScores!
    moralVector: MoralVector!
    verifierCount: Int!
    createdAt: String!
  }

  type Bounty {
    id: Int!
    poster: String!
    claimant: String
    rewardEth: Float!
    description: String!
    discipline: String!
    status: String!
    deadline: String!
  }

  type PaginatedQuanta {
    data: [Quantum!]!
    total: Int!
  }

  type PaginatedBounties {
    data: [Bounty!]!
    total: Int!
  }

  type Query {
    quantum(id: Int!): Quantum
    quanta(discipline: String, status: String, minScore: Float, page: Int, limit: Int): PaginatedQuanta!
    searchQuanta(query: String!, page: Int, limit: Int): PaginatedQuanta!
    bounties(status: String, page: Int, limit: Int): PaginatedBounties!
    disciplines: [Discipline!]!
  }

  type Discipline {
    name: String!
    quantumCount: Int!
    avgScore: Float!
  }
`;

const resolvers = {
  Query: {
    quantum: async (_: any, { id }: any) => prisma.quantum.findUnique({ where: { id } }),
    quanta: async (_: any, args: any) => {
      const take = Math.min(args.limit || 20, 100);
      const skip = ((args.page || 1) - 1) * take;
      const where: any = {};
      if (args.discipline) where.discipline = { equals: args.discipline, mode: "insensitive" };
      if (args.status) where.status = args.status.toUpperCase();
      if (args.minScore) where.aggregateScore = { gte: args.minScore };
      const [data, total] = await Promise.all([
        prisma.quantum.findMany({ where, orderBy: { createdAt: "desc" }, take, skip }),
        prisma.quantum.count({ where }),
      ]);
      return { data, total };
    },
    searchQuanta: async (_: any, args: any) => {
      const take = Math.min(args.limit || 20, 100);
      const skip = ((args.page || 1) - 1) * take;
      const where = { claim: { contains: args.query, mode: "insensitive" as const } };
      const [data, total] = await Promise.all([
        prisma.quantum.findMany({ where, orderBy: { aggregateScore: "desc" }, take, skip }),
        prisma.quantum.count({ where }),
      ]);
      return { data, total };
    },
    bounties: async (_: any, args: any) => {
      const take = Math.min(args.limit || 20, 100);
      const skip = ((args.page || 1) - 1) * take;
      const where: any = {};
      if (args.status) where.status = args.status.toUpperCase();
      const [data, total] = await Promise.all([
        prisma.bounty.findMany({ where, orderBy: { createdAt: "desc" }, take, skip }),
        prisma.bounty.count({ where }),
      ]);
      return { data, total };
    },
    disciplines: async () => {
      const groups = await prisma.quantum.groupBy({
        by: ["discipline"],
        _count: { id: true },
        _avg: { aggregateScore: true },
        orderBy: { _count: { id: "desc" } },
      });
      return groups.map((g: any) => ({
        name: g.discipline,
        quantumCount: g._count.id,
        avgScore: Math.round((g._avg.aggregateScore || 0) * 100) / 100,
      }));
    },
  },
  Quantum: {
    truthScores: (q: any) => ({
      correspondence: q.correspondence / 100,
      coherence: q.coherence / 100,
      convergence: q.convergence / 100,
      pragmatism: q.pragmatism / 100,
      aggregate: q.aggregateScore,
    }),
    moralVector: (q: any) => ({
      care: q.moralCare / 100,
      fairness: q.moralFairness / 100,
      loyalty: q.moralLoyalty / 100,
      authority: q.moralAuthority / 100,
      sanctity: q.moralSanctity / 100,
      liberty: q.moralLiberty / 100,
      epistemicHumility: q.moralEpistemicHumility / 100,
      temporalStewardship: q.moralTemporalStewardship / 100,
      magnitude: q.moralMagnitude,
    }),
  },
};

const server = new ApolloServer({ typeDefs, resolvers });
let started = false;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Use POST for GraphQL" });

  try {
    if (!started) {
      await server.start();
      started = true;
    }

    const result = await server.executeOperation({
      query: req.body.query,
      variables: req.body.variables,
      operationName: req.body.operationName,
    });

    if (result.body.kind === "single") {
      res.json(result.body.singleResult);
    } else {
      res.status(500).json({ error: "Unexpected response" });
    }
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}
