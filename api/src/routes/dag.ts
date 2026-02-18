/**
 * /api/v2/dag — REST endpoints for DAG traversal and chain scoring
 */

import { Router, Request, Response } from "express";
import { prisma } from "../lib/prisma.js";

const router = Router();

/**
 * GET /api/v2/dag/quantum/:id/ancestors
 * Get all transitive dependencies (BFS upward through Depends edges)
 */
router.get("/quantum/:id/ancestors", async (req: Request, res: Response) => {
  try {
    const quantumId = Number(req.params.id);
    const maxDepth = Math.min(Number(req.query.max_depth) || 10, 20);
    const ancestors = await bfsTraverse(quantumId, "ancestors", maxDepth);
    res.json({ data: ancestors, quantumId, direction: "ancestors" });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/v2/dag/quantum/:id/descendants
 * Get all things that depend on this quantum (BFS downward)
 */
router.get("/quantum/:id/descendants", async (req: Request, res: Response) => {
  try {
    const quantumId = Number(req.params.id);
    const maxDepth = Math.min(Number(req.query.max_depth) || 10, 20);
    const descendants = await bfsTraverse(quantumId, "descendants", maxDepth);
    res.json({ data: descendants, quantumId, direction: "descendants" });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/v2/dag/quantum/:id/chain-score
 * Get the propagated chain score with breakdown
 */
router.get("/quantum/:id/chain-score", async (req: Request, res: Response) => {
  try {
    const quantumId = Number(req.params.id);

    const score = await prisma.propagatedScore.findUnique({
      where: { quantumId },
      include: { quantum: { select: { id: true, claim: true, aggregateScore: true } } },
    });

    if (!score) {
      return res.json({
        data: null,
        message: "No propagated score found. Run propagation for this quantum.",
      });
    }

    res.json({
      data: {
        quantumId: score.quantumId,
        chainScore: score.chainScore,
        weakestLinkScore: score.weakestLinkScore,
        weakestLinkEdgeId: score.weakestLinkEdgeId,
        depth: score.depth,
        lastUpdated: score.lastUpdated,
        quantum: score.quantum,
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/v2/dag/quantum/:id/weakest-path
 * Follow the chain of weakest links from a quantum back to the bottleneck
 */
router.get("/quantum/:id/weakest-path", async (req: Request, res: Response) => {
  try {
    const quantumId = Number(req.params.id);
    const path: any[] = [];
    let currentId = quantumId;
    const visited = new Set<number>();

    while (!visited.has(currentId)) {
      visited.add(currentId);

      const score = await prisma.propagatedScore.findUnique({
        where: { quantumId: currentId },
        include: { quantum: { select: { id: true, claim: true, aggregateScore: true } } },
      });

      if (!score) break;

      path.push({
        quantumId: score.quantumId,
        chainScore: score.chainScore,
        weakestLinkScore: score.weakestLinkScore,
        weakestLinkEdgeId: score.weakestLinkEdgeId,
        depth: score.depth,
        claim: score.quantum?.claim,
      });

      // If this is an axiom or no weakest link, we've reached the bottom
      if (score.depth === 0 || !score.weakestLinkEdgeId) break;

      // Follow the weakest edge to its source quantum
      const weakEdge = await prisma.onChainEdge.findUnique({
        where: { id: score.weakestLinkEdgeId },
      });

      if (!weakEdge) break;
      currentId = weakEdge.sourceQuantumId;
    }

    res.json({ data: path, quantumId });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/v2/dag/axioms
 * List all quanta with depth=0 (no dependencies)
 */
router.get("/axioms", async (req: Request, res: Response) => {
  try {
    const { page = "1", limit = "50" } = req.query;
    const take = Math.min(Number(limit) || 50, 100);
    const skip = (Math.max(Number(page) || 1, 1) - 1) * take;

    const [axioms, total] = await Promise.all([
      prisma.propagatedScore.findMany({
        where: { depth: 0 },
        orderBy: { chainScore: "desc" },
        take,
        skip,
        include: { quantum: { select: { id: true, claim: true, discipline: true, aggregateScore: true } } },
      }),
      prisma.propagatedScore.count({ where: { depth: 0 } }),
    ]);

    res.json({
      data: axioms.map((a) => ({
        quantumId: a.quantumId,
        chainScore: a.chainScore,
        claim: a.quantum?.claim,
        discipline: a.quantum?.discipline,
        aggregateScore: a.quantum?.aggregateScore,
      })),
      pagination: { page: Number(page) || 1, limit: take, total, pages: Math.ceil(total / take) },
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/v2/dag/crowns
 * List all quanta that have no dependents (nothing depends on them)
 */
router.get("/crowns", async (req: Request, res: Response) => {
  try {
    const { page = "1", limit = "50" } = req.query;
    const take = Math.min(Number(limit) || 50, 100);
    const skip = (Math.max(Number(page) || 1, 1) - 1) * take;

    // Find quanta that have propagated scores but no incoming edges
    // (nothing depends on them — they are "crown claims")
    const crowns = await prisma.$queryRaw`
      SELECT ps."quantumId", ps."chainScore", ps."depth",
             q."claim", q."discipline", q."aggregateScore"
      FROM "PropagatedScore" ps
      JOIN "Quantum" q ON q."id" = ps."quantumId"
      WHERE ps."quantumId" NOT IN (
        SELECT DISTINCT "sourceQuantumId" FROM "OnChainEdge" WHERE "status" = 'ACTIVE'
      )
      ORDER BY ps."chainScore" DESC
      LIMIT ${take} OFFSET ${skip}
    ` as any[];

    res.json({ data: crowns });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── Helper: BFS graph traversal ──

async function bfsTraverse(
  startId: number,
  direction: "ancestors" | "descendants",
  maxDepth: number
): Promise<any[]> {
  const visited = new Set<number>();
  const result: any[] = [];
  let queue: { id: number; depth: number }[] = [{ id: startId, depth: 0 }];

  while (queue.length > 0) {
    const next: { id: number; depth: number }[] = [];

    for (const { id, depth } of queue) {
      if (visited.has(id) || depth > maxDepth) continue;
      visited.add(id);

      // Get the quantum data
      const quantum = await prisma.quantum.findUnique({
        where: { id },
        select: { id: true, claim: true, discipline: true, aggregateScore: true },
      });

      const score = await prisma.propagatedScore.findUnique({
        where: { quantumId: id },
      });

      // Get connecting edges
      const edges = direction === "ancestors"
        ? await prisma.onChainEdge.findMany({
            where: { targetQuantumId: id, edgeType: "DEPENDS", status: "ACTIVE" },
          })
        : await prisma.onChainEdge.findMany({
            where: { sourceQuantumId: id, edgeType: "DEPENDS", status: "ACTIVE" },
          });

      result.push({
        quantumId: id,
        depth,
        claim: quantum?.claim,
        discipline: quantum?.discipline,
        aggregateScore: quantum?.aggregateScore,
        chainScore: score?.chainScore,
        edges: edges.map((e) => ({
          edgeId: e.id,
          sourceQuantumId: e.sourceQuantumId,
          targetQuantumId: e.targetQuantumId,
          confidence: e.confidence / 100,
        })),
      });

      // Queue next level
      for (const edge of edges) {
        const nextId = direction === "ancestors" ? edge.sourceQuantumId : edge.targetQuantumId;
        if (!visited.has(nextId)) {
          next.push({ id: nextId, depth: depth + 1 });
        }
      }
    }

    queue = next;
  }

  return result;
}

export default router;
