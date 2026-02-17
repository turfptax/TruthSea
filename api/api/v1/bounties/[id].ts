/**
 * GET /api/v1/bounties/:id — Get bounty by ID
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  try {
    const id = Number(req.query.id);
    const bounty = await prisma.bounty.findUnique({
      where: { id },
      include: { quantum: true },
    });

    if (!bounty) return res.status(404).json({ error: "Bounty not found" });
    res.json({ data: bounty });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}
