import { Router } from "express";
import { z } from "zod";
import { pool } from "../../index";
import { validateBody, validateParams, uuidParamSchema } from "../../middleware/validation";

export const v1AgentsRouter = Router();

// =====================================================
// Validation Schemas
// =====================================================

const createAgentSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  description: z.string().max(1000).optional(),
  type: z.enum(["assistant", "researcher", "analyst", "executor", "custom"]).default("assistant"),
  provider: z.enum(["openai", "anthropic", "google", "ollama", "custom"]).default("openai"),
  model: z.string().max(100).optional(),
  config: z.record(z.unknown()).optional(),
  is_active: z.boolean().default(true),
});

const updateAgentSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(1000).optional(),
  type: z.enum(["assistant", "researcher", "analyst", "executor", "custom"]).optional(),
  provider: z.enum(["openai", "anthropic", "google", "ollama", "custom"]).optional(),
  model: z.string().max(100).optional(),
  config: z.record(z.unknown()).optional(),
  is_active: z.boolean().optional(),
});

const agentTriggerSchema = z.object({
  input: z.record(z.unknown()).optional(),
  context: z.record(z.unknown()).optional(),
});

/**
 * @swagger
 * /api/v1/agents:
 *   get:
 *     summary: List agents
 *     description: Get all agents for the authenticated user
 *     tags: [Agents]
 *     security:
 *       - BearerAuth: []
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [assistant, researcher, analyst, executor, custom]
 *       - in: query
 *         name: active
 *         schema:
 *           type: boolean
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: List of agents
 */

v1AgentsRouter.get("/", async (req, res) => {
  try {
    const userId = (req as any).user.id;
    const { type, active, limit = 50, offset = 0 } = req.query;

    let query = `
      SELECT a.*, u.name as user_name
      FROM agents a
      LEFT JOIN users u ON a.user_id = u.id
      WHERE a.user_id = $1
    `;
    const params: any[] = [userId];

    if (type !== undefined) {
      params.push(type);
      query += ` AND a.type = $${params.length}`;
    }
    if (active !== undefined) {
      params.push(active === "true");
      query += ` AND a.is_active = $${params.length}`;
    }

    query += ` ORDER BY a.created_at DESC`;
    params.push(limit);
    query += ` LIMIT $${params.length}`;
    params.push(offset);
    query += ` OFFSET $${params.length}`;

    const result = await pool.query(query, params);

    // Get total count
    const countResult = await pool.query(
      "SELECT COUNT(*) as count FROM agents WHERE user_id = $1",
      [userId]
    );

    res.json({
      agents: result.rows,
      pagination: {
        total: parseInt(countResult.rows[0].count),
        limit: Number(limit),
        offset: Number(offset),
      },
    });
  } catch (err) {
    console.error("Failed to fetch agents:", err);
    res.status(500).json({ error: "Failed to fetch agents", details: String(err) });
  }
});

/**
 * @swagger
 * /api/v1/agents:
 *   post:
 *     summary: Create agent
 *     description: Create a new agent
 *     tags: [Agents]
 *     security:
 *       - BearerAuth: []
 *       - ApiKeyAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *             properties:
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *               type:
 *                 type: string
 *                 enum: [assistant, researcher, analyst, executor, custom]
 *               provider:
 *                 type: string
 *                 enum: [openai, anthropic, google, ollama, custom]
 *               model:
 *                 type: string
 *               config:
 *                 type: object
 *               is_active:
 *                 type: boolean
 *     responses:
 *       201:
 *         description: Agent created
 *       400:
 *         description: Validation error
 */

v1AgentsRouter.post("/", validateBody(createAgentSchema), async (req, res) => {
  try {
    const userId = (req as any).user.id;
    const { name, description, type, provider, model, config, is_active } = req.body;

    const result = await pool.query(
      `INSERT INTO agents (user_id, name, description, type, provider, model, config, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [userId, name, description || null, type || "assistant", provider || "openai", model || null, config || {}, is_active !== false]
    );

    // Log to audit
    await pool.query(
      `INSERT INTO audit_log (agent_id, action, target_type, target_id, details)
       VALUES ($1, 'agent.created', 'agent', $2, $3)`,
      [userId, result.rows[0].id, JSON.stringify({ name, type })]
    );

    res.status(201).json({
      agent: result.rows[0],
      message: "Agent created successfully",
    });
  } catch (err) {
    console.error("Failed to create agent:", err);
    res.status(500).json({ error: "Failed to create agent", details: String(err) });
  }
});

/**
 * @swagger
 * /api/v1/agents/{id}:
 *   get:
 *     summary: Get agent
 *     description: Get a specific agent by ID
 *     tags: [Agents]
 *     security:
 *       - BearerAuth: []
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Agent details
 *       404:
 *         description: Agent not found
 */

v1AgentsRouter.get("/:id", validateParams(uuidParamSchema), async (req, res) => {
  try {
    const { id } = req.params;
    const userId = (req as any).user.id;

    const result = await pool.query(
      "SELECT * FROM agents WHERE id = $1 AND user_id = $2",
      [id, userId]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: "Agent not found" });
      return;
    }

    res.json({ agent: result.rows[0] });
  } catch (err) {
    console.error("Failed to fetch agent:", err);
    res.status(500).json({ error: "Failed to fetch agent", details: String(err) });
  }
});

/**
 * @swagger
 * /api/v1/agents/{id}:
 *   patch:
 *     summary: Update agent
 *     description: Update an existing agent
 *     tags: [Agents]
 *     security:
 *       - BearerAuth: []
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Agent updated
 *       404:
 *         description: Agent not found
 */

v1AgentsRouter.patch("/:id", validateParams(uuidParamSchema), validateBody(updateAgentSchema), async (req, res) => {
  try {
    const { id } = req.params;
    const userId = (req as any).user.id;
    const updates = req.body;

    if (Object.keys(updates).length === 0) {
      res.status(400).json({ error: "No fields to update" });
      return;
    }

    const fields: string[] = [];
    const params: any[] = [];

    Object.entries(updates).forEach(([key, value]) => {
      params.push(value);
      fields.push(`${key} = $${params.length}`);
    });

    fields.push(`updated_at = NOW()`);
    params.push(id, userId);

    const result = await pool.query(
      `UPDATE agents SET ${fields.join(", ")} WHERE id = $${params.length - 1} AND user_id = $${params.length} RETURNING *`,
      params
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: "Agent not found" });
      return;
    }

    res.json({
      agent: result.rows[0],
      message: "Agent updated successfully",
    });
  } catch (err) {
    console.error("Failed to update agent:", err);
    res.status(500).json({ error: "Failed to update agent", details: String(err) });
  }
});

/**
 * @swagger
 * /api/v1/agents/{id}:
 *   delete:
 *     summary: Delete agent
 *     description: Delete an agent
 *     tags: [Agents]
 *     security:
 *       - BearerAuth: []
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Agent deleted
 *       404:
 *         description: Agent not found
 */

v1AgentsRouter.delete("/:id", validateParams(uuidParamSchema), async (req, res) => {
  try {
    const { id } = req.params;
    const userId = (req as any).user.id;

    const result = await pool.query(
      "DELETE FROM agents WHERE id = $1 AND user_id = $2 RETURNING id",
      [id, userId]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: "Agent not found" });
      return;
    }

    res.json({ message: "Agent deleted successfully" });
  } catch (err) {
    console.error("Failed to delete agent:", err);
    res.status(500).json({ error: "Failed to delete agent", details: String(err) });
  }
});

/**
 * @swagger
 * /api/v1/agents/{id}/trigger:
 *   post:
 *     summary: Trigger agent
 *     description: Trigger an agent to execute with given input
 *     tags: [Agents]
 *     security:
 *       - BearerAuth: []
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               input:
 *                 type: object
 *               context:
 *                 type: object
 *     responses:
 *       200:
 *         description: Agent triggered
 *       404:
 *         description: Agent not found
 */

v1AgentsRouter.post("/:id/trigger", validateParams(uuidParamSchema), validateBody(agentTriggerSchema), async (req, res) => {
  try {
    const { id } = req.params;
    const userId = (req as any).user.id;
    const { input, context } = req.body;

    // Get agent
    const agentResult = await pool.query(
      "SELECT * FROM agents WHERE id = $1 AND user_id = $2",
      [id, userId]
    );

    if (agentResult.rows.length === 0) {
      res.status(404).json({ error: "Agent not found" });
      return;
    }

    const agent = agentResult.rows[0];

    // Create task for agent execution
    const taskResult = await pool.query(
      `INSERT INTO tasks (title, description, priority, assigned_agent, created_by, status, tags)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        `Agent: ${agent.name}`,
        JSON.stringify({ input, context }),
        "high",
        id,
        userId,
        "pending",
        ["agent-trigger"],
      ]
    );

    // Log to audit
    await pool.query(
      `INSERT INTO audit_log (agent_id, action, target_type, target_id, details)
       VALUES ($1, 'agent.triggered', 'agent', $2, $3)`,
      [userId, id, JSON.stringify({ task_id: taskResult.rows[0].id, input })]
    );

    // Import and trigger the agent (would need actual implementation)
    res.json({
      task: taskResult.rows[0],
      agent,
      message: "Agent triggered successfully",
    });
  } catch (err) {
    console.error("Failed to trigger agent:", err);
    res.status(500).json({ error: "Failed to trigger agent", details: String(err) });
  }
});
