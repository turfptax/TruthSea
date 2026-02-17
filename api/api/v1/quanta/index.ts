/**
 * GET /api/v1/quanta — List quanta (paginated, filterable)
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  try {
    const {
      discipline, status, min_score,
      sort = "createdAt", order = "desc",
      page = "1", limit = "20",
    } = req.query;

    const take = Math.min(Number(limit) || 20, 100);
    const skip = (Math.max(Number(page) || 1, 1) - 1) * take;

    const where: any = {};
    if (discipline) where.discipline = { equals: String(discipline), mode: "insensitive" };
    if (status) where.status = String(status).toUpperCase();
    if (min_score) where.aggregateScore = { gte: Number(min_score) };

    const sortField = ["createdAt", "aggregateScore", "verifierCount", "moralMagnitude"]
      .includes(String(sort)) ? String(sort) : "createdAt";

    const [quanta, total] = await Promise.all([
      prisma.quantum.findMany({
        where,
        orderBy: { [sortField]: order === "asc" ? "asc" : "desc" },
        take,
        skip,
      }),
      prisma.quantum.count({ where }),
    ]);

    res.json({
      data: quanta.map(formatQuantum),
      pagination: { page: Number(page) || 1, limit: take, total, pages: Math.ceil(total / take) },
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

function formatQuantum(q: any) {
  return {
    id: q.id,
    host: q.host,
    ipfsCid: q.ipfsCid,
    discipline: q.discipline,
    claim: q.claim,
    status: q.status,
    truthScores: {
      correspondence: q.correspondence / 100,
      coherence: q.coherence / 100,
      convergence: q.convergence / 100,
      pragmatism: q.pragmatism / 100,
      aggregate: q.aggregateScore,
    },
    moralVector: {
      care: q.moralCare / 100,
      fairness: q.moralFairness / 100,
      loyalty: q.moralLoyalty / 100,
      authority: q.moralAuthority / 100,
      sanctity: q.moralSanctity / 100,
      liberty: q.moralLiberty / 100,
      epistemicHumility: q.moralEpistemicHumility / 100,
      temporalStewardship: q.moralTemporalStewardship / 100,
      magnitude: q.moralMagnitude,
    },
    stakeAmount: q.stakeAmount,
    verifierCount: q.verifierCount,
    erc8004AgentId: q.erc8004AgentId,
    createdAt: q.createdAt,
  };
}
