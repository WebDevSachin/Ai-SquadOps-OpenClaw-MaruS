import { Router } from "express";
import { pool } from "../index";

export const usageRouter = Router();

// Get usage summary
usageRouter.get("/", async (req, res) => {
  try {
    const { agent_id, days = 30 } = req.query;
    let query = `
      SELECT
        agent_id,
        a.name as agent_name,
        SUM(input_tokens) as total_input_tokens,
        SUM(output_tokens) as total_output_tokens,
        SUM(cost_usd) as total_cost,
        COUNT(*) as total_requests
      FROM usage_log ul
      LEFT JOIN agents a ON ul.agent_id = a.id
      WHERE ul.created_at > NOW() - INTERVAL '1 day' * $1
    `;
    const params: any[] = [days];

    if (agent_id) {
      params.push(agent_id);
      query += ` AND ul.agent_id = $${params.length}`;
    }

    query += " GROUP BY agent_id, a.name ORDER BY total_cost DESC";
    const result = await pool.query(query, params);
    res.json({ usage: result.rows });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch usage", details: String(err) });
  }
});

// Log usage (called by agents/gateway)
usageRouter.post("/", async (req, res) => {
  try {
    const { agent_id, model, input_tokens, output_tokens, cost_usd } = req.body;
    const result = await pool.query(
      `INSERT INTO usage_log (agent_id, model, input_tokens, output_tokens, cost_usd)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [agent_id, model, input_tokens, output_tokens, cost_usd]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: "Failed to log usage", details: String(err) });
  }
});

// Daily cost breakdown
usageRouter.get("/daily", async (req, res) => {
  try {
    const { days = 30 } = req.query;
    const result = await pool.query(
      `SELECT
        DATE(created_at) as date,
        SUM(cost_usd) as daily_cost,
        SUM(input_tokens + output_tokens) as daily_tokens,
        COUNT(*) as requests
       FROM usage_log
       WHERE created_at > NOW() - INTERVAL '1 day' * $1
       GROUP BY DATE(created_at)
       ORDER BY date DESC`,
      [days]
    );
    res.json({ daily: result.rows });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch daily usage", details: String(err) });
  }
});
