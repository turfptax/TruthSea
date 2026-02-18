/**
 * /api/v2/chains — REST endpoints for chain definitions
 * Exposes the existing ChainDefinition/ChainNode/ChainEdge models
 */

import { Router, Request, Response } from "express";
import { prisma } from "../lib/prisma.js";

const router = Router();

/**
 * GET /api/v2/chains
 * List all chain definitions
 */
router.get("/", async (req: Request, res: Response) => {
  try {
    const { discipline, page = "1", limit = "20" } = req.query;

    const take = Math.min(Number(limit) || 20, 100);
    const skip = (Math.max(Number(page) || 1, 1) - 1) * take;

    const where: any = {};
    if (discipline) where.discipline = { equals: String(discipline), mode: "insensitive" };

    const [chains, total] = await Promise.all([
      prisma.chainDefinition.findMany({
        where,
        orderBy: { updatedAt: "desc" },
        take,
        skip,
      }),
      prisma.chainDefinition.count({ where }),
    ]);

    res.json({
      data: chains,
      pagination: { page: Number(page) || 1, limit: take, total, pages: Math.ceil(total / take) },
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/v2/chains/:id
 * Get chain with all nodes, edges, evidence sources, and scores
 */
router.get("/:id", async (req: Request, res: Response) => {
  try {
    const id = req.params.id;

    const chain = await prisma.chainDefinition.findUnique({
      where: { id },
      include: {
        nodes: {
          include: { evidenceSources: true },
          orderBy: { layer: "asc" },
        },
        edges: true,
      },
    });

    if (!chain) return res.status(404).json({ error: "Chain not found" });

    // Group nodes by layer for easier consumption
    const layers: Record<number, any[]> = {};
    for (const node of chain.nodes) {
      const layer = node.layer;
      if (!layers[layer]) layers[layer] = [];
      layers[layer].push({
        id: node.id,
        claim: node.claim,
        discipline: node.discipline,
        layer: node.layer,
        sourceType: node.sourceType,
        correspondence: node.correspondence,
        coherence: node.coherence,
        convergence: node.convergence,
        pragmatism: node.pragmatism,
        intrinsicScore: node.intrinsicScore,
        chainScore: node.chainScore,
        weakestLink: node.weakestLink,
        onChainQuantumId: node.onChainQuantumId,
        depends: node.depends,
        contradicts: node.contradicts,
        evidenceSources: node.evidenceSources,
      });
    }

    res.json({
      data: {
        id: chain.id,
        name: chain.name,
        discipline: chain.discipline,
        crownClaim: chain.crownClaim,
        nodeCount: chain.nodeCount,
        createdAt: chain.createdAt,
        updatedAt: chain.updatedAt,
        layers,
        edges: chain.edges.map((e) => ({
          id: e.id,
          sourceNode: e.sourceNode,
          targetNode: e.targetNode,
          edgeType: e.edgeType,
        })),
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/v2/chains/:id/weakest-links
 * Find the weakest links in a chain (nodes with lowest chain scores)
 */
router.get("/:id/weakest-links", async (req: Request, res: Response) => {
  try {
    const chainId = req.params.id;
    const threshold = Number(req.query.threshold) || 50;

    const weakNodes = await prisma.chainNode.findMany({
      where: {
        chainId,
        chainScore: { lt: threshold },
      },
      orderBy: { chainScore: "asc" },
      include: { evidenceSources: true },
    });

    res.json({
      data: weakNodes.map((n) => ({
        id: n.id,
        claim: n.claim,
        layer: n.layer,
        chainScore: n.chainScore,
        intrinsicScore: n.intrinsicScore,
        weakestLink: n.weakestLink,
        onChainQuantumId: n.onChainQuantumId,
        evidenceCount: n.evidenceSources.length,
      })),
      chainId,
      threshold,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
