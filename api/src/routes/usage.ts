import { Router, Request, Response } from "express";
import { pool } from "../index";

export const usageRouter = Router();

// Free tier limits
const FREE_TIER_REQUESTS_LIMIT = 1000;
const FREE_TIER_TOKENS_LIMIT = 100000;

// Get or create user preferences
async function getUserPreferences(userId: string) {
  try {
    let result = await pool.query(
      `SELECT * FROM user_preferences WHERE user_id = $1`,
      [userId]
    );

    if (result.rows.length === 0) {
      // Create default preferences
      result = await pool.query(
        `INSERT INTO user_preferences (user_id, default_provider, tier, free_requests_limit, free_tokens_limit)
         VALUES ($1, 'minimax', 'free', $2, $3)
         RETURNING *`,
        [userId, FREE_TIER_REQUESTS_LIMIT, FREE_TIER_TOKENS_LIMIT]
      );
    }

    return result.rows[0];
  } catch (err: any) {
    // If table doesn't exist, return default preferences
    if (err.message?.includes('relation "user_preferences" does not exist')) {
      console.warn("user_preferences table doesn't exist, returning defaults");
      return {
        user_id: userId,
        default_provider: 'minimax',
        tier: 'free',
        free_requests_limit: FREE_TIER_REQUESTS_LIMIT,
        free_tokens_limit: FREE_TIER_TOKENS_LIMIT,
        free_requests_used: 0,
        free_tokens_used: 0,
      };
    }
    throw err;
  }
}

/**
 * GET /api/usage
 * Get usage summary for the current user
 */
usageRouter.get("/", async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { days = 30 } = req.query;

    // Get user preferences
    const prefs = await getUserPreferences(userId);

    // Get user's usage stats
    let query = `
      SELECT
        COALESCE(provider, 'minimax') as provider,
        SUM(input_tokens) as total_input_tokens,
        SUM(output_tokens) as total_output_tokens,
        SUM(input_tokens + output_tokens) as total_tokens,
        SUM(cost_usd) as total_cost,
        COUNT(*) as total_requests
      FROM usage_log ul
      WHERE ul.user_id = $1
        AND ul.created_at > NOW() - INTERVAL '1 day' * $2
      GROUP BY provider
      ORDER BY total_cost DESC
    `;
    const result = await pool.query(query, [userId, days]);

    // Get total usage
    const totalResult = await pool.query(
      `SELECT
        COALESCE(SUM(input_tokens), 0) as total_input_tokens,
        COALESCE(SUM(output_tokens), 0) as total_output_tokens,
        COALESCE(SUM(input_tokens + output_tokens), 0) as total_tokens,
        COALESCE(SUM(cost_usd), 0) as total_cost,
        COUNT(*) as total_requests
      FROM usage_log
      WHERE user_id = $1
        AND created_at > NOW() - INTERVAL '1 day' * $2`,
      [userId, days]
    );

    // Calculate tier limits
    const isFreeTier = prefs.tier === 'free';
    const requestsUsed = isFreeTier ? prefs.free_requests_used : totalResult.rows[0].total_requests;
    const requestsLimit = isFreeTier ? prefs.free_requests_limit : null;
    const tokensUsed = isFreeTier ? prefs.free_tokens_used : Number(totalResult.rows[0].total_tokens);
    const tokensLimit = isFreeTier ? prefs.free_tokens_limit : null;

    // Calculate usage percentages and warnings
    let usagePercentage = 0;
    let warningLevel: 'none' | 'warning' | 'critical' | 'blocked' = 'none';

    if (requestsLimit) {
      usagePercentage = Math.round((requestsUsed / requestsLimit) * 100);
      if (usagePercentage >= 100) {
        warningLevel = 'blocked';
      } else if (usagePercentage >= 90) {
        warningLevel = 'critical';
      } else if (usagePercentage >= 80) {
        warningLevel = 'warning';
      }
    }

    res.json({
      usage: result.rows,
      summary: {
        totalRequests: Number(totalResult.rows[0].total_requests),
        totalTokens: Number(totalResult.rows[0].total_tokens),
        totalCost: Number(totalResult.rows[0].total_cost),
        inputTokens: Number(totalResult.rows[0].total_input_tokens),
        outputTokens: Number(totalResult.rows[0].total_output_tokens),
      },
      tier: {
        name: prefs.tier,
        isFreeTier,
        requestsUsed,
        requestsLimit,
        tokensUsed,
        tokensLimit,
        usagePercentage,
        warningLevel,
      },
    });
  } catch (err) {
    console.error("Usage fetch error:", err);
    res.status(500).json({ error: "Failed to fetch usage", details: String(err) });
  }
});

/**
 * GET /api/usage/by-provider
 * Get usage breakdown by provider
 */
usageRouter.get("/by-provider", async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { days = 30 } = req.query;

    const result = await pool.query(
      `SELECT
        COALESCE(provider, 'minimax') as provider,
        SUM(input_tokens) as input_tokens,
        SUM(output_tokens) as output_tokens,
        SUM(input_tokens + output_tokens) as total_tokens,
        SUM(cost_usd) as cost,
        COUNT(*) as requests
      FROM usage_log
      WHERE user_id = $1
        AND created_at > NOW() - INTERVAL '1 day' * $2
      GROUP BY provider
      ORDER BY total_tokens DESC`,
      [userId, days]
    );

    res.json({ providerUsage: result.rows });
  } catch (err) {
    console.error("Provider usage fetch error:", err);
    res.status(500).json({ error: "Failed to fetch provider usage", details: String(err) });
  }
});

/**
 * GET /api/usage/daily
 * Get daily usage breakdown
 */
usageRouter.get("/daily", async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { days = 30 } = req.query;

    const result = await pool.query(
      `SELECT
        DATE(created_at) as date,
        SUM(cost_usd) as daily_cost,
        SUM(input_tokens + output_tokens) as daily_tokens,
        COUNT(*) as requests
      FROM usage_log
      WHERE user_id = $1
        AND created_at > NOW() - INTERVAL '1 day' * $2
      GROUP BY DATE(created_at)
      ORDER BY date DESC`,
      [userId, days]
    );

    res.json({ daily: result.rows });
  } catch (err) {
    console.error("Daily usage fetch error:", err);
    res.status(500).json({ error: "Failed to fetch daily usage", details: String(err) });
  }
});

/**
 * GET /api/usage/tier
 * Get user's tier and usage limits
 */
usageRouter.get("/tier", async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const prefs = await getUserPreferences(userId);

    const isFreeTier = prefs.tier === 'free';
    const requestsUsed = isFreeTier ? prefs.free_requests_used : 0;
    const requestsLimit = isFreeTier ? prefs.free_requests_limit : null;
    const tokensUsed = isFreeTier ? prefs.free_tokens_used : 0;
    const tokensLimit = isFreeTier ? prefs.free_tokens_limit : null;

    let usagePercentage = 0;
    let warningLevel: 'none' | 'warning' | 'critical' | 'blocked' = 'none';

    if (requestsLimit && requestsLimit > 0) {
      usagePercentage = Math.round((requestsUsed / requestsLimit) * 100);
      if (usagePercentage >= 100) {
        warningLevel = 'blocked';
      } else if (usagePercentage >= 90) {
        warningLevel = 'critical';
      } else if (usagePercentage >= 80) {
        warningLevel = 'warning';
      }
    }

    res.json({
      tier: prefs.tier,
      defaultProvider: prefs.default_provider,
      limits: {
        requests: {
          used: requestsUsed,
          limit: requestsLimit,
        },
        tokens: {
          used: tokensUsed,
          limit: tokensLimit,
        },
      },
      usagePercentage,
      warningLevel,
    });
  } catch (err) {
    console.error("Tier fetch error:", err);
    res.status(500).json({ error: "Failed to fetch tier info", details: String(err) });
  }
});

/**
 * POST /api/usage
 * Log usage (called by agents/gateway)
 */
usageRouter.post("/", async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const { agent_id, model, provider = 'minimax', input_tokens = 0, output_tokens = 0, cost_usd = 0 } = req.body;

    if (!userId) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    // Get user preferences for tier check
    const prefs = await getUserPreferences(userId);

    // Check free tier limits
    if (prefs.tier === 'free') {
      const newRequestsUsed = prefs.free_requests_used + 1;
      const newTokensUsed = prefs.free_tokens_used + input_tokens + output_tokens;

      if (newRequestsUsed > prefs.free_requests_limit) {
        return res.status(403).json({
          error: "Free tier request limit exceeded",
          limit: prefs.free_requests_limit,
          used: prefs.free_requests_used,
          upgradeRequired: true,
        });
      }

      if (newTokensUsed > prefs.free_tokens_limit) {
        return res.status(403).json({
          error: "Free tier token limit exceeded",
          limit: prefs.free_tokens_limit,
          used: prefs.free_tokens_used,
          upgradeRequired: true,
        });
      }

      // Update free tier usage
      await pool.query(
        `UPDATE user_preferences 
         SET free_requests_used = $1, free_tokens_used = $2, updated_at = NOW()
         WHERE user_id = $3`,
        [newRequestsUsed, newTokensUsed, userId]
      );
    }

    // Log the usage
    const result = await pool.query(
      `INSERT INTO usage_log (user_id, agent_id, model, provider, input_tokens, output_tokens, cost_usd)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [userId, agent_id, model, provider, input_tokens, output_tokens, cost_usd]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error("Usage log error:", err);
    res.status(500).json({ error: "Failed to log usage", details: String(err) });
  }
});

/**
 * PATCH /api/usage/tier
 * Update user's tier (for admin use)
 */
usageRouter.patch("/tier", async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { tier, defaultProvider } = req.body;

    // Get current preferences
    const prefs = await getUserPreferences(userId);

    // Only allow setting certain fields
    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (tier && ['free', 'pro', 'enterprise'].includes(tier)) {
      updates.push(`tier = $${paramIndex++}`);
      values.push(tier);
    }

    if (defaultProvider) {
      updates.push(`default_provider = $${paramIndex++}`);
      values.push(defaultProvider);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: "No valid fields to update" });
    }

    values.push(userId);

    const result = await pool.query(
      `UPDATE user_preferences SET ${updates.join(', ')}, updated_at = NOW() WHERE user_id = $${paramIndex} RETURNING *`,
      values
    );

    res.json({ preferences: result.rows[0] });
  } catch (err) {
    console.error("Tier update error:", err);
    res.status(500).json({ error: "Failed to update tier", details: String(err) });
  }
});

/**
 * GET /api/usage/limits
 * Get usage limits per provider for onboarding display
 */
usageRouter.get("/limits", async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      // Return default limits for unauthenticated users
      return res.json({
        limits: {
          minimax: { remaining: 100, limit: 100 },
          openai: { remaining: 0, limit: 0 },
          anthropic: { remaining: 0, limit: 0 },
          google: { remaining: 0, limit: 0 },
        },
      });
    }

    // Get user's tier and usage
    const prefs = await getUserPreferences(userId);
    
    // Get usage per provider
    const usageResult = await pool.query(
      `SELECT 
        COALESCE(provider, 'minimax') as provider,
        COUNT(*) as requests
       FROM usage_log 
       WHERE user_id = $1 
         AND created_at > NOW() - INTERVAL '30 days'
       GROUP BY provider`,
      [userId]
    );

    // Calculate remaining limits per provider
    const limits: Record<string, { remaining: number; limit: number }> = {
      minimax: { remaining: 100, limit: 100 }, // Default for system key
      openai: { remaining: 0, limit: 0 },
      anthropic: { remaining: 0, limit: 0 },
      google: { remaining: 0, limit: 0 },
    };

    // If user has BYOK keys, show their actual limits
    if (prefs.tier === 'free') {
      const requestsUsed = Number(prefs.free_requests_used || 0);
      const requestsLimit = Number(prefs.free_requests_limit || 100);
      
      // All BYOK providers share the free tier limits
      limits.openai = { 
        remaining: Math.max(0, requestsLimit - requestsUsed), 
        limit: requestsLimit 
      };
      limits.anthropic = { 
        remaining: Math.max(0, requestsLimit - requestsUsed), 
        limit: requestsLimit 
      };
      limits.google = { 
        remaining: Math.max(0, requestsLimit - requestsUsed), 
        limit: requestsLimit 
      };
    } else {
      // Pro/Enterprise users have unlimited BYOK
      limits.openai = { remaining: -1, limit: -1 };
      limits.anthropic = { remaining: -1, limit: -1 };
      limits.google = { remaining: -1, limit: -1 };
    }

    res.json({ limits });
  } catch (err) {
    console.error("Limits fetch error:", err);
    res.status(500).json({
      error: "Failed to fetch limits",
      details: String(err),
      limits: {
        minimax: { remaining: 100, limit: 100 },
        openai: { remaining: 0, limit: 0 },
        anthropic: { remaining: 0, limit: 0 },
        google: { remaining: 0, limit: 0 },
      },
    });
  }
});
