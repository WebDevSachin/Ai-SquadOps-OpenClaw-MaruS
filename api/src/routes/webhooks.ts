import { Router } from "express";
import { z } from "zod";
import { pool } from "../index";
import { validateBody, validateParams, idParamSchema } from "../middleware/validation";
import { webhookTestLimiter } from "../middleware/rateLimit";

export const webhooksRouter = Router();

// Webhook events enum
export const WEBHOOK_EVENTS = [
  "user.created",
  "user.updated",
  "user.deleted",
  "task.created",
  "task.completed",
  "task.failed",
  "task.started",
  "agent.triggered",
  "agent.completed",
  "workflow.started",
  "workflow.completed",
  "workflow.failed",
] as const;

export type WebhookEvent = typeof WEBHOOK_EVENTS[number];

// Track if webhooks table is initialized
let webhooksTableInitialized = false;

// Validation schemas
const webhookUrlSchema = z.object({
  url: z.string().url("Invalid URL format").max(2048),
  events: z.array(z.string()).min(1, "At least one event is required"),
  name: z.string().min(1).max(100).optional(),
  secret: z.string().max(256).optional(),
  is_active: z.boolean().optional(),
});

const webhookUpdateSchema = z.object({
  url: z.string().url("Invalid URL format").max(2048).optional(),
  events: z.array(z.string()).min(1).optional(),
  name: z.string().min(1).max(100).optional(),
  secret: z.string().max(256).optional(),
  is_active: z.boolean().optional(),
});

const testWebhookSchema = z.object({
  event: z.enum(WEBHOOK_EVENTS),
  payload: z.record(z.unknown()).optional(),
});

// Initialize webhooks table
async function initializeWebhooksTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS webhooks (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID REFERENCES users(id) ON DELETE CASCADE,
      name VARCHAR(100),
      url TEXT NOT NULL,
      events TEXT[] NOT NULL,
      secret VARCHAR(256),
      is_active BOOLEAN DEFAULT TRUE,
      last_triggered_at TIMESTAMP,
      last_status_code INTEGER,
      last_error TEXT,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS webhook_deliveries (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      webhook_id UUID REFERENCES webhooks(id) ON DELETE CASCADE,
      event VARCHAR(100) NOT NULL,
      payload JSONB NOT NULL,
      status_code INTEGER,
      response_body TEXT,
      error TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);
}

// Initialize webhooks table only once and safely
// Defer to avoid pool initialization order issues
// Tables will be created on first API call

/**
 * POST /api/webhooks - Register a new webhook
 */
webhooksRouter.post(
  "/",
  validateBody(webhookUrlSchema),
  async (req, res) => {
    try {
      // Lazy initialize webhooks table on first request
      if (!webhooksTableInitialized) {
        await initializeWebhooksTable();
        webhooksTableInitialized = true;
      }
      
      const userId = (req as any).user.id;
      const { url, events, name, secret, is_active = true } = req.body;

      // Validate that events are supported
      const invalidEvents = events.filter((e: string) => !WEBHOOK_EVENTS.includes(e as WebhookEvent));
      if (invalidEvents.length > 0) {
        res.status(400).json({
          error: "Invalid webhook events",
          invalid_events: invalidEvents,
          supported_events: WEBHOOK_EVENTS,
        });
        return;
      }

      const result = await pool.query(
        `INSERT INTO webhooks (user_id, url, events, name, secret, is_active)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id, user_id, name, url, events, is_active, created_at`,
        [userId, url, events, name, secret, is_active]
      );

      res.status(201).json({
        webhook: result.rows[0],
        message: "Webhook registered successfully",
      });
    } catch (err) {
      console.error("Failed to register webhook:", err);
      res.status(500).json({ error: "Failed to register webhook", details: String(err) });
    }
  }
);

/**
 * GET /api/webhooks - List webhooks
 */
webhooksRouter.get("/", async (req, res) => {
  try {
    // Lazy initialize webhooks table on first request
    if (!webhooksTableInitialized) {
      await initializeWebhooksTable();
      webhooksTableInitialized = true;
    }
    
    const userId = (req as any).user.id;
    const { active, limit = 50, offset = 0 } = req.query;

    let query = `
      SELECT id, user_id, name, url, events, is_active, last_triggered_at,
             last_status_code, last_error, created_at, updated_at
      FROM webhooks
      WHERE user_id = $1
    `;
    const params: any[] = [userId];

    if (active !== undefined) {
      query += ` AND is_active = $2`;
      params.push(active === "true");
      params.push(limit);
      params.push(offset);
    } else {
      params.push(limit);
      params.push(offset);
    }

    query += ` ORDER BY created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`;

    const result = await pool.query(query, params);

    // Get total count
    const countResult = await pool.query(
      "SELECT COUNT(*) as count FROM webhooks WHERE user_id = $1",
      [userId]
    );

    res.json({
      webhooks: result.rows,
      total: parseInt(countResult.rows[0].count),
      limit: Number(limit),
      offset: Number(offset),
    });
  } catch (err) {
    console.error("Failed to list webhooks:", err);
    res.status(500).json({ error: "Failed to list webhooks", details: String(err) });
  }
});

/**
 * GET /api/webhooks/:id - Get single webhook
 */
webhooksRouter.get("/:id", validateParams(idParamSchema), async (req, res) => {
  try {
    const userId = (req as any).user.id;
    const { id } = req.params;

    const result = await pool.query(
      `SELECT id, user_id, name, url, events, secret, is_active,
              last_triggered_at, last_status_code, last_error, created_at, updated_at
       FROM webhooks WHERE id = $1 AND user_id = $2`,
      [id, userId]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: "Webhook not found" });
      return;
    }

    // Get recent deliveries
    const deliveriesResult = await pool.query(
      `SELECT id, event, status_code, created_at
       FROM webhook_deliveries
       WHERE webhook_id = $1
       ORDER BY created_at DESC
       LIMIT 10`,
      [id]
    );

    res.json({
      webhook: result.rows[0],
      recent_deliveries: deliveriesResult.rows,
    });
  } catch (err) {
    console.error("Failed to get webhook:", err);
    res.status(500).json({ error: "Failed to get webhook", details: String(err) });
  }
});

/**
 * PATCH /api/webhooks/:id - Update webhook
 */
webhooksRouter.patch(
  "/:id",
  validateParams(idParamSchema),
  validateBody(webhookUpdateSchema),
  async (req, res) => {
    try {
      const userId = (req as any).user.id;
      const { id } = req.params;
      const { url, events, name, secret, is_active } = req.body;

      // Check if webhook exists and belongs to user
      const existing = await pool.query(
        "SELECT id FROM webhooks WHERE id = $1 AND user_id = $2",
        [id, userId]
      );

      if (existing.rows.length === 0) {
        res.status(404).json({ error: "Webhook not found" });
        return;
      }

      // Validate events if provided
      if (events) {
        const invalidEvents = events.filter((e: string) => !WEBHOOK_EVENTS.includes(e as WebhookEvent));
        if (invalidEvents.length > 0) {
          res.status(400).json({
            error: "Invalid webhook events",
            invalid_events: invalidEvents,
          });
          return;
        }
      }

      const updates: string[] = [];
      const params: any[] = [];
      let paramIndex = 1;

      if (url !== undefined) {
        params.push(url);
        updates.push(`url = $${paramIndex++}`);
      }
      if (events !== undefined) {
        params.push(events);
        updates.push(`events = $${paramIndex++}`);
      }
      if (name !== undefined) {
        params.push(name);
        updates.push(`name = $${paramIndex++}`);
      }
      if (secret !== undefined) {
        params.push(secret);
        updates.push(`secret = $${paramIndex++}`);
      }
      if (is_active !== undefined) {
        params.push(is_active);
        updates.push(`is_active = $${paramIndex++}`);
      }

      if (updates.length === 0) {
        res.status(400).json({ error: "No fields to update" });
        return;
      }

      updates.push(`updated_at = NOW()`);
      params.push(id);

      const result = await pool.query(
        `UPDATE webhooks SET ${updates.join(", ")}
         WHERE id = $${params.length}
         RETURNING id, user_id, name, url, events, is_active, updated_at`,
        params
      );

      res.json({ webhook: result.rows[0], message: "Webhook updated successfully" });
    } catch (err) {
      console.error("Failed to update webhook:", err);
      res.status(500).json({ error: "Failed to update webhook", details: String(err) });
    }
  }
);

/**
 * DELETE /api/webhooks/:id - Remove webhook
 */
webhooksRouter.delete("/:id", validateParams(idParamSchema), async (req, res) => {
  try {
    const userId = (req as any).user.id;
    const { id } = req.params;

    const result = await pool.query(
      "DELETE FROM webhooks WHERE id = $1 AND user_id = $2 RETURNING id",
      [id, userId]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: "Webhook not found" });
      return;
    }

    res.json({ message: "Webhook deleted successfully" });
  } catch (err) {
    console.error("Failed to delete webhook:", err);
    res.status(500).json({ error: "Failed to delete webhook", details: String(err) });
  }
});

/**
 * POST /api/webhooks/:id/test - Test webhook
 */
webhooksRouter.post(
  "/:id/test",
  validateParams(idParamSchema),
  validateBody(testWebhookSchema),
  webhookTestLimiter,
  async (req, res) => {
    try {
      const userId = (req as any).user.id;
      const { id } = req.params;
      const { event, payload } = req.body;

      // Get webhook
      const webhookResult = await pool.query(
        "SELECT * FROM webhooks WHERE id = $1 AND user_id = $2",
        [id, userId]
      );

      if (webhookResult.rows.length === 0) {
        res.status(404).json({ error: "Webhook not found" });
        return;
      }

      const webhook = webhookResult.rows[0];

      // Check if webhook listens for this event
      if (!webhook.events.includes(event)) {
        res.status(400).json({
          error: "Webhook does not listen for this event",
          webhook_events: webhook.events,
          test_event: event,
        });
        return;
      }

      // Create test payload
      const testPayload = {
        event,
        timestamp: new Date().toISOString(),
        data: payload || {
          test: true,
          message: "This is a test webhook delivery",
        },
      };

      // Attempt to deliver
      let statusCode: number | null = null;
      let responseBody: string | null = null;
      let error: string | null = null;

      try {
        const response = await fetch(webhook.url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Webhook-Event": event,
            "X-Webhook-Test": "true",
            ...(webhook.secret && { "X-Webhook-Signature": "test-signature" }),
          },
          body: JSON.stringify(testPayload),
        });

        statusCode = response.status;
        responseBody = await response.text();
      } catch (e) {
        error = e instanceof Error ? e.message : String(e);
      }

      // Record delivery
      await pool.query(
        `INSERT INTO webhook_deliveries (webhook_id, event, payload, status_code, response_body, error)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [id, event, JSON.stringify(testPayload), statusCode, responseBody, error]
      );

      // Update webhook status
      await pool.query(
        `UPDATE webhooks SET last_triggered_at = NOW(), last_status_code = $1, last_error = $2
         WHERE id = $3`,
        [statusCode, error, id]
      );

      res.json({
        success: statusCode !== null && statusCode >= 200 && statusCode < 300,
        status_code: statusCode,
        response_body: responseBody,
        error,
        event,
        delivered_at: new Date().toISOString(),
      });
    } catch (err) {
      console.error("Failed to test webhook:", err);
      res.status(500).json({ error: "Failed to test webhook", details: String(err) });
    }
  }
);

/**
 * GET /api/webhooks/:id/deliveries - Get webhook delivery history
 */
webhooksRouter.get("/:id/deliveries", validateParams(idParamSchema), async (req, res) => {
  try {
    const userId = (req as any).user.id;
    const { id } = req.params;
    const { limit = 20, offset = 0 } = req.query;

    // Verify webhook belongs to user
    const webhookResult = await pool.query(
      "SELECT id FROM webhooks WHERE id = $1 AND user_id = $2",
      [id, userId]
    );

    if (webhookResult.rows.length === 0) {
      res.status(404).json({ error: "Webhook not found" });
      return;
    }

    const result = await pool.query(
      `SELECT id, event, payload, status_code, response_body, error, created_at
       FROM webhook_deliveries
       WHERE webhook_id = $1
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [id, limit, offset]
    );

    const countResult = await pool.query(
      "SELECT COUNT(*) as count FROM webhook_deliveries WHERE webhook_id = $1",
      [id]
    );

    res.json({
      deliveries: result.rows,
      total: parseInt(countResult.rows[0].count),
      limit: Number(limit),
      offset: Number(offset),
    });
  } catch (err) {
    console.error("Failed to get deliveries:", err);
    res.status(500).json({ error: "Failed to get deliveries", details: String(err) });
  }
});

/**
 * GET /api/webhooks/events - List available webhook events
 */
webhooksRouter.get("/events", (_req, res) => {
  res.json({
    events: WEBHOOK_EVENTS,
    descriptions: {
      "user.created": "Triggered when a new user is created",
      "user.updated": "Triggered when user profile is updated",
      "user.deleted": "Triggered when a user is deleted",
      "task.created": "Triggered when a new task is created",
      "task.completed": "Triggered when a task is completed",
      "task.failed": "Triggered when a task fails",
      "task.started": "Triggered when a task starts processing",
      "agent.triggered": "Triggered when an agent is triggered",
      "agent.completed": "Triggered when an agent completes execution",
      "workflow.started": "Triggered when a workflow starts",
      "workflow.completed": "Triggered when a workflow completes",
      "workflow.failed": "Triggered when a workflow fails",
    },
  });
});

// Helper function to trigger webhooks (called from other parts of the application)
export async function triggerWebhooks(
  event: WebhookEvent,
  data: Record<string, unknown>,
  userId: string
): Promise<void> {
  try {
    // Get active webhooks listening for this event
    const result = await pool.query(
      `SELECT * FROM webhooks
       WHERE user_id = $1 AND is_active = true AND $2 = ANY(events)`,
      [userId, event]
    );

    for (const webhook of result.rows) {
      const payload = {
        event,
        timestamp: new Date().toISOString(),
        data,
      };

      // Simple signature (in production, use HMAC-SHA256)
      const signature = webhook.secret
        ? `sha256=${Buffer.from(webhook.secret).toString("hex")}`
        : undefined;

      try {
        const response = await fetch(webhook.url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Webhook-Event": event,
            ...(signature && { "X-Webhook-Signature": signature }),
          },
          body: JSON.stringify(payload),
        });

        await pool.query(
          `INSERT INTO webhook_deliveries (webhook_id, event, payload, status_code, response_body)
           VALUES ($1, $2, $3, $4, $5)`,
          [webhook.id, event, JSON.stringify(payload), response.status, await response.text()]
        );

        await pool.query(
          `UPDATE webhooks SET last_triggered_at = NOW(), last_status_code = $1, last_error = NULL
           WHERE id = $2`,
          [response.status, webhook.id]
        );
      } catch (e) {
        const error = e instanceof Error ? e.message : String(e);
        await pool.query(
          `UPDATE webhooks SET last_triggered_at = NOW(), last_status_code = NULL, last_error = $1
           WHERE id = $2`,
          [error, webhook.id]
        );
      }
    }
  } catch (err) {
    console.error("Failed to trigger webhooks:", err);
  }
}
