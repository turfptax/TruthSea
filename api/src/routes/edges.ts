/**
 * /api/v2/edges — REST endpoints for on-chain DAG edges
 */

import { Router, Request, Response } from "express";
import { prisma } from "../lib/prisma.js";

const router = Router();

/**
 * GET /api/v2/edges
 * List edges — filter by sourceId, targetId, type, status, proposer
 */
router.get("/", async (req: Request, res: Response) => {
  try {
    const {
      sourceId,
      targetId,
      type,
      status,
      proposer,
      sort = "createdAt",
      order = "desc",
      page = "1",
      limit = "20",
    } = req.query;

    const take = Math.min(Number(limit) || 20, 100);
    const skip = (Math.max(Number(page) || 1, 1) - 1) * take;

    const where: any = {};
    if (sourceId) where.sourceQuantumId = Number(sourceId);
    if (targetId) where.targetQuantumId = Number(targetId);
    if (type) where.edgeType = String(type).toUpperCase();
    if (status) where.status = String(status).toUpperCase();
    if (proposer) where.proposer = String(proposer);

    const orderBy: any = {};
    const sortField = ["createdAt", "confidence"].includes(String(sort))
      ? String(sort)
      : "createdAt";
    orderBy[sortField] = order === "asc" ? "asc" : "desc";

    const [edges, total] = await Promise.all([
      prisma.onChainEdge.findMany({
        where,
        orderBy,
        take,
        skip,
        include: {
          sourceQuantum: { select: { id: true, claim: true, discipline: true, aggregateScore: true } },
          targetQuantum: { select: { id: true, claim: true, discipline: true, aggregateScore: true } },
        },
      }),
      prisma.onChainEdge.count({ where }),
    ]);

    res.json({
      data: edges.map(formatEdgeResponse),
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
 * GET /api/v2/edges/:id
 * Get single edge with both quanta
 */
router.get("/:id", async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const edge = await prisma.onChainEdge.findUnique({
      where: { id },
      include: {
        sourceQuantum: true,
        targetQuantum: true,
        weakLinkFlags: true,
      },
    });

    if (!edge) return res.status(404).json({ error: "Edge not found" });

    res.json({ data: formatEdgeResponse(edge) });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/v2/edges/:id/flags
 * Get weak link flags for an edge
 */
router.get("/:id/flags", async (req: Request, res: Response) => {
  try {
    const edgeId = Number(req.params.id);
    const flags = await prisma.weakLinkFlag.findMany({
      where: { edgeId },
      orderBy: { flaggedAt: "desc" },
    });

    res.json({ data: flags });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

function formatEdgeResponse(e: any) {
  return {
    id: e.id,
    sourceQuantumId: e.sourceQuantumId,
    targetQuantumId: e.targetQuantumId,
    edgeType: e.edgeType,
    status: e.status,
    proposer: e.proposer,
    evidenceCid: e.evidenceCid,
    stakeAmount: e.stakeAmount,
    confidence: e.confidence / 100, // 0-10000 → 0-100
    reasoning: e.reasoning,
    evidenceUrls: e.evidenceUrls,
    createdAt: e.createdAt,
    txHash: e.txHash,
    sourceQuantum: e.sourceQuantum || undefined,
    targetQuantum: e.targetQuantum || undefined,
    weakLinkFlags: e.weakLinkFlags || undefined,
  };
}

export default router;
