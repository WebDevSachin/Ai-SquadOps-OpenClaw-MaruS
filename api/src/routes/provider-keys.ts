import { Router, Request, Response } from "express";
import { pool } from "../index";
import { encrypt, decrypt } from "../utils/encryption";

export const providerKeysRouter = Router();

// Supported providers
const VALID_PROVIDERS = [
  "openrouter",
  "anthropic",
  "aws-bedrock",
  "google-vertex",
  "azure",
];

/**
 * POST /api/provider-keys
 * Add or update a provider key for the user
 */
providerKeysRouter.post("/", async (req: Request, res: Response) => {
  try {
    const { provider, keyData } = req.body;

    // Validate provider
    if (!provider || !VALID_PROVIDERS.includes(provider)) {
      return res.status(400).json({
        error: `Invalid provider. Must be one of: ${VALID_PROVIDERS.join(", ")}`,
      });
    }

    // Validate keyData based on provider
    if (!keyData || typeof keyData !== "object") {
      return res.status(400).json({ error: "keyData must be an object" });
    }

    // Provider-specific validation
    switch (provider) {
      case "openrouter":
      case "anthropic":
        if (!keyData.apiKey || typeof keyData.apiKey !== "string") {
          return res.status(400).json({ error: "apiKey is required" });
        }
        break;
      case "aws-bedrock":
        // Can be either bedrockApiKey or accessKeyId/secretAccessKey/region
        if (keyData.bedrockApiKey) {
          if (typeof keyData.bedrockApiKey !== "string") {
            return res.status(400).json({ error: "bedrockApiKey must be a string" });
          }
        } else {
          if (
            !keyData.accessKeyId ||
            !keyData.secretAccessKey ||
            !keyData.region
          ) {
            return res.status(400).json({
              error: "accessKeyId, secretAccessKey, and region are required",
            });
          }
        }
        break;
      case "google-vertex":
        if (!keyData.serviceAccountKey || typeof keyData.serviceAccountKey !== "object") {
          return res.status(400).json({
            error: "serviceAccountKey (JSON object) is required",
          });
        }
        break;
      case "azure":
        if (!Array.isArray(keyData) || keyData.length === 0) {
          return res.status(400).json({
            error: "keyData must be an array of Azure model configurations",
          });
        }
        for (const config of keyData) {
          if (
            !config.model_slug ||
            !config.endpoint_url ||
            !config.api_key ||
            !config.model_id
          ) {
            return res.status(400).json({
              error: "Each Azure config needs: model_slug, endpoint_url, api_key, model_id",
            });
          }
        }
        break;
    }

    // Encrypt the key data
    const encryptedData = encrypt(JSON.stringify(keyData));

    // Upsert (insert or update if exists)
    const result = await pool.query(
      `INSERT INTO provider_keys (user_id, provider, key_data, enabled, updated_at)
       VALUES ($1, $2, $3, true, NOW())
       ON CONFLICT (user_id, provider)
       DO UPDATE SET key_data = $3, enabled = true, updated_at = NOW()
       RETURNING id, provider, enabled, created_at, updated_at`,
      [req.user!.id, provider, encryptedData]
    );

    res.json({
      message: "Provider key configured successfully",
      providerKey: result.rows[0],
    });
  } catch (err) {
    console.error("Provider key save error:", err);
    res.status(500).json({ error: "Failed to save provider key" });
  }
});

/**
 * GET /api/provider-keys
 * List user's configured providers (without exposing keys)
 */
providerKeysRouter.get("/", async (req: Request, res: Response) => {
  try {
    const result = await pool.query(
      `SELECT id, provider, enabled, created_at, updated_at
       FROM provider_keys
       WHERE user_id = $1
       ORDER BY provider ASC`,
      [req.user!.id]
    );

    res.json({ providerKeys: result.rows });
  } catch (err) {
    console.error("Provider keys list error:", err);
    res.status(500).json({ error: "Failed to list provider keys" });
  }
});

/**
 * GET /api/provider-keys/:provider
 * Get a specific provider key (decrypted - use carefully)
 * This endpoint is for the user to verify their own keys
 */
providerKeysRouter.get("/:provider", async (req: Request, res: Response) => {
  try {
    const { provider } = req.params;

    const result = await pool.query(
      `SELECT provider, key_data, enabled
       FROM provider_keys
       WHERE user_id = $1 AND provider = $2`,
      [req.user!.id, provider]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Provider key not found" });
    }

    const row = result.rows[0];
    const decryptedData = JSON.parse(decrypt(row.key_data));

    res.json({
      provider: row.provider,
      enabled: row.enabled,
      keyData: decryptedData,
    });
  } catch (err) {
    console.error("Provider key fetch error:", err);
    res.status(500).json({ error: "Failed to fetch provider key" });
  }
});

/**
 * DELETE /api/provider-keys/:provider
 * Remove a provider key
 */
providerKeysRouter.delete("/:provider", async (req: Request, res: Response) => {
  try {
    const { provider } = req.params;

    const result = await pool.query(
      "DELETE FROM provider_keys WHERE user_id = $1 AND provider = $2 RETURNING id",
      [req.user!.id, provider]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Provider key not found" });
    }

    res.json({ message: "Provider key removed successfully" });
  } catch (err) {
    console.error("Provider key deletion error:", err);
    res.status(500).json({ error: "Failed to remove provider key" });
  }
});

/**
 * PATCH /api/provider-keys/:provider/toggle
 * Enable or disable a provider key
 */
providerKeysRouter.patch("/:provider/toggle", async (req: Request, res: Response) => {
  try {
    const { provider } = req.params;
    const { enabled } = req.body;

    if (typeof enabled !== "boolean") {
      return res.status(400).json({ error: "enabled must be a boolean" });
    }

    const result = await pool.query(
      `UPDATE provider_keys
       SET enabled = $1, updated_at = NOW()
       WHERE user_id = $2 AND provider = $3
       RETURNING id, provider, enabled, updated_at`,
      [enabled, req.user!.id, provider]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Provider key not found" });
    }

    res.json({
      message: `Provider key ${enabled ? "enabled" : "disabled"}`,
      providerKey: result.rows[0],
    });
  } catch (err) {
    console.error("Provider key toggle error:", err);
    res.status(500).json({ error: "Failed to toggle provider key" });
  }
});
