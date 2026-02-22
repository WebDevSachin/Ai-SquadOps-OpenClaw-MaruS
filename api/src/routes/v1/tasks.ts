import { Router } from "express";
import { z } from "zod";
import { pool } from "../../index";
import { validateBody, validateParams, uuidParamSchema, paginationSchema } from "../../middleware/validation";
import { triggerWebhooks, WebhookEvent } from "../webhooks";

export const v1TasksRouter = Router();

// =====================================================
// Validation Schemas
// =====================================================

const createTaskSchema = z.object({
  title: z.string().min(1, "Title is required").max(500),
  description: z.string().max(5000).optional(),
  priority: z.enum(["low", "medium", "high", "urgent"]).default("medium"),
  assigned_agent: z.string().uuid().optional(),
  tags: z.array(z.string()).max(20).optional(),
  due_date: z.string().datetime().optional(),
  parent_task_id: z.string().uuid().optional(),
});

const updateTaskSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  description: z.string().max(5000).optional(),
  status: z.enum(["pending", "in_progress", "completed", "failed"]).optional(),
  priority: z.enum(["low", "medium", "high", "urgent"]).optional(),
  assigned_agent: z.string().uuid().optional(),
});

const taskFiltersSchema = z.object({
  status: z.enum(["pending", "in_progress", "completed", "failed", "all"]).optional(),
  priority: z.enum(["low", "medium", "high", "urgent"]).optional(),
  agent: z.string().uuid().optional(),
  limit: z.coerce.number().min(1).max(100).default(50),
  offset: z.coerce.number().min(0).default(0),
});

// =====================================================
// OpenAPI Annotations
/**
 * @swagger
 * /api/v1/tasks:
 *   get:
 *     summary: List tasks
 *     description: Retrieve a paginated list of tasks with optional filters
 *     tags: [Tasks]
 *     security:
 *       - BearerAuth: []
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, in_progress, completed, failed, all]
 *       - in: query
 *         name: priority
 *         schema:
 *           type: string
 *           enum: [low, medium, high, urgent]
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           default: 0
 *     responses:
 *       200:
 *         description: List of tasks
 *       401:
 *         description: Unauthorized
 */

v1TasksRouter.get("/", validateQuery(taskFiltersSchema), async (req, res) => {
  try {
    const { status, priority, agent, limit, offset } = req.query as any;
    const userId = (req as any).user.id;

    let query = `
      SELECT t.*, a.name as agent_name
      FROM tasks t
      LEFT JOIN agents a ON t.assigned_agent = a.id
      WHERE (t.created_by = $1 OR t.id IN (
        SELECT task_id FROM task_assignees WHERE user_id = $1
      ))
    `;
    const params: any[] = [userId];
    const conditions: string[] = [];

    if (status && status !== "all") {
      params.push(status);
      conditions.push(`t.status = $${params.length}`);
    }
    if (priority) {
      params.push(priority);
      conditions.push(`t.priority = $${params.length}`);
    }
    if (agent) {
      params.push(agent);
      conditions.push(`t.assigned_agent = $${params.length}`);
    }

    if (conditions.length > 0) {
      query += " AND " + conditions.join(" AND ");
    }

    query += " ORDER BY t.created_at DESC";
    params.push(limit);
    query += ` LIMIT $${params.length}`;
    params.push(offset);
    query += ` OFFSET $${params.length}`;

    const result = await pool.query(query, params);

    // Get total count for pagination
    let countQuery = `
      SELECT COUNT(*) as total
      FROM tasks t
      WHERE (t.created_by = $1 OR t.id IN (
        SELECT task_id FROM task_assignees WHERE user_id = $1
      ))
    `;
    const countParams: any[] = [userId];

    if (status && status !== "all") {
      countParams.push(status);
      countQuery += ` AND t.status = $${countParams.length}`;
    }
    if (priority) {
      countParams.push(priority);
      countQuery += ` AND t.priority = $${countParams.length}`;
    }
    if (agent) {
      countParams.push(agent);
      countQuery += ` AND t.assigned_agent = $${countParams.length}`;
    }

    const countResult = await pool.query(countQuery, countParams);

    res.json({
      tasks: result.rows,
      pagination: {
        total: parseInt(countResult.rows[0].total),
        limit: Number(limit),
        offset: Number(offset),
      },
    });
  } catch (err) {
    console.error("Failed to fetch tasks:", err);
    res.status(500).json({ error: "Failed to fetch tasks", details: String(err) });
  }
});

/**
 * @swagger
 * /api/v1/tasks:
 *   post:
 *     summary: Create task
 *     description: Create a new task
 *     tags: [Tasks]
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
 *               - title
 *             properties:
 *               title:
 *                 type: string
 *               description:
 *                 type: string
 *               priority:
 *                 type: string
 *                 enum: [low, medium, high, urgent]
 *               assigned_agent:
 *                 type: string
 *                 format: uuid
 *               tags:
 *                 type: array
 *                 items:
 *                   type: string
 *               due_date:
 *                 type: string
 *                 format: date-time
 *     responses:
 *       201:
 *         description: Task created
 *       400:
 *         description: Validation error
 */

v1TasksRouter.post("/", validateBody(createTaskSchema), async (req, res) => {
  try {
    const userId = (req as any).user.id;
    const { title, description, priority, assigned_agent, tags, due_date, parent_task_id } = req.body;

    const result = await pool.query(
      `INSERT INTO tasks (title, description, priority, assigned_agent, created_by, parent_task_id, tags, due_date)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [title, description || null, priority || "medium", assigned_agent || null, userId, parent_task_id || null, tags || [], due_date || null]
    );

    // Trigger webhook for task.created
    await triggerWebhooks("task.completed", result.rows[0], userId);

    // Log to audit
    await pool.query(
      `INSERT INTO audit_log (agent_id, action, target_type, target_id, details)
       VALUES ($1, 'task.created', 'task', $2, $3)`,
      [userId, result.rows[0].id, JSON.stringify({ title, assigned_agent })]
    );

    res.status(201).json({
      task: result.rows[0],
      message: "Task created successfully",
    });
  } catch (err) {
    console.error("Failed to create task:", err);
    res.status(500).json({ error: "Failed to create task", details: String(err) });
  }
});

/**
 * @swagger
 * /api/v1/tasks/{id}:
 *   get:
 *     summary: Get task
 *     description: Retrieve a specific task by ID
 *     tags: [Tasks]
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
 *         description: Task details
 *       404:
 *         description: Task not found
 */

v1TasksRouter.get("/:id", validateParams(uuidParamSchema), async (req, res) => {
  try {
    const { id } = req.params;
    const userId = (req as any).user.id;

    const result = await pool.query(
      `SELECT t.*, a.name as agent_name
       FROM tasks t
       LEFT JOIN agents a ON t.assigned_agent = a.id
       WHERE t.id = $1 AND (t.created_by = $2 OR $2 IN (
         SELECT user_id FROM task_assignees WHERE task_id = $1
       ))`,
      [id, userId]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: "Task not found" });
      return;
    }

    res.json({ task: result.rows[0] });
  } catch (err) {
    console.error("Failed to fetch task:", err);
    res.status(500).json({ error: "Failed to fetch task", details: String(err) });
  }
});

/**
 * @swagger
 * /api/v1/tasks/{id}:
 *   patch:
 *     summary: Update task
 *     description: Update an existing task
 *     tags: [Tasks]
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
 *               title:
 *                 type: string
 *               description:
 *                 type: string
 *               status:
 *                 type: string
 *                 enum: [pending, in_progress, completed, failed]
 *               priority:
 *                 type: string
 *                 enum: [low, medium, high, urgent]
 *               assigned_agent:
 *                 type: string
 *                 format: uuid
 *     responses:
 *       200:
 *         description: Task updated
 *       404:
 *         description: Task not found
 */

v1TasksRouter.patch("/:id", validateParams(uuidParamSchema), validateBody(updateTaskSchema), async (req, res) => {
  try {
    const { id } = req.params;
    const userId = (req as any).user.id;
    const { status, title, description, priority, assigned_agent } = req.body;

    // Get current task status for notification
    let oldStatus = null;
    const currentResult = await pool.query("SELECT status FROM tasks WHERE id = $1", [id]);
    if (currentResult.rows.length > 0) {
      oldStatus = currentResult.rows[0].status;
    }

    const fields: string[] = [];
    const params: any[] = [];

    if (status !== undefined) {
      params.push(status);
      fields.push(`status = $${params.length}`);
    }
    if (title !== undefined) {
      params.push(title);
      fields.push(`title = $${params.length}`);
    }
    if (description !== undefined) {
      params.push(description);
      fields.push(`description = $${params.length}`);
    }
    if (priority !== undefined) {
      params.push(priority);
      fields.push(`priority = $${params.length}`);
    }
    if (assigned_agent !== undefined) {
      params.push(assigned_agent);
      fields.push(`assigned_agent = $${params.length}`);
    }

    if (status === "completed") {
      fields.push(`completed_at = NOW()`);
    }

    fields.push(`updated_at = NOW()`);
    params.push(id);

    const result = await pool.query(
      `UPDATE tasks SET ${fields.join(", ")} WHERE id = $${params.length} RETURNING *`,
      params
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: "Task not found" });
      return;
    }

    // Trigger webhooks based on status changes
    if (status !== undefined && oldStatus !== status) {
      const task = result.rows[0];

      if (status === "completed") {
        await triggerWebhooks("task.completed", task, userId);
      } else if (status === "failed") {
        await triggerWebhooks("task.failed", task, userId);
      } else if (oldStatus === "pending" && status === "in_progress") {
        await triggerWebhooks("task.started", task, userId);
      }
    }

    res.json({
      task: result.rows[0],
      message: "Task updated successfully",
    });
  } catch (err) {
    console.error("Failed to update task:", err);
    res.status(500).json({ error: "Failed to update task", details: String(err) });
  }
});

/**
 * @swagger
 * /api/v1/tasks/{id}:
 *   delete:
 *     summary: Delete task
 *     description: Delete a task
 *     tags: [Tasks]
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
 *         description: Task deleted
 *       404:
 *         description: Task not found
 */

v1TasksRouter.delete("/:id", validateParams(uuidParamSchema), async (req, res) => {
  try {
    const { id } = req.params;
    const userId = (req as any).user.id;

    const result = await pool.query(
      "DELETE FROM tasks WHERE id = $1 AND created_by = $2 RETURNING id",
      [id, userId]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: "Task not found" });
      return;
    }

    res.json({ message: "Task deleted successfully" });
  } catch (err) {
    console.error("Failed to delete task:", err);
    res.status(500).json({ error: "Failed to delete task", details: String(err) });
  }
});

// Helper function to validate query
function validateQuery(schema: z.ZodSchema) {
  return (req: any, res: any, next: any) => {
    try {
      req.query = schema.parse(req.query);
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errors = error.errors.map((err) => ({
          field: err.path.join("."),
          message: err.message,
        }));
        res.status(400).json({
          error: "Validation failed",
          validation_errors: errors,
        });
        return;
      }
      next(error);
    }
  };
}
