/**
 * /api/v1/bounties — REST endpoints for CrowdedSea bounties
 */

import { Router, Request, Response } from "express";
import { prisma } from "../lib/prisma.js";

const router = Router();

/**
 * GET /api/v1/bounties
 * List bounties — filter by status, discipline, min reward
 */
router.get("/", async (req: Request, res: Response) => {
  try {
    const {
      status,
      discipline,
      min_reward,
      sort = "createdAt",
      order = "desc",
      page = "1",
      limit = "20",
    } = req.query;

    const take = Math.min(Number(limit) || 20, 100);
    const skip = (Math.max(Number(page) || 1, 1) - 1) * take;

    const where: any = {};
    if (status) where.status = String(status).toUpperCase().replace(" ", "_");
    if (discipline) where.discipline = { equals: String(discipline), mode: "insensitive" };
    if (min_reward) where.rewardEth = { gte: Number(min_reward) };

    const orderBy: any = {};
    const sortField = ["createdAt", "rewardEth", "deadline"].includes(String(sort))
      ? String(sort)
      : "createdAt";
    orderBy[sortField] = order === "asc" ? "asc" : "desc";

    const [bounties, total] = await Promise.all([
      prisma.bounty.findMany({ where, orderBy, take, skip }),
      prisma.bounty.count({ where }),
    ]);

    res.json({
      data: bounties.map(formatBountyResponse),
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
 * GET /api/v1/bounties/:id
 * Get single bounty with linked quantum
 */
router.get("/:id", async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const bounty = await prisma.bounty.findUnique({
      where: { id },
      include: { quantum: true },
    });

    if (!bounty) return res.status(404).json({ error: "Bounty not found" });

    res.json({ data: formatBountyResponse(bounty) });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

function formatBountyResponse(b: any) {
  return {
    id: b.id,
    poster: b.poster,
    claimant: b.claimant,
    reward: b.reward,
    rewardEth: b.rewardEth,
    description: b.description,
    discipline: b.discipline,
    quantumId: b.quantumId,
    status: b.status,
    createdAt: b.createdAt,
    deadline: b.deadline,
    expired: new Date() > new Date(b.deadline),
    txHash: b.txHash,
  };
}

export default router;
