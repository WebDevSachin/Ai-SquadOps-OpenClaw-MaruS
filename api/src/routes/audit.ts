import { Router } from "express";
import { pool } from "../index";

export const auditRouter = Router();

// List audit log entries
auditRouter.get("/", async (req, res) => {
  try {
    const { agent_id, action, limit = 100, offset = 0 } = req.query;
    let query = `
      SELECT al.*, a.name as agent_name
      FROM audit_log al
      LEFT JOIN agents a ON al.agent_id = a.id
    `;
    const conditions: string[] = [];
    const params: any[] = [];

    if (agent_id) {
      params.push(agent_id);
      conditions.push(`al.agent_id = $${params.length}`);
    }
    if (action) {
      params.push(action);
      conditions.push(`al.action = $${params.length}`);
    }

    if (conditions.length > 0) {
      query += " WHERE " + conditions.join(" AND ");
    }

    query += " ORDER BY al.created_at DESC";
    params.push(limit);
    query += ` LIMIT $${params.length}`;
    params.push(offset);
    query += ` OFFSET $${params.length}`;

    const result = await pool.query(query, params);
    res.json({ entries: result.rows, total: result.rowCount });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch audit log", details: String(err) });
  }
});

// Create audit log entry (called by agents via API)
auditRouter.post("/", async (req, res) => {
  try {
    const { agent_id, action, target_type, target_id, details } = req.body;
    const result = await pool.query(
      `INSERT INTO audit_log (agent_id, action, target_type, target_id, details)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [agent_id, action, target_type, target_id, JSON.stringify(details || {})]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: "Failed to create audit entry", details: String(err) });
  }
});

// Audit stats
auditRouter.get("/stats", async (_req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        agent_id,
        a.name as agent_name,
        COUNT(*) as total_actions,
        MAX(al.created_at) as last_action
      FROM audit_log al
      LEFT JOIN agents a ON al.agent_id = a.id
      GROUP BY agent_id, a.name
      ORDER BY total_actions DESC
    `);
    res.json({ stats: result.rows });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch audit stats", details: String(err) });
  }
});
