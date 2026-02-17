/**
 * GET /api/v1/agents/:id/reputation — Agent reputation by wallet or ERC-8004 ID
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  try {
    const id = String(req.query.id);

    let agent = await prisma.agentReputation.findUnique({ where: { walletAddress: id } });
    if (!agent) {
      agent = await prisma.agentReputation.findFirst({ where: { erc8004AgentId: id } });
    }

    if (!agent) return res.status(404).json({ error: "Agent not found" });
    res.json({ data: agent });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}
