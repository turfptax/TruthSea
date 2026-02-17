/**
 * GET /api/v1/agents/leaderboard — Top agents by reputation
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { limit = "20" } = req.query;
    const take = Math.min(Number(limit) || 20, 100);

    const agents = await prisma.agentReputation.findMany({
      orderBy: { reputationScore: "desc" },
      take,
    });

    res.json({ data: agents });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}
