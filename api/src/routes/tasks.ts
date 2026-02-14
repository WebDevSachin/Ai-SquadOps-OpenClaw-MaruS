import { Router } from "express";
import { pool } from "../index";

export const tasksRouter = Router();

// List tasks (with optional filters)
tasksRouter.get("/", async (req, res) => {
  try {
    const { status, agent, priority, limit = 50, offset = 0 } = req.query;
    let query = "SELECT t.*, a.name as agent_name FROM tasks t LEFT JOIN agents a ON t.assigned_agent = a.id";
    const conditions: string[] = [];
    const params: any[] = [];

    if (status) {
      params.push(status);
      conditions.push(`t.status = $${params.length}`);
    }
    if (agent) {
      params.push(agent);
      conditions.push(`t.assigned_agent = $${params.length}`);
    }
    if (priority) {
      params.push(priority);
      conditions.push(`t.priority = $${params.length}`);
    }

    if (conditions.length > 0) {
      query += " WHERE " + conditions.join(" AND ");
    }

    query += " ORDER BY t.created_at DESC";
    params.push(limit);
    query += ` LIMIT $${params.length}`;
    params.push(offset);
    query += ` OFFSET $${params.length}`;

    const result = await pool.query(query, params);
    res.json({ tasks: result.rows, total: result.rowCount });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch tasks", details: String(err) });
  }
});

// Get single task
tasksRouter.get("/:id", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT t.*, a.name as agent_name FROM tasks t LEFT JOIN agents a ON t.assigned_agent = a.id WHERE t.id = $1",
      [req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Task not found" });
    }
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch task", details: String(err) });
  }
});

// Create task
tasksRouter.post("/", async (req, res) => {
  try {
    const { title, description, priority, assigned_agent, created_by, parent_task_id, tags, due_date } = req.body;
    const result = await pool.query(
      `INSERT INTO tasks (title, description, priority, assigned_agent, created_by, parent_task_id, tags, due_date)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [title, description, priority || "medium", assigned_agent, created_by, parent_task_id, tags || [], due_date]
    );

    // Log to audit
    await pool.query(
      `INSERT INTO audit_log (agent_id, action, target_type, target_id, details)
       VALUES ($1, 'task.created', 'task', $2, $3)`,
      [created_by, result.rows[0].id, JSON.stringify({ title, assigned_agent })]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: "Failed to create task", details: String(err) });
  }
});

// Update task
tasksRouter.patch("/:id", async (req, res) => {
  try {
    const { status, title, description, priority, assigned_agent } = req.body;
    const fields: string[] = [];
    const params: any[] = [];

    if (status !== undefined) { params.push(status); fields.push(`status = $${params.length}`); }
    if (title !== undefined) { params.push(title); fields.push(`title = $${params.length}`); }
    if (description !== undefined) { params.push(description); fields.push(`description = $${params.length}`); }
    if (priority !== undefined) { params.push(priority); fields.push(`priority = $${params.length}`); }
    if (assigned_agent !== undefined) { params.push(assigned_agent); fields.push(`assigned_agent = $${params.length}`); }

    if (status === "completed") {
      fields.push(`completed_at = NOW()`);
    }

    fields.push(`updated_at = NOW()`);
    params.push(req.params.id);

    const result = await pool.query(
      `UPDATE tasks SET ${fields.join(", ")} WHERE id = $${params.length} RETURNING *`,
      params
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Task not found" });
    }

    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: "Failed to update task", details: String(err) });
  }
});

// Delete task
tasksRouter.delete("/:id", async (req, res) => {
  try {
    await pool.query("DELETE FROM tasks WHERE id = $1", [req.params.id]);
    res.json({ deleted: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to delete task", details: String(err) });
  }
});

// Task stats
tasksRouter.get("/stats/summary", async (_req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        status,
        COUNT(*) as count
      FROM tasks
      GROUP BY status
    `);
    res.json({ stats: result.rows });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch stats", details: String(err) });
  }
});
