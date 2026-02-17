/**
 * GET /api/v1/quanta/:id — Get quantum by ID with full scores
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  try {
    const id = Number(req.query.id);
    const quantum = await prisma.quantum.findUnique({
      where: { id },
      include: { verifications: true },
    });

    if (!quantum) return res.status(404).json({ error: "Quantum not found" });

    res.json({ data: quantum });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}
