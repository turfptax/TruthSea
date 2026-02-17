/**
 * /api/v1/quanta — REST endpoints for truth quanta
 */

import { Router, Request, Response } from "express";
import { prisma } from "../lib/prisma.js";
import { registry } from "../lib/chain.js";

const router = Router();

/**
 * GET /api/v1/quanta
 * List quanta — paginated, filterable by discipline, status, min score
 */
router.get("/", async (req: Request, res: Response) => {
  try {
    const {
      discipline,
      status,
      min_score,
      sort = "createdAt",
      order = "desc",
      page = "1",
      limit = "20",
    } = req.query;

    const take = Math.min(Number(limit) || 20, 100);
    const skip = (Math.max(Number(page) || 1, 1) - 1) * take;

    const where: any = {};
    if (discipline) where.discipline = { equals: String(discipline), mode: "insensitive" };
    if (status) where.status = String(status).toUpperCase();
    if (min_score) where.aggregateScore = { gte: Number(min_score) };

    const orderBy: any = {};
    const sortField = ["createdAt", "aggregateScore", "verifierCount", "moralMagnitude"].includes(String(sort))
      ? String(sort)
      : "createdAt";
    orderBy[sortField] = order === "asc" ? "asc" : "desc";

    const [quanta, total] = await Promise.all([
      prisma.quantum.findMany({ where, orderBy, take, skip }),
      prisma.quantum.count({ where }),
    ]);

    res.json({
      data: quanta.map(formatQuantumResponse),
      pagination: {
        page: Number(page) || 1,
        limit: take,
        total,
        pages: Math.ceil(total / take),
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/v1/quanta/search?q=
 * Full-text search across claims
 */
router.get("/search", async (req: Request, res: Response) => {
  try {
    const { q, page = "1", limit = "20" } = req.query;
    if (!q) return res.status(400).json({ error: "Missing search query ?q=" });

    const take = Math.min(Number(limit) || 20, 100);
    const skip = (Math.max(Number(page) || 1, 1) - 1) * take;

    const [quanta, total] = await Promise.all([
      prisma.quantum.findMany({
        where: {
          claim: { contains: String(q), mode: "insensitive" },
        },
        orderBy: { aggregateScore: "desc" },
        take,
        skip,
      }),
      prisma.quantum.count({
        where: {
          claim: { contains: String(q), mode: "insensitive" },
        },
      }),
    ]);

    res.json({
      query: q,
      data: quanta.map(formatQuantumResponse),
      pagination: { page: Number(page) || 1, limit: take, total, pages: Math.ceil(total / take) },
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/v1/quanta/:id
 * Get single quantum with full scores + moral vector
 */
router.get("/:id", async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const quantum = await prisma.quantum.findUnique({
      where: { id },
      include: { verifications: true },
    });

    if (!quantum) return res.status(404).json({ error: "Quantum not found" });

    // Also fetch live consensus from chain
    let onChainConsensus = false;
    try {
      onChainConsensus = await registry.meetsConsensus(id);
    } catch (_) {
      // Chain read failed — use DB data
    }

    res.json({
      data: {
        ...formatQuantumResponse(quantum),
        meetsConsensus: onChainConsensus,
        verifications: quantum.verifications.map((v: any) => ({
          verifier: v.verifier,
          txHash: v.txHash,
          truthScores: {
            correspondence: v.correspondence / 100,
            coherence: v.coherence / 100,
            convergence: v.convergence / 100,
            pragmatism: v.pragmatism / 100,
          },
          moralVector: {
            care: v.moralCare / 100,
            fairness: v.moralFairness / 100,
            loyalty: v.moralLoyalty / 100,
            authority: v.moralAuthority / 100,
            sanctity: v.moralSanctity / 100,
            liberty: v.moralLiberty / 100,
            epistemicHumility: v.moralEpistemicHumility / 100,
            temporalStewardship: v.moralTemporalStewardship / 100,
          },
          erc8004AgentId: v.erc8004AgentId,
          createdAt: v.createdAt,
        })),
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/v1/quanta/:id/verifications
 * Get all verifications for a quantum
 */
router.get("/:id/verifications", async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const verifications = await prisma.verification.findMany({
      where: { quantumId: id },
      orderBy: { createdAt: "desc" },
    });

    res.json({
      quantumId: id,
      count: verifications.length,
      data: verifications.map((v: any) => ({
        verifier: v.verifier,
        txHash: v.txHash,
        truthScores: {
          correspondence: v.correspondence / 100,
          coherence: v.coherence / 100,
          convergence: v.convergence / 100,
          pragmatism: v.pragmatism / 100,
        },
        moralVector: {
          care: v.moralCare / 100,
          fairness: v.moralFairness / 100,
          loyalty: v.moralLoyalty / 100,
          authority: v.moralAuthority / 100,
          sanctity: v.moralSanctity / 100,
          liberty: v.moralLiberty / 100,
          epistemicHumility: v.moralEpistemicHumility / 100,
          temporalStewardship: v.moralTemporalStewardship / 100,
        },
        erc8004AgentId: v.erc8004AgentId,
        createdAt: v.createdAt,
      })),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── Response formatter ──

function formatQuantumResponse(q: any) {
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

export default router;
