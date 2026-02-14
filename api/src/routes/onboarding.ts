import { Router, Request, Response } from "express";

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
  apiKeys: {
    anthropic: string;
    telegram: string;
    slack?: string;
  };
}

// POST /api/onboarding — receive wizard data, validate, return success
onboardingRouter.post("/", async (req: Request, res: Response) => {
  try {
    const body = req.body as OnboardingPayload;

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
    if (!body.apiKeys?.anthropic?.trim()) {
      return res.status(400).json({ error: "Anthropic API key is required" });
    }
    if (!body.apiKeys?.telegram?.trim()) {
      return res.status(400).json({ error: "Telegram bot token is required" });
    }

    // Build response payload (strip sensitive keys for response)
    const responseData = {
      business: body.business,
      template: body.template,
      agents: body.agents,
      integrations: body.integrations,
      apiKeysConfigured: {
        anthropic: !!body.apiKeys.anthropic,
        telegram: !!body.apiKeys.telegram,
        slack: !!body.apiKeys.slack,
      },
    };

    // TODO: Actual provisioning (store in DB, configure agents, etc.) will be added later
    res.status(201).json({
      success: true,
      message: "Onboarding complete",
      data: responseData,
    });
  } catch (err) {
    res.status(500).json({
      error: "Failed to process onboarding",
      details: String(err),
    });
  }
});
