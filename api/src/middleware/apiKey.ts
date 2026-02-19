/**
 * API Key Middleware
 *
 * Simple X-API-Key header validation for protecting write/mutation endpoints.
 * If API_KEYS env var is empty or not set, the middleware is permissive (open access).
 *
 * Usage:
 *   import { requireApiKey } from "./middleware/apiKey.js";
 *   router.post("/submit", requireApiKey, handler);
 *
 * Configure:
 *   API_KEYS=key1,key2,key3  (comma-separated list of valid keys)
 */

import { Request, Response, NextFunction } from "express";

export function requireApiKey(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const validKeys = (process.env.API_KEYS || "")
    .split(",")
    .filter(Boolean);

  // If no keys configured, allow all requests (open mode)
  if (validKeys.length === 0) {
    next();
    return;
  }

  const providedKey = req.headers["x-api-key"] as string | undefined;

  if (!providedKey || !validKeys.includes(providedKey)) {
    res.status(401).json({ error: "Invalid or missing API key" });
    return;
  }

  next();
}
