/**
 * GET /api/v1/bounties — List bounties
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { status, discipline, sort = "createdAt", order = "desc", page = "1", limit = "20" } = req.query;

    const take = Math.min(Number(limit) || 20, 100);
    const skip = (Math.max(Number(page) || 1, 1) - 1) * take;

    const where: any = {};
    if (status) where.status = String(status).toUpperCase().replace(" ", "_");
    if (discipline) where.discipline = { equals: String(discipline), mode: "insensitive" };

    const sortField = ["createdAt", "rewardEth", "deadline"].includes(String(sort)) ? String(sort) : "createdAt";

    const [bounties, total] = await Promise.all([
      prisma.bounty.findMany({ where, orderBy: { [sortField]: order === "asc" ? "asc" : "desc" }, take, skip }),
      prisma.bounty.count({ where }),
    ]);

    res.json({
      data: bounties,
      pagination: { page: Number(page) || 1, limit: take, total, pages: Math.ceil(total / take) },
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}
