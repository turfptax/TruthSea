/**
 * GET /api/v1/quanta/:id/verifications — Get all verifications for a quantum
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  try {
    const id = Number(req.query.id);
    const verifications = await prisma.verification.findMany({
      where: { quantumId: id },
      orderBy: { createdAt: "desc" },
    });

    res.json({ quantumId: id, count: verifications.length, data: verifications });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}
