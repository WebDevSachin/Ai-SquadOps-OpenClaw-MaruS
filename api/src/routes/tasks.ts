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

    if (status && status !== "all") {
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

    // Get current task status for notification
    let oldStatus = null;
    if (status !== undefined) {
      const currentResult = await pool.query("SELECT status FROM tasks WHERE id = $1", [req.params.id]);
      if (currentResult.rows.length > 0) {
        oldStatus = currentResult.rows[0].status;
      }
    }

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

    // Create notification for status changes
    if (status !== undefined && oldStatus !== status) {
      const task = result.rows[0];
      await createTaskNotification(pool, task, oldStatus, status);
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

// Task stats summary
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

// Task analytics summary
tasksRouter.get("/analytics/summary", async (req, res) => {
  try {
    const userId = req.user?.id;

    // Get task counts by status
    const statusResult = await pool.query(`
      SELECT
        status,
        COUNT(*) as count
      FROM tasks
      WHERE created_by = $1 OR assigned_agent IN (SELECT id FROM agents WHERE user_id = $1)
      GROUP BY status
    `, [userId]);

    const stats: Record<string, number> = {
      total_tasks: 0,
      completed_tasks: 0,
      failed_tasks: 0,
      pending_tasks: 0,
      in_progress_tasks: 0,
    };

    statusResult.rows.forEach((row) => {
      const count = parseInt(row.count) || 0;
      stats.total_tasks += count;
      if (row.status === "completed") stats.completed_tasks = count;
      else if (row.status === "failed") stats.failed_tasks = count;
      else if (row.status === "pending") stats.pending_tasks = count;
      else if (row.status === "in_progress") stats.in_progress_tasks = count;
    });

    // Calculate rates
    const completionRate = stats.total_tasks > 0
      ? Math.round((stats.completed_tasks / stats.total_tasks) * 100)
      : 0;
    const successRate = stats.total_tasks > 0
      ? Math.round((stats.completed_tasks / stats.total_tasks) * 100)
      : 0;
    const failureRate = stats.total_tasks > 0
      ? Math.round((stats.failed_tasks / stats.total_tasks) * 100)
      : 0;

    // Get average duration for completed tasks
    const durationResult = await pool.query(`
      SELECT AVG(EXTRACT(EPOCH FROM (completed_at - created_at))/60) as avg_minutes
      FROM tasks
      WHERE status = 'completed'
        AND completed_at IS NOT NULL
        AND (created_by = $1 OR assigned_agent IN (SELECT id FROM agents WHERE user_id = $1))
    `, [userId]);

    const avgDuration = durationResult.rows[0]?.avg_minutes
      ? Math.round(parseFloat(durationResult.rows[0].avg_minutes))
      : 0;

    res.json({
      ...stats,
      completion_rate: completionRate,
      success_rate: successRate,
      failure_rate: failureRate,
      avg_duration_minutes: avgDuration,
    });
  } catch (err) {
    console.error("Task analytics error:", err);
    res.status(500).json({ error: "Failed to fetch task analytics", details: String(err) });
  }
});

// Weekly task analytics
tasksRouter.get("/analytics/weekly", async (req, res) => {
  try {
    const userId = req.user?.id;

    const result = await pool.query(`
      SELECT
        DATE(created_at) as date,
        COUNT(*) FILTER (WHERE status = 'completed') as completed,
        COUNT(*) FILTER (WHERE status = 'failed') as failed,
        COUNT(*) as created
      FROM tasks
      WHERE created_at > NOW() - INTERVAL '7 days'
        AND (created_by = $1 OR assigned_agent IN (SELECT id FROM agents WHERE user_id = $1))
      GROUP BY DATE(created_at)
      ORDER BY date ASC
    `, [userId]);

    // Fill in missing days
    const weekly: { date: string; completed: number; failed: number; created: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split("T")[0];
      const existing = result.rows.find((r) => r.date === dateStr);

      weekly.push({
        date: dateStr,
        completed: existing ? parseInt(existing.completed) : 0,
        failed: existing ? parseInt(existing.failed) : 0,
        created: existing ? parseInt(existing.created) : 0,
      });
    }

    res.json({ weekly });
  } catch (err) {
    console.error("Weekly task analytics error:", err);
    res.status(500).json({ error: "Failed to fetch weekly analytics", details: String(err) });
  }
});

// Helper function to create task notifications
async function createTaskNotification(
  dbPool: typeof pool,
  task: { id: string; title: string; status: string; created_by: string },
  oldStatus: string | null,
  newStatus: string
) {
  try {
    let notificationType = "";
    let message = "";

    if (newStatus === "completed") {
      notificationType = "task.completed";
      message = `Task "${task.title}" has been completed`;
    } else if (newStatus === "failed") {
      notificationType = "task.failed";
      message = `Task "${task.title}" has failed`;
    } else if (oldStatus === "pending" && newStatus === "in_progress") {
      notificationType = "task.started";
      message = `Task "${task.title}" is now in progress`;
    }

    // Check if notifications table exists, if not create it
    await dbPool.query(`
      CREATE TABLE IF NOT EXISTS user_notifications (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id),
        type VARCHAR(100) NOT NULL,
        title VARCHAR(255) NOT NULL,
        message TEXT,
        reference_id UUID,
        reference_type VARCHAR(50),
        is_read BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `).catch(() => {});

    if (notificationType) {
      // Get user_id from task
      const userResult = await dbPool.query(
        "SELECT created_by FROM tasks WHERE id = $1",
        [task.id]
      );

      if (userResult.rows.length > 0) {
        await dbPool.query(
          `INSERT INTO user_notifications (user_id, type, title, message, reference_id, reference_type)
           VALUES ($1, $2, $3, $4, $5, 'task')`,
          [
            userResult.rows[0].created_by,
            notificationType,
            notificationType.replace(".", " ").replace(/\b\w/g, (l) => l.toUpperCase()),
            message,
            task.id,
          ]
        );
      }
    }
  } catch (err) {
    console.error("Failed to create notification:", err);
  }
}

// Get user notifications
tasksRouter.get("/notifications", async (req, res) => {
  try {
    const userId = req.user!.id;
    const { unread_only, limit = 20 } = req.query;

    // Create notifications table if not exists
    await pool.query(`
      CREATE TABLE IF NOT EXISTS user_notifications (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id),
        type VARCHAR(100) NOT NULL,
        title VARCHAR(255) NOT NULL,
        message TEXT,
        reference_id UUID,
        reference_type VARCHAR(50),
        is_read BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `).catch(() => {});

    let query = `
      SELECT * FROM user_notifications
      WHERE user_id = $1
    `;
    const params: any[] = [userId];

    if (unread_only === "true") {
      query += " AND is_read = FALSE";
    }

    query += " ORDER BY created_at DESC";
    query += ` LIMIT $${params.length + 1}`;
    params.push(limit);

    const result = await pool.query(query, params);

    // Get unread count
    const countResult = await pool.query(
      "SELECT COUNT(*) as count FROM user_notifications WHERE user_id = $1 AND is_read = FALSE",
      [userId]
    );

    res.json({
      notifications: result.rows,
      unread_count: parseInt(countResult.rows[0].count) || 0,
    });
  } catch (err) {
    console.error("Failed to fetch notifications:", err);
    res.status(500).json({ error: "Failed to fetch notifications", details: String(err) });
  }
});

// Mark notification as read
tasksRouter.patch("/notifications/:id/read", async (req, res) => {
  try {
    const userId = req.user!.id;

    const result = await pool.query(
      "UPDATE user_notifications SET is_read = TRUE WHERE id = $1 AND user_id = $2 RETURNING *",
      [req.params.id, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Notification not found" });
    }

    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: "Failed to mark notification as read", details: String(err) });
  }
});

// Mark all notifications as read
tasksRouter.post("/notifications/read-all", async (req, res) => {
  try {
    const userId = req.user!.id;

    await pool.query(
      "UPDATE user_notifications SET is_read = TRUE WHERE user_id = $1",
      [userId]
    );

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to mark all notifications as read", details: String(err) });
  }
});
