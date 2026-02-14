import { Router, Request, Response } from "express";
import { pool } from "../index";
import { encrypt } from "../utils/encryption";

export const onboardingRouter = Router();

interface OnboardingPayload {
  business: {
    name: string;
    website?: string;
    industry: string;
    stage: string;
    goal?: string;
  };
  template: string;
  agents: string[];
  integrations: Record<string, boolean>;
  providerKeys?: {
    provider: string;
    keyData: any;
  }[];
  // Legacy support for old format
  apiKeys?: {
    anthropic?: string;
    telegram?: string;
    slack?: string;
  };
}

// POST /api/onboarding — receive wizard data, validate, store provider keys
onboardingRouter.post("/", async (req: Request, res: Response) => {
  try {
    const body = req.body as OnboardingPayload;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: "Authentication required" });
    }

    // Validate required fields
    if (!body.business?.name?.trim()) {
      return res.status(400).json({ error: "Business name is required" });
    }
    if (!body.business?.industry?.trim()) {
      return res.status(400).json({ error: "Industry is required" });
    }
    if (!body.business?.stage) {
      return res.status(400).json({ error: "Stage is required" });
    }
    if (!body.template) {
      return res.status(400).json({ error: "Template is required" });
    }
    if (!body.agents || !Array.isArray(body.agents) || body.agents.length === 0) {
      return res.status(400).json({ error: "At least one agent must be selected" });
    }
    if (!body.integrations?.telegram) {
      return res.status(400).json({ error: "Telegram integration is required" });
    }

    // Store provider keys if provided (new format)
    if (body.providerKeys && Array.isArray(body.providerKeys)) {
      for (const providerKey of body.providerKeys) {
        const { provider, keyData } = providerKey;
        const encryptedData = encrypt(JSON.stringify(keyData));

        await pool.query(
          `INSERT INTO provider_keys (user_id, provider, key_data, enabled)
           VALUES ($1, $2, $3, true)
           ON CONFLICT (user_id, provider)
           DO UPDATE SET key_data = $3, enabled = true, updated_at = NOW()`,
          [userId, provider, encryptedData]
        );
      }
    }
    // Legacy support: convert old apiKeys format to provider keys
    else if (body.apiKeys) {
      if (body.apiKeys.anthropic) {
        const encryptedData = encrypt(
          JSON.stringify({ apiKey: body.apiKeys.anthropic })
        );
        await pool.query(
          `INSERT INTO provider_keys (user_id, provider, key_data, enabled)
           VALUES ($1, 'anthropic', $2, true)
           ON CONFLICT (user_id, provider)
           DO UPDATE SET key_data = $2, enabled = true, updated_at = NOW()`,
          [userId, encryptedData]
        );
      }
    }

    // Build response payload (strip sensitive keys for response)
    const responseData = {
      business: body.business,
      template: body.template,
      agents: body.agents,
      integrations: body.integrations,
      providerKeysConfigured: body.providerKeys?.length || 0,
    };

    res.status(201).json({
      success: true,
      message: "Onboarding complete - provider keys stored securely",
      data: responseData,
    });
  } catch (err) {
    console.error("Onboarding error:", err);
    res.status(500).json({
      error: "Failed to process onboarding",
      details: String(err),
    });
  }
});
