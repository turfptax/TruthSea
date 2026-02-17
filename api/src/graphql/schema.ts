/**
 * TruthSea GraphQL Schema + Resolvers
 */

import gql from "graphql-tag";
import { prisma } from "../lib/prisma.js";
import { registry } from "../lib/chain.js";

// ── Type Definitions ──

export const typeDefs = gql`
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
    ipfsCid: String!
    discipline: String!
    claim: String!
    status: String!
    truthScores: TruthScores!
    moralVector: MoralVector!
    stakeAmount: String!
    verifierCount: Int!
    erc8004AgentId: String
    meetsConsensus: Boolean
    createdAt: String!
    verifications: [Verification!]!
  }

  type Verification {
    id: Int!
    verifier: String!
    txHash: String!
    truthScores: TruthScores!
    moralVector: MoralVector!
    erc8004AgentId: String
    createdAt: String!
  }

  type Bounty {
    id: Int!
    poster: String!
    claimant: String
    reward: String!
    rewardEth: Float!
    description: String!
    discipline: String!
    quantumId: Int
    status: String!
    createdAt: String!
    deadline: String!
    expired: Boolean!
    quantum: Quantum
  }

  type AgentReputation {
    walletAddress: String!
    erc8004AgentId: String
    totalVerifications: Int!
    successfulVerifications: Int!
    disputesWon: Int!
    disputesLost: Int!
    bountiesCompleted: Int!
    truthTokensEarned: String!
    reputationScore: Float!
    lastActiveAt: String!
  }

  type Discipline {
    name: String!
    quantumCount: Int!
    avgScore: Float!
  }

  type PaginatedQuanta {
    data: [Quantum!]!
    total: Int!
    page: Int!
    pages: Int!
  }

  type PaginatedBounties {
    data: [Bounty!]!
    total: Int!
    page: Int!
    pages: Int!
  }

  type Query {
    quantum(id: Int!): Quantum
    quanta(
      discipline: String
      status: String
      minScore: Float
      page: Int
      limit: Int
    ): PaginatedQuanta!

    searchQuanta(query: String!, page: Int, limit: Int): PaginatedQuanta!

    bounty(id: Int!): Bounty
    bounties(
      status: String
      discipline: String
      page: Int
      limit: Int
    ): PaginatedBounties!

    disciplines: [Discipline!]!

    agentReputation(address: String!): AgentReputation
    leaderboard(limit: Int): [AgentReputation!]!
  }
`;

// ── Resolvers ──

export const resolvers = {
  Query: {
    // Single quantum
    quantum: async (_: any, { id }: { id: number }) => {
      return prisma.quantum.findUnique({
        where: { id },
        include: { verifications: true },
      });
    },

    // List quanta
    quanta: async (_: any, args: any) => {
      const take = Math.min(args.limit || 20, 100);
      const page = Math.max(args.page || 1, 1);
      const skip = (page - 1) * take;

      const where: any = {};
      if (args.discipline) where.discipline = { equals: args.discipline, mode: "insensitive" };
      if (args.status) where.status = args.status.toUpperCase();
      if (args.minScore) where.aggregateScore = { gte: args.minScore };

      const [data, total] = await Promise.all([
        prisma.quantum.findMany({
          where,
          orderBy: { createdAt: "desc" },
          take,
          skip,
          include: { verifications: true },
        }),
        prisma.quantum.count({ where }),
      ]);

      return { data, total, page, pages: Math.ceil(total / take) };
    },

    // Search
    searchQuanta: async (_: any, args: any) => {
      const take = Math.min(args.limit || 20, 100);
      const page = Math.max(args.page || 1, 1);
      const skip = (page - 1) * take;

      const where = { claim: { contains: args.query, mode: "insensitive" as const } };

      const [data, total] = await Promise.all([
        prisma.quantum.findMany({
          where,
          orderBy: { aggregateScore: "desc" },
          take,
          skip,
          include: { verifications: true },
        }),
        prisma.quantum.count({ where }),
      ]);

      return { data, total, page, pages: Math.ceil(total / take) };
    },

    // Bounties
    bounty: async (_: any, { id }: { id: number }) => {
      return prisma.bounty.findUnique({ where: { id }, include: { quantum: true } });
    },

    bounties: async (_: any, args: any) => {
      const take = Math.min(args.limit || 20, 100);
      const page = Math.max(args.page || 1, 1);
      const skip = (page - 1) * take;

      const where: any = {};
      if (args.status) where.status = args.status.toUpperCase();
      if (args.discipline) where.discipline = { equals: args.discipline, mode: "insensitive" };

      const [data, total] = await Promise.all([
        prisma.bounty.findMany({ where, orderBy: { createdAt: "desc" }, take, skip }),
        prisma.bounty.count({ where }),
      ]);

      return { data, total, page, pages: Math.ceil(total / take) };
    },

    // Disciplines
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

    // Agent reputation
    agentReputation: async (_: any, { address }: { address: string }) => {
      return prisma.agentReputation.findUnique({ where: { walletAddress: address } });
    },

    leaderboard: async (_: any, { limit }: { limit?: number }) => {
      return prisma.agentReputation.findMany({
        orderBy: { reputationScore: "desc" },
        take: Math.min(limit || 20, 100),
      });
    },
  },

  // ── Field resolvers ──

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
    meetsConsensus: async (q: any) => {
      try {
        return await registry.meetsConsensus(q.id);
      } catch {
        return null;
      }
    },
    verifications: async (q: any) => {
      if (q.verifications) return q.verifications;
      return prisma.verification.findMany({ where: { quantumId: q.id } });
    },
  },

  Verification: {
    truthScores: (v: any) => ({
      correspondence: v.correspondence / 100,
      coherence: v.coherence / 100,
      convergence: v.convergence / 100,
      pragmatism: v.pragmatism / 100,
      aggregate: (v.correspondence + v.coherence + v.convergence + v.pragmatism) / 400,
    }),
    moralVector: (v: any) => ({
      care: v.moralCare / 100,
      fairness: v.moralFairness / 100,
      loyalty: v.moralLoyalty / 100,
      authority: v.moralAuthority / 100,
      sanctity: v.moralSanctity / 100,
      liberty: v.moralLiberty / 100,
      epistemicHumility: v.moralEpistemicHumility / 100,
      temporalStewardship: v.moralTemporalStewardship / 100,
      magnitude: 0,
    }),
  },

  Bounty: {
    expired: (b: any) => new Date() > new Date(b.deadline),
    quantum: async (b: any) => {
      if (b.quantum) return b.quantum;
      if (!b.quantumId) return null;
      return prisma.quantum.findUnique({ where: { id: b.quantumId } });
    },
  },
};
