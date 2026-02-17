import type { VercelRequest, VercelResponse } from "@vercel/node";

export default function handler(_req: VercelRequest, res: VercelResponse) {
  res.json({
    status: "ok",
    service: "truthsea-api",
    version: "1.0.0",
    network: "base_sepolia",
  });
}
