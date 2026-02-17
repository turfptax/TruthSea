/**
 * GET /api/v1/disciplines — List disciplines with counts
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

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
}
