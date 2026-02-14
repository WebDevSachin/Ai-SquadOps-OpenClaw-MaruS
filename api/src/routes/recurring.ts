import { Router } from "express";
import { pool } from "../index";

export const recurringRouter = Router();

// List recurring tasks
recurringRouter.get("/", async (_req, res) => {
  try {
    const result = await pool.query(
      `SELECT rt.*, a.name as agent_name
       FROM recurring_tasks rt
       LEFT JOIN agents a ON rt.assigned_agent = a.id
       ORDER BY rt.created_at DESC`
    );
    res.json({ recurring: result.rows });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch recurring tasks", details: String(err) });
  }
});

// Create recurring task
recurringRouter.post("/", async (req, res) => {
  try {
    const { title, description, cron_expression, assigned_agent } = req.body;
    const result = await pool.query(
      `INSERT INTO recurring_tasks (title, description, cron_expression, assigned_agent)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [title, description, cron_expression, assigned_agent]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: "Failed to create recurring task", details: String(err) });
  }
});

// Toggle recurring task
recurringRouter.patch("/:id", async (req, res) => {
  try {
    const { enabled } = req.body;
    const result = await pool.query(
      "UPDATE recurring_tasks SET enabled = $1 WHERE id = $2 RETURNING *",
      [enabled, req.params.id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: "Failed to update recurring task", details: String(err) });
  }
});

// Delete recurring task
recurringRouter.delete("/:id", async (req, res) => {
  try {
    await pool.query("DELETE FROM recurring_tasks WHERE id = $1", [req.params.id]);
    res.json({ deleted: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to delete recurring task", details: String(err) });
  }
});
