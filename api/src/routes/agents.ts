/**
 * /api/v1/agents — Agent reputation endpoints
 */

import { Router, Request, Response } from "express";
import { prisma } from "../lib/prisma.js";

const router = Router();

/**
 * GET /api/v1/agents/:id/reputation
 * Get agent reputation — by wallet address or ERC-8004 ID
 */
router.get("/:id/reputation", async (req: Request, res: Response) => {
  try {
    const id = req.params.id;

    // Try wallet address first, then ERC-8004 ID
    let agent = await prisma.agentReputation.findUnique({
      where: { walletAddress: id },
    });

    if (!agent) {
      agent = await prisma.agentReputation.findFirst({
        where: { erc8004AgentId: id },
      });
    }

    if (!agent) {
      // Build reputation from verification history
      const verifications = await prisma.verification.findMany({
        where: { verifier: id },
      });

      if (verifications.length === 0) {
        return res.status(404).json({ error: "Agent not found" });
      }

      // Return computed reputation
      return res.json({
        data: {
          walletAddress: id,
          totalVerifications: verifications.length,
          reputationScore: 0,
          bountiesCompleted: 0,
          lastActiveAt: verifications[0]?.createdAt,
        },
      });
    }

    res.json({
      data: {
        walletAddress: agent.walletAddress,
        erc8004AgentId: agent.erc8004AgentId,
        totalVerifications: agent.totalVerifications,
        successfulVerifications: agent.successfulVerifications,
        disputesWon: agent.disputesWon,
        disputesLost: agent.disputesLost,
        bountiesCompleted: agent.bountiesCompleted,
        truthTokensEarned: agent.truthTokensEarned,
        reputationScore: agent.reputationScore,
        lastActiveAt: agent.lastActiveAt,
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/v1/agents/leaderboard
 * Top agents by reputation score
 */
router.get("/leaderboard", async (req: Request, res: Response) => {
  try {
    const { limit = "20" } = req.query;
    const take = Math.min(Number(limit) || 20, 100);

    const agents = await prisma.agentReputation.findMany({
      orderBy: { reputationScore: "desc" },
      take,
    });

    res.json({
      data: agents.map((a: any) => ({
        walletAddress: a.walletAddress,
        erc8004AgentId: a.erc8004AgentId,
        reputationScore: a.reputationScore,
        totalVerifications: a.totalVerifications,
        bountiesCompleted: a.bountiesCompleted,
      })),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
