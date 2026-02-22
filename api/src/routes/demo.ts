import { Router } from "express";
import { pool } from "../index";

export const demoRouter = Router();

// Reset demo data - reseeds all demo data
demoRouter.post("/reset", async (_req, res) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Clear existing demo data (in correct order to respect foreign keys)
    await client.query("DELETE FROM workflow_step_executions");
    await client.query("DELETE FROM workflow_executions");
    await client.query("DELETE FROM goals");
    await client.query("DELETE FROM workflows");
    await client.query("DELETE FROM swarm_events");
    await client.query("DELETE FROM swarm_results");
    await client.query("DELETE FROM swarm_agents");
    await client.query("DELETE FROM agent_instances");
    await client.query("DELETE FROM swarm_executions");
    await client.query("DELETE FROM swarms");
    await client.query("DELETE FROM audit_log");
    await client.query("DELETE FROM task_dependencies");
    await client.query("DELETE FROM results");
    await client.query("DELETE FROM tasks");

    // Reset agents to active status
    await client.query("UPDATE agents SET status = 'active'");

    // Insert demo tasks (using actual column names from the database)
    const demoTasks = [
      { title: "Research AI content trends", description: "Find top trending AI YouTube channels", priority: "high", status: "pending" },
      { title: "Create video outline", description: "Draft script outline for new video", priority: "medium", status: "pending" },
      { title: "Optimize thumbnails", description: "Generate 5 new thumbnail designs", priority: "medium", status: "pending" },
      { title: "Write SEO description", description: "Update video SEO descriptions", priority: "low", status: "pending" },
      { title: "Schedule social posts", description: "Schedule promotional posts for new content", priority: "low", status: "pending" },
    ];

    for (const task of demoTasks) {
      await client.query(
        `INSERT INTO tasks (title, description, priority, status, assigned_agent)
         VALUES ($1, $2, $3, $4, $5)`,
        [task.title, task.description, task.priority, task.status, "scout"]
      );
    }

    // Insert demo goals (using actual column names from the database)
    const demoGoals = [
      { title: "Increase subscriber count", description: "Grow channel to 10K subscribers", target_value: 10000, current_value: 5000, unit: "subscribers", deadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) },
      { title: "Weekly video uploads", description: "Maintain consistent upload schedule", target_value: 4, current_value: 2, unit: "videos_per_week", deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) },
    ];

    for (const goal of demoGoals) {
      await client.query(
        `INSERT INTO goals (title, description, target_value, current_value, unit, deadline, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [goal.title, goal.description, goal.target_value, goal.current_value, goal.unit, goal.deadline, "active"]
      );
    }

    // Insert demo audit log entries
    const demoAuditLogs = [
      { agent_id: "marus", action: "LOGIN", target_type: "user", target_id: "system", details: { ip: "192.168.1.1", browser: "Chrome" } },
      { agent_id: "scout", action: "TASK_CREATE", target_type: "task", target_id: "task-demo-1", details: { title: "Research AI trends" } },
      { agent_id: "scribe", action: "TASK_CREATE", target_type: "task", target_id: "task-demo-2", details: { title: "Write content" } },
      { agent_id: "canvas", action: "CREATE", target_type: "project", target_id: "proj-demo-1", details: { name: "Demo Project" } },
      { agent_id: "forge", action: "UPDATE", target_type: "settings", target_id: "settings-demo", details: { field: "theme", value: "dark" } },
      { agent_id: "scout", action: "TASK_COMPLETE", target_type: "task", target_id: "task-demo-3", details: { title: "Research completed", duration_minutes: 30 } },
      { agent_id: "marus", action: "AGENT_START", target_type: "agent_instance", target_id: "inst-demo-1", details: { trigger: "scheduled" } },
    ];

    for (const log of demoAuditLogs) {
      await client.query(
        `INSERT INTO audit_log (agent_id, action, target_type, target_id, details)
         VALUES ($1, $2, $3, $4, $5)`,
        [log.agent_id, log.action, log.target_type, log.target_id, JSON.stringify(log.details)]
      );
    }

    await client.query("COMMIT");

    res.json({
      success: true,
      message: "Demo data reset successfully",
      reset: {
        tasks: demoTasks.length,
        goals: demoGoals.length,
        auditLogs: demoAuditLogs.length,
      },
    });
  } catch (err) {
    await client.query("ROLLBACK");
    res.status(500).json({ error: "Failed to reset demo data", details: String(err) });
  } finally {
    client.release();
  }
});
