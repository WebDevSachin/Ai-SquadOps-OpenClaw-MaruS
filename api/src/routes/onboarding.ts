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
  role?: string;
  agents: string[];
  integrations: Record<string, boolean>;
  providerKeys?: {
    provider: string;
    keyData: any;
    useSystemKey?: boolean;
  }[];
  systemKeyProviders?: string[];
  // Legacy support for old format
  apiKeys?: {
    anthropic?: string;
    telegram?: string;
    slack?: string;
  };
}

interface OnboardingStatus {
  completed: boolean;
  completedAt?: string;
  business?: {
    name: string;
    website?: string;
    industry: string;
    stage: string;
    goal?: string;
  };
  template?: string;
  agents?: string[];
  integrations?: Record<string, boolean>;
}

/**
 * GET /api/onboarding/status
 * Check if user has completed onboarding
 */
onboardingRouter.get("/status", async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: "Authentication required" });
    }

    // Get user profile to check onboarding status
    const result = await pool.query(
      `SELECT preferences, company FROM user_profiles WHERE user_id = $1`,
      [userId]
    );

    let status: OnboardingStatus = { completed: false };

    if (result.rows.length > 0) {
      const preferences = result.rows[0].preferences || {};
      const onboarding = preferences.onboarding || {};
      
      status = {
        completed: onboarding.completed === true,
        completedAt: onboarding.completedAt,
        business: onboarding.business,
        template: onboarding.template,
        agents: onboarding.agents,
        integrations: onboarding.integrations,
      };
    }

    res.json({
      onboarding: status,
    });
  } catch (err) {
    console.error("Onboarding status error:", err);
    res.status(500).json({
      error: "Failed to get onboarding status",
    });
  }
});

/**
 * POST /api/onboarding/cookie
 * Set onboarding completion cookie (server-side)
 */
onboardingRouter.post("/cookie", async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: "Authentication required" });
    }

    // Check if onboarding is actually completed in database
    const result = await pool.query(
      `SELECT preferences->'onboarding'->>'completed' as completed 
       FROM user_profiles WHERE user_id = $1`,
      [userId]
    );
    
    const isCompleted = result.rows[0]?.completed === 'true';
    
    if (!isCompleted) {
      return res.status(400).json({ 
        error: "Onboarding not completed",
        message: "Please complete onboarding before setting cookie"
      });
    }

    // Set cookie
    res.cookie('onboarding', 'completed', {
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
      httpOnly: false, // Allow JavaScript access
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
    });

    res.json({
      success: true,
      message: "Onboarding cookie set successfully",
    });
  } catch (err) {
    console.error("Onboarding cookie error:", err);
    res.status(500).json({
      error: "Failed to set onboarding cookie",
    });
  }
});

/**
 * POST /api/onboarding — receive wizard data, validate, store provider keys
 */
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

    // Store provider keys if provided (optional - users can use system fallback)
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

    // Store onboarding data and mark as complete
    const onboardingData = {
      completed: true,
      completedAt: new Date().toISOString(),
      business: body.business,
      template: body.template,
      role: body.role,
      agents: body.agents,
      integrations: body.integrations,
      // Store system key preferences
      systemKeyProviders: body.systemKeyProviders || [],
      useSystemKeys: body.providerKeys?.reduce((acc, pk) => {
        if (pk.useSystemKey) {
          acc[pk.provider] = true;
        }
        return acc;
      }, {} as Record<string, boolean>) || {},
    };

    // Ensure user profile exists
    await pool.query(
      `INSERT INTO user_profiles (user_id, company, preferences)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id)
       DO UPDATE SET 
         company = COALESCE($2, user_profiles.company),
         preferences = jsonb_set(
           COALESCE(user_profiles.preferences, '{}'::jsonb),
           '{onboarding}',
           $3::jsonb,
           true
         ),
         updated_at = NOW()`,
      [userId, body.business.name, JSON.stringify({ onboarding: onboardingData })]
    );

    // Build response payload (strip sensitive keys for response)
    const responseData = {
      business: body.business,
      template: body.template,
      agents: body.agents,
      integrations: body.integrations,
      providerKeysConfigured: body.providerKeys?.length || 0,
    };

    // Set onboarding cookie for middleware
    res.cookie('onboarding', 'completed', {
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
      httpOnly: false, // Allow JavaScript access
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
    });

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

/**
 * POST /api/onboarding/skip
 * Skip onboarding with minimal data
 */
onboardingRouter.post("/skip", async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: "Authentication required" });
    }

    // Mark onboarding as skipped/completed with minimal data
    const onboardingData = {
      completed: true,
      completedAt: new Date().toISOString(),
      skipped: true,
      business: {
        name: "My Business",
        industry: "Other",
        stage: "startup",
      },
      template: "custom",
      agents: ["responder"],
      integrations: {
        telegram: true,
        slack: false,
        discord: false,
      },
    };

    await pool.query(
      `INSERT INTO user_profiles (user_id, preferences)
       VALUES ($1, $2)
       ON CONFLICT (user_id)
       DO UPDATE SET 
         preferences = jsonb_set(
           COALESCE(user_profiles.preferences, '{}'::jsonb),
           '{onboarding}',
           $2::jsonb,
           true
         ),
         updated_at = NOW()`,
      [userId, JSON.stringify({ onboarding: onboardingData })]
    );

    // Set onboarding cookie for middleware
    res.cookie('onboarding', 'completed', {
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
    });

    res.json({
      success: true,
      message: "Onboarding skipped - you can complete it later from settings",
    });
  } catch (err) {
    console.error("Onboarding skip error:", err);
    res.status(500).json({
      error: "Failed to skip onboarding",
    });
  }
});

/**
 * POST /api/onboarding/invites
 * Send team invitations during onboarding
 */
onboardingRouter.post("/invites", async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const { emails } = req.body as { emails: string[] };

    if (!userId) {
      return res.status(401).json({ error: "Authentication required" });
    }

    if (!emails || !Array.isArray(emails) || emails.length === 0) {
      return res.status(400).json({ error: "At least one email is required" });
    }

    // Validate emails
    const validEmails = emails.filter(email => {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      return emailRegex.test(email);
    });

    if (validEmails.length === 0) {
      return res.status(400).json({ error: "No valid email addresses provided" });
    }

    // Limit to 10 invites at a time
    const emailsToInvite = validEmails.slice(0, 10);

    // Get inviter info
    const userResult = await pool.query(
      "SELECT name, email FROM users WHERE id = $1",
      [userId]
    );
    
    const inviter = userResult.rows[0];

    // Store invites in database
    const inviteResults = [];
    for (const email of emailsToInvite) {
      try {
        await pool.query(
          `INSERT INTO team_invites (invited_by, email, status, invited_at)
           VALUES ($1, $2, 'pending', NOW())
           ON CONFLICT (email, invited_by) 
           DO UPDATE SET invited_at = NOW(), status = 'pending'`,
          [userId, email.toLowerCase()]
        );
        
        inviteResults.push({ email, status: "sent" });
        
        // TODO: Send actual email invitation
        console.log(`Team invite sent to ${email} by ${inviter.name}`);
      } catch (err) {
        console.error(`Failed to create invite for ${email}:`, err);
        inviteResults.push({ email, status: "failed", error: "Database error" });
      }
    }

    res.json({
      success: true,
      message: `Invited ${emailsToInvite.length} team member(s)`,
      invites: inviteResults,
    });
  } catch (err) {
    console.error("Team invites error:", err);
    res.status(500).json({
      error: "Failed to send team invitations",
    });
  }
});

/**
 * PUT /api/onboarding/progress
 * Save onboarding progress to database (for recovery/continuity)
 */
onboardingRouter.put("/progress", async (req: Request, res: Response) => {
  try {
    const body = req.body as Partial<OnboardingPayload> & { currentStep?: number };
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: "Authentication required" });
    }

    // Get existing onboarding data
    const existingResult = await pool.query(
      `SELECT preferences FROM user_profiles WHERE user_id = $1`,
      [userId]
    );

    const existingPreferences = existingResult.rows[0]?.preferences || {};
    const existingOnboarding = existingPreferences.onboarding || {};

    // Merge with existing data
    const updatedOnboarding = {
      ...existingOnboarding,
      // Save current progress
      currentStep: body.currentStep ?? existingOnboarding.currentStep ?? 0,
      lastSavedAt: new Date().toISOString(),
      // Save partial data
      business: body.business || existingOnboarding.business,
      template: body.template || existingOnboarding.template,
      agents: body.agents || existingOnboarding.agents,
      integrations: body.integrations || existingOnboarding.integrations,
      // Track which providers use system keys
      useSystemKeys: body.providerKeys 
        ? Object.fromEntries(
            (body.providerKeys as { provider: string; useSystemKey?: boolean }[])
              .filter(pk => pk.useSystemKey !== undefined)
              .map(pk => [pk.provider, pk.useSystemKey])
          )
        : existingOnboarding.useSystemKeys,
    };

    // Save to database
    await pool.query(
      `INSERT INTO user_profiles (user_id, preferences)
       VALUES ($1, $2)
       ON CONFLICT (user_id)
       DO UPDATE SET 
         preferences = jsonb_set(
           COALESCE(user_profiles.preferences, '{}'::jsonb),
           '{onboarding}',
           $2::jsonb,
           true
         ),
         updated_at = NOW()`,
      [userId, JSON.stringify({ ...existingPreferences, onboarding: updatedOnboarding })]
    );

    res.json({
      success: true,
      message: "Onboarding progress saved",
      data: {
        currentStep: updatedOnboarding.currentStep,
        lastSavedAt: updatedOnboarding.lastSavedAt,
      },
    });
  } catch (err) {
    console.error("Save progress error:", err);
    res.status(500).json({
      error: "Failed to save onboarding progress",
    });
  }
});

/**
 * GET /api/onboarding/progress
 * Get saved onboarding progress from database
 */
onboardingRouter.get("/progress", async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const result = await pool.query(
      `SELECT preferences FROM user_profiles WHERE user_id = $1`,
      [userId]
    );

    const preferences = result.rows[0]?.preferences || {};
    const onboarding = preferences.onboarding || {};

    res.json({
      success: true,
      data: {
        currentStep: onboarding.currentStep ?? 0,
        lastSavedAt: onboarding.lastSavedAt,
        business: onboarding.business,
        template: onboarding.template,
        agents: onboarding.agents,
        integrations: onboarding.integrations,
        useSystemKeys: onboarding.useSystemKeys,
        completed: onboarding.completed,
      },
    });
  } catch (err) {
    console.error("Get progress error:", err);
    res.status(500).json({
      error: "Failed to get onboarding progress",
    });
  }
});
