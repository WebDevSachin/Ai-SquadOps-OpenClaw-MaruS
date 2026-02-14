import { Router } from "express";
import { pool } from "../index";

export const approvalsRouter = Router();

// List approvals (pending by default)
approvalsRouter.get("/", async (req, res) => {
  try {
    const { status = "pending", limit = 50 } = req.query;
    const result = await pool.query(
      `SELECT ap.*, a.name as agent_name
       FROM approvals ap
       LEFT JOIN agents a ON ap.agent_id = a.id
       WHERE ap.status = $1
       ORDER BY ap.created_at DESC
       LIMIT $2`,
      [status, limit]
    );
    res.json({ approvals: result.rows });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch approvals", details: String(err) });
  }
});

// Request approval (called by agents)
approvalsRouter.post("/", async (req, res) => {
  try {
    const { agent_id, action_type, title, description, payload } = req.body;
    const result = await pool.query(
      `INSERT INTO approvals (agent_id, action_type, title, description, payload)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [agent_id, action_type, title, description, JSON.stringify(payload || {})]
    );

    // Log to audit
    await pool.query(
      `INSERT INTO audit_log (agent_id, action, target_type, target_id, details)
       VALUES ($1, 'approval.requested', 'approval', $2, $3)`,
      [agent_id, result.rows[0].id, JSON.stringify({ action_type, title })]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: "Failed to create approval", details: String(err) });
  }
});

// Approve or reject
approvalsRouter.patch("/:id", async (req, res) => {
  try {
    const { status, reviewed_by } = req.body; // status: approved | rejected
    if (!["approved", "rejected"].includes(status)) {
      return res.status(400).json({ error: "Status must be 'approved' or 'rejected'" });
    }

    const result = await pool.query(
      `UPDATE approvals
       SET status = $1, reviewed_by = $2, reviewed_at = NOW()
       WHERE id = $3 RETURNING *`,
      [status, reviewed_by, req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Approval not found" });
    }

    // Log to audit
    await pool.query(
      `INSERT INTO audit_log (agent_id, action, target_type, target_id, details)
       VALUES ($1, $2, 'approval', $3, $4)`,
      [
        result.rows[0].agent_id,
        `approval.${status}`,
        req.params.id,
        JSON.stringify({ title: result.rows[0].title }),
      ]
    );

    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: "Failed to update approval", details: String(err) });
  }
});
