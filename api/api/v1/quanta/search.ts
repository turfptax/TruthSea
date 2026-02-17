/**
 * GET /api/v1/quanta/search?q= — Full-text search across claims
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { q, page = "1", limit = "20" } = req.query;
    if (!q) return res.status(400).json({ error: "Missing search query ?q=" });

    const take = Math.min(Number(limit) || 20, 100);
    const skip = (Math.max(Number(page) || 1, 1) - 1) * take;

    const where = { claim: { contains: String(q), mode: "insensitive" as const } };

    const [quanta, total] = await Promise.all([
      prisma.quantum.findMany({ where, orderBy: { aggregateScore: "desc" }, take, skip }),
      prisma.quantum.count({ where }),
    ]);

    res.json({
      query: q,
      data: quanta,
      pagination: { page: Number(page) || 1, limit: take, total, pages: Math.ceil(total / take) },
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}
