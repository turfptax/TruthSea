/**
 * TruthSea IPFS Evidence Pinner
 *
 * Pins evidence bundles to IPFS via Pinata and returns CIDv1 hashes.
 * Each truth quantum links to an evidence bundle stored on IPFS.
 *
 * Supports two backends:
 *   1. Pinata (recommended for production) — set PINATA_JWT
 *   2. Local storage fallback (for development) — saves to ./evidence/
 *
 * Evidence Bundle Schema:
 * {
 *   "version": "1.0",
 *   "claim": "string",
 *   "discipline": "string",
 *   "evidence": [
 *     { "type": "url|document|dataset|image", "source": "string", "retrieved_at": "ISO", "hash": "sha256" }
 *   ],
 *   "submitter": { "address": "0x...", "erc8004_id": "optional" },
 *   "created_at": "ISO"
 * }
 *
 * @author turfptax
 */

import express from "express";
import cors from "cors";
import crypto from "crypto";
import fs from "fs/promises";
import path from "path";
import { z } from "zod";

const PORT = Number(process.env.PINNER_PORT) || 3002;
const PINATA_JWT = process.env.PINATA_JWT || "";
const EVIDENCE_DIR = process.env.EVIDENCE_DIR || "./evidence";

const app = express();
app.use(cors());
app.use(express.json({ limit: "10mb" }));

// ── Evidence Bundle Schema ──

const EvidenceItemSchema = z.object({
  type: z.enum(["url", "document", "dataset", "image"]),
  source: z.string(),
  retrieved_at: z.string().optional(),
  hash: z.string().optional(),
  content: z.string().optional(), // base64 for documents/images
});

const EvidenceBundleSchema = z.object({
  claim: z.string().min(1),
  discipline: z.string().min(1),
  evidence: z.array(EvidenceItemSchema).min(1),
  submitter: z.object({
    address: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
    erc8004_id: z.string().optional(),
  }),
});

// ── Pin to Pinata ──

async function pinToPinata(data: any, name: string): Promise<string> {
  const response = await fetch("https://api.pinata.cloud/pinning/pinJSONToIPFS", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${PINATA_JWT}`,
    },
    body: JSON.stringify({
      pinataContent: data,
      pinataMetadata: {
        name: `truthsea-evidence-${name}`,
        keyvalues: {
          discipline: data.discipline,
          claim_hash: crypto.createHash("sha256").update(data.claim).digest("hex").slice(0, 16),
        },
      },
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Pinata error: ${err}`);
  }

  const result = (await response.json()) as { IpfsHash: string };
  return result.IpfsHash;
}

// ── Local Storage Fallback ──

async function pinToLocal(data: any): Promise<string> {
  await fs.mkdir(EVIDENCE_DIR, { recursive: true });

  const json = JSON.stringify(data, null, 2);
  const hash = crypto.createHash("sha256").update(json).digest("hex");
  const cid = `local_${hash.slice(0, 46)}`; // fake CID for dev

  await fs.writeFile(path.join(EVIDENCE_DIR, `${cid}.json`), json);
  return cid;
}

// ── Routes ──

/**
 * POST /pin
 * Pin an evidence bundle to IPFS
 */
app.post("/pin", async (req, res) => {
  try {
    const bundle = EvidenceBundleSchema.parse(req.body);

    // Add metadata
    const fullBundle = {
      version: "1.0",
      ...bundle,
      created_at: new Date().toISOString(),
      evidence: bundle.evidence.map((e) => ({
        ...e,
        hash: e.hash || (e.content
          ? crypto.createHash("sha256").update(e.content).digest("hex")
          : undefined),
        retrieved_at: e.retrieved_at || new Date().toISOString(),
      })),
    };

    // Strip content from stored bundle (keep only hashes)
    const storedBundle = {
      ...fullBundle,
      evidence: fullBundle.evidence.map(({ content, ...rest }) => rest),
    };

    let cid: string;
    if (PINATA_JWT) {
      cid = await pinToPinata(storedBundle, Date.now().toString());
    } else {
      console.warn("[PINNER] No PINATA_JWT — using local storage fallback");
      cid = await pinToLocal(storedBundle);
    }

    // Convert CID to bytes32-compatible hex
    const cidHash = "0x" + crypto.createHash("sha256").update(cid).digest("hex");

    res.json({
      success: true,
      cid,
      cidHash,
      gateway: PINATA_JWT
        ? `https://gateway.pinata.cloud/ipfs/${cid}`
        : `file://${path.resolve(EVIDENCE_DIR, `${cid}.json`)}`,
      bundle: storedBundle,
    });
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid evidence bundle", details: err.errors });
    }
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /pin/:cid
 * Retrieve a pinned evidence bundle
 */
app.get("/pin/:cid", async (req, res) => {
  try {
    const { cid } = req.params;

    if (cid.startsWith("local_")) {
      // Local storage
      const filePath = path.join(EVIDENCE_DIR, `${cid}.json`);
      const data = await fs.readFile(filePath, "utf-8");
      return res.json(JSON.parse(data));
    }

    // Pinata gateway
    const response = await fetch(`https://gateway.pinata.cloud/ipfs/${cid}`);
    if (!response.ok) throw new Error(`IPFS fetch failed: ${response.status}`);
    const data = await response.json();
    res.json(data);
  } catch (err: any) {
    res.status(404).json({ error: `Evidence not found: ${err.message}` });
  }
});

/**
 * GET /health
 */
app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    service: "truthsea-ipfs-pinner",
    backend: PINATA_JWT ? "pinata" : "local",
  });
});

// ── Start ──

app.listen(PORT, () => {
  console.log(`\n📌 TruthSea IPFS Pinner running on http://localhost:${PORT}`);
  console.log(`   Backend: ${PINATA_JWT ? "Pinata" : "Local storage (dev mode)"}`);
  console.log(`   Pin:     POST http://localhost:${PORT}/pin`);
  console.log(`   Fetch:   GET  http://localhost:${PORT}/pin/:cid\n`);
});
