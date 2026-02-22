import { Router } from "express";
import { pool } from "../index";

export const triggersRouter = Router();

// List agent triggers
triggersRouter.get("/", async (req, res) => {
  try {
    const { agent_id, status, limit = 20 } = req.query;
    
    let query = `
      SELECT at.*, a.name as agent_name, a.specialty as agent_specialty, a.squad as agent_squad
      FROM agent_triggers at
      LEFT JOIN agents a ON at.agent_id = a.id
    `;
    
    const conditions: string[] = [];
    const params: any[] = [];

    if (agent_id) {
      params.push(agent_id);
      conditions.push(`at.agent_id = $${params.length}`);
    }
    if (status) {
      params.push(status);
      conditions.push(`at.status = $${params.length}`);
    }

    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(" AND ")}`;
    }

    query += ` ORDER BY at.created_at DESC LIMIT $${params.length + 1}`;
    params.push(limit);

    const result = await pool.query(query, params);
    res.json({ triggers: result.rows });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch triggers", details: String(err) });
  }
});

// Trigger single agent
triggersRouter.post("/:id", async (req, res) => {
  const client = await pool.connect();
  try {
    const { input_params } = req.body;
    const userId = (req as any).user?.id;
    const agentId = req.params.id;

    // Verify agent exists
    const agentResult = await client.query(
      "SELECT * FROM agents WHERE id = $1",
      [agentId]
    );

    if (agentResult.rows.length === 0) {
      return res.status(404).json({ error: "Agent not found" });
    }

    const agent = agentResult.rows[0];

    // Create trigger record
    const triggerResult = await client.query(
      `INSERT INTO agent_triggers (agent_id, triggered_by, input_params, status, started_at)
       VALUES ($1, $2, $3, 'running', NOW()) RETURNING *`,
      [agentId, userId, input_params || {}]
    );

    const trigger = triggerResult.rows[0];

    await client.query("COMMIT");

    // Simulate agent execution (in real implementation, this would call the actual agent)
    try {
      // Here you would trigger the actual agent with input_params
      // For now, we'll simulate a successful execution
      const agentOutput = {
        status: "success",
        message: `Agent ${agent.name} executed successfully`,
        result: {
          data: "Sample output data",
          timestamp: new Date().toISOString(),
        },
      };

      // Update trigger with result
      await pool.query(
        `UPDATE agent_triggers 
         SET status = 'completed', output_result = $1, completed_at = NOW()
         WHERE id = $2`,
        [agentOutput, trigger.id]
      );

      res.json({
        trigger: {
          ...trigger,
          status: "completed",
          output_result: agentOutput,
        },
        agent,
      });
    } catch (agentError: any) {
      // Update trigger with error
      await pool.query(
        `UPDATE agent_triggers 
         SET status = 'failed', error_message = $1, completed_at = NOW()
         WHERE id = $2`,
        [agentError.message, trigger.id]
      );

      res.status(500).json({
        error: "Agent execution failed",
        details: agentError.message,
      });
    }
  } catch (err) {
    await client.query("ROLLBACK");
    res.status(500).json({ error: "Failed to trigger agent", details: String(err) });
  } finally {
    client.release();
  }
});

// Trigger multiple agents
triggersRouter.post("/batch", async (req, res) => {
  const client = await pool.connect();
  try {
    const { agent_ids, input_params } = req.body;
    const userId = (req as any).user?.id;

    if (!agent_ids || !Array.isArray(agent_ids) || agent_ids.length === 0) {
      return res.status(400).json({ error: "agent_ids must be a non-empty array" });
    }

    // Verify agents exist
    const agentsResult = await client.query(
      "SELECT * FROM agents WHERE id = ANY($1)",
      [agent_ids]
    );

    if (agentsResult.rows.length !== agent_ids.length) {
      return res.status(404).json({ error: "One or more agents not found" });
    }

    const triggers: any[] = [];

    // Create trigger records for each agent
    for (const agentId of agent_ids) {
      const triggerResult = await client.query(
        `INSERT INTO agent_triggers (agent_id, triggered_by, input_params, status, started_at)
         VALUES ($1, $2, $3, 'running', NOW()) RETURNING *`,
        [agentId, userId, input_params || {}]
      );
      triggers.push(triggerResult.rows[0]);
    }

    await client.query("COMMIT");

    // Execute all agents in parallel
    const executionPromises = agentsResult.rows.map(async (agent, index) => {
      const trigger = triggers[index];
      
      try {
        // Simulate agent execution
        const agentOutput = {
          status: "success",
          message: `Agent ${agent.name} executed successfully`,
          result: {
            data: "Sample output data",
            timestamp: new Date().toISOString(),
          },
        };

        await pool.query(
          `UPDATE agent_triggers 
           SET status = 'completed', output_result = $1, completed_at = NOW()
           WHERE id = $2`,
          [agentOutput, trigger.id]
        );

        return { trigger: { ...trigger, status: "completed", output_result: agentOutput }, agent };
      } catch (agentError: any) {
        await pool.query(
          `UPDATE agent_triggers 
           SET status = 'failed', error_message = $1, completed_at = NOW()
           WHERE id = $2`,
          [agentError.message, trigger.id]
        );

        return { trigger: { ...trigger, status: "failed", error_message: agentError.message }, agent, error: agentError.message };
      }
    });

    const results = await Promise.all(executionPromises);

    res.json({
      results,
      summary: {
        total: results.length,
        succeeded: results.filter((r) => !r.error).length,
        failed: results.filter((r) => r.error).length,
      },
    });
  } catch (err) {
    await client.query("ROLLBACK");
    res.status(500).json({ error: "Failed to trigger agents", details: String(err) });
  } finally {
    client.release();
  }
});

// Get trigger by ID
triggersRouter.get("/:id", async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT at.*, a.name as agent_name, a.specialty as agent_specialty
       FROM agent_triggers at
       LEFT JOIN agents a ON at.agent_id = a.id
       WHERE at.id = $1`,
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Trigger not found" });
    }

    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch trigger", details: String(err) });
  }
});

// Get agent trigger history
triggersRouter.get("/agent/:agentId", async (req, res) => {
  try {
    const { limit = 20 } = req.query;
    
    const result = await pool.query(
      `SELECT * FROM agent_triggers 
       WHERE agent_id = $1
       ORDER BY created_at DESC
       LIMIT $2`,
      [req.params.agentId, limit]
    );

    res.json({ triggers: result.rows });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch trigger history", details: String(err) });
  }
});
