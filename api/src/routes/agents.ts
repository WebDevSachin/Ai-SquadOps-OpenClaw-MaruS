import { Router } from "express";
import { pool } from "../index";

export const agentsRouter = Router();

// List all agents
agentsRouter.get("/", async (req, res) => {
  try {
    const { squad } = req.query;
    let query = "SELECT * FROM agents";
    const params: any[] = [];

    if (squad) {
      params.push(squad);
      query += ` WHERE squad = $1`;
    }

    query += " ORDER BY squad, name";
    const result = await pool.query(query, params);
    res.json({ agents: result.rows });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch agents", details: String(err) });
  }
});

// Get single agent with stats
agentsRouter.get("/:id", async (req, res) => {
  try {
    const agent = await pool.query("SELECT * FROM agents WHERE id = $1", [req.params.id]);
    if (agent.rows.length === 0) {
      return res.status(404).json({ error: "Agent not found" });
    }

    // Get task counts for this agent
    const taskStats = await pool.query(
      `SELECT status, COUNT(*) as count FROM tasks WHERE assigned_agent = $1 GROUP BY status`,
      [req.params.id]
    );

    // Get recent activity
    const recentActivity = await pool.query(
      `SELECT * FROM audit_log WHERE agent_id = $1 ORDER BY created_at DESC LIMIT 10`,
      [req.params.id]
    );

    // Get usage stats
    const usage = await pool.query(
      `SELECT
        SUM(input_tokens) as total_input_tokens,
        SUM(output_tokens) as total_output_tokens,
        SUM(cost_usd) as total_cost
       FROM usage_log WHERE agent_id = $1`,
      [req.params.id]
    );

    res.json({
      ...agent.rows[0],
      task_stats: taskStats.rows,
      recent_activity: recentActivity.rows,
      usage: usage.rows[0],
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch agent", details: String(err) });
  }
});

// Update agent status
agentsRouter.patch("/:id", async (req, res) => {
  try {
    const { status, model } = req.body;
    const fields: string[] = [];
    const params: any[] = [];

    if (status) { params.push(status); fields.push(`status = $${params.length}`); }
    if (model) { params.push(model); fields.push(`model = $${params.length}`); }

    if (fields.length === 0) {
      return res.status(400).json({ error: "No fields to update" });
    }

    params.push(req.params.id);
    const result = await pool.query(
      `UPDATE agents SET ${fields.join(", ")} WHERE id = $${params.length} RETURNING *`,
      params
    );

    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: "Failed to update agent", details: String(err) });
  }
});
