/**
 * /api/v1/disciplines — List all discipline categories with quantum counts
 */

import { Router, Request, Response } from "express";
import { prisma } from "../lib/prisma.js";

const router = Router();

/**
 * GET /api/v1/disciplines
 * Returns all unique disciplines with their quantum count and avg score
 */
router.get("/", async (req: Request, res: Response) => {
  try {
    const disciplines = await prisma.quantum.groupBy({
      by: ["discipline"],
      _count: { id: true },
      _avg: { aggregateScore: true },
      orderBy: { _count: { id: "desc" } },
    });

    res.json({
      data: disciplines.map((d: any) => ({
        discipline: d.discipline,
        quantumCount: d._count.id,
        avgScore: Math.round((d._avg.aggregateScore || 0) * 100) / 100,
      })),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
