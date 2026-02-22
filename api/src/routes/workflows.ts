import { Router } from "express";
import { pool } from "../index";

export const workflowsRouter = Router();

// List all workflows
workflowsRouter.get("/", async (req, res) => {
  try {
    const { status, type } = req.query;
    let query = `
      SELECT w.*, 
        json_agg(
          json_build_object(
            'id', ws.id,
            'step_order', ws.step_order,
            'agent_id', ws.agent_id,
            'name', ws.name,
            'step_type', ws.step_type,
            'config', ws.config,
            'condition_expression', ws.condition_expression,
            'true_step_id', ws.true_step_id,
            'false_step_id', ws.false_step_id
          ) ORDER BY ws.step_order
        ) FILTER (WHERE ws.id IS NOT NULL) as steps
      FROM workflows w
      LEFT JOIN workflow_steps ws ON w.id = ws.workflow_id
    `;
    
    const conditions: string[] = [];
    const params: any[] = [];

    if (status) {
      params.push(status);
      conditions.push(`w.status = $${params.length}`);
    }
    if (type) {
      params.push(type);
      conditions.push(`w.workflow_type = $${params.length}`);
    }

    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(" AND ")}`;
    }

    query += ` GROUP BY w.id ORDER BY w.created_at DESC`;

    const result = await pool.query(query, params);
    res.json({ workflows: result.rows });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch workflows", details: String(err) });
  }
});

// Get single workflow with steps
workflowsRouter.get("/:id", async (req, res) => {
  try {
    const workflow = await pool.query(
      "SELECT * FROM workflows WHERE id = $1",
      [req.params.id]
    );

    if (workflow.rows.length === 0) {
      return res.status(404).json({ error: "Workflow not found" });
    }

    const steps = await pool.query(
      `SELECT ws.*, a.name as agent_name, a.specialty as agent_specialty
       FROM workflow_steps ws
       LEFT JOIN agents a ON ws.agent_id = a.id
       WHERE ws.workflow_id = $1
       ORDER BY ws.step_order`,
      [req.params.id]
    );

    res.json({
      ...workflow.rows[0],
      steps: steps.rows,
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch workflow", details: String(err) });
  }
});

// Create workflow
workflowsRouter.post("/", async (req, res) => {
  const client = await pool.connect();
  try {
    const { name, description, workflow_type, status, config, steps } = req.body;
    const userId = (req as any).user?.id;

    await client.query("BEGIN");

    // Insert workflow
    const workflowResult = await client.query(
      `INSERT INTO workflows (name, description, workflow_type, status, config, created_by)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [name, description, workflow_type || "sequential", status || "active", config || {}, userId]
    );

    const workflow = workflowResult.rows[0];

    // Insert steps if provided
    if (steps && steps.length > 0) {
      for (let i = 0; i < steps.length; i++) {
        const step = steps[i];
        await client.query(
          `INSERT INTO workflow_steps (workflow_id, step_order, agent_id, step_type, name, config, condition_expression, true_step_id, false_step_id)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [
            workflow.id,
            i + 1,
            step.agent_id,
            step.step_type || "agent",
            step.name,
            step.config || {},
            step.condition_expression,
            step.true_step_id,
            step.false_step_id,
          ]
        );
      }
    }

    await client.query("COMMIT");

    // Fetch the complete workflow with steps
    const completeWorkflow = await pool.query(
      "SELECT * FROM workflows WHERE id = $1",
      [workflow.id]
    );
    const workflowSteps = await pool.query(
      "SELECT * FROM workflow_steps WHERE workflow_id = $1 ORDER BY step_order",
      [workflow.id]
    );

    res.status(201).json({
      ...completeWorkflow.rows[0],
      steps: workflowSteps.rows,
    });
  } catch (err) {
    await client.query("ROLLBACK");
    res.status(500).json({ error: "Failed to create workflow", details: String(err) });
  } finally {
    client.release();
  }
});

// Update workflow
workflowsRouter.patch("/:id", async (req, res) => {
  const client = await pool.connect();
  try {
    const { name, description, workflow_type, status, config, steps } = req.body;

    await client.query("BEGIN");

    // Update workflow
    const fields: string[] = ["updated_at = NOW()"];
    const params: any[] = [];

    if (name !== undefined) { params.push(name); fields.push(`name = $${params.length}`); }
    if (description !== undefined) { params.push(description); fields.push(`description = $${params.length}`); }
    if (workflow_type !== undefined) { params.push(workflow_type); fields.push(`workflow_type = $${params.length}`); }
    if (status !== undefined) { params.push(status); fields.push(`status = $${params.length}`); }
    if (config !== undefined) { params.push(config); fields.push(`config = $${params.length}`); }

    params.push(req.params.id);
    const result = await client.query(
      `UPDATE workflows SET ${fields.join(", ")} WHERE id = $${params.length} RETURNING *`,
      params
    );

    if (result.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Workflow not found" });
    }

    // Update steps if provided
    if (steps) {
      // Delete existing steps
      await client.query("DELETE FROM workflow_steps WHERE workflow_id = $1", [req.params.id]);

      // Insert new steps
      for (let i = 0; i < steps.length; i++) {
        const step = steps[i];
        await client.query(
          `INSERT INTO workflow_steps (workflow_id, step_order, agent_id, step_type, name, config, condition_expression, true_step_id, false_step_id)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [
            req.params.id,
            i + 1,
            step.agent_id,
            step.step_type || "agent",
            step.name,
            step.config || {},
            step.condition_expression,
            step.true_step_id,
            step.false_step_id,
          ]
        );
      }
    }

    await client.query("COMMIT");

    // Fetch updated workflow
    const workflowSteps = await pool.query(
      "SELECT * FROM workflow_steps WHERE workflow_id = $1 ORDER BY step_order",
      [req.params.id]
    );

    res.json({
      ...result.rows[0],
      steps: workflowSteps.rows,
    });
  } catch (err) {
    await client.query("ROLLBACK");
    res.status(500).json({ error: "Failed to update workflow", details: String(err) });
  } finally {
    client.release();
  }
});

// Delete workflow
workflowsRouter.delete("/:id", async (req, res) => {
  try {
    const result = await pool.query(
      "DELETE FROM workflows WHERE id = $1 RETURNING id",
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Workflow not found" });
    }

    res.json({ message: "Workflow deleted successfully" });
  } catch (err) {
    res.status(500).json({ error: "Failed to delete workflow", details: String(err) });
  }
});

// Execute workflow
workflowsRouter.post("/:id/execute", async (req, res) => {
  const client = await pool.connect();
  try {
    const { input_payload } = req.body;
    const userId = (req as any).user?.id;

    // Get workflow with steps
    const workflowResult = await client.query(
      "SELECT * FROM workflows WHERE id = $1",
      [req.params.id]
    );

    if (workflowResult.rows.length === 0) {
      return res.status(404).json({ error: "Workflow not found" });
    }

    const workflow = workflowResult.rows[0];

    // Get steps
    const stepsResult = await client.query(
      "SELECT * FROM workflow_steps WHERE workflow_id = $1 ORDER BY step_order",
      [req.params.id]
    );

    const steps = stepsResult.rows;

    if (steps.length === 0) {
      return res.status(400).json({ error: "Workflow has no steps" });
    }

    // Create execution record
    const executionResult = await client.query(
      `INSERT INTO workflow_executions (workflow_id, status, triggered_by, input_payload, started_at)
       VALUES ($1, 'running', $2, $3, NOW()) RETURNING *`,
      [req.params.id, userId, input_payload || {}]
    );

    const execution = executionResult.rows[0];
    const executionOutput: any = {};
    let currentStepIndex = 0;

    await client.query("COMMIT");

    // Execute steps based on workflow type
    if (workflow.workflow_type === "sequential") {
      // Sequential execution
      for (let i = 0; i < steps.length; i++) {
        const step = steps[i];
        
        // Create step execution
        const stepExecResult = await pool.query(
          `INSERT INTO workflow_step_executions (execution_id, step_id, status, started_at, agent_id, input_data)
           VALUES ($1, $2, 'running', NOW(), $3, $4) RETURNING *`,
          [execution.id, step.id, step.agent_id, input_payload || {}]
        );

        // Simulate agent execution (in real implementation, this would call the actual agent)
        try {
          // Here you would trigger the actual agent
          // For now, we'll simulate a successful execution
          const agentResult = { status: "completed", output: { message: `Step ${step.name} completed` } };

          await pool.query(
            `UPDATE workflow_step_executions 
             SET status = 'completed', completed_at = NOW(), output_data = $1
             WHERE id = $2`,
            [agentResult.output, stepExecResult.rows[0].id]
          );

          executionOutput[step.id] = agentResult.output;
        } catch (stepError: any) {
          await pool.query(
            `UPDATE workflow_step_executions 
             SET status = 'failed', completed_at = NOW(), error_message = $1
             WHERE id = $2`,
            [stepError.message, stepExecResult.rows[0].id]
          );

          // Update execution as failed
          await pool.query(
            `UPDATE workflow_executions 
             SET status = 'failed', completed_at = NOW(), error_message = $1
             WHERE id = $2`,
            [stepError.message, execution.id]
          );

          return res.status(500).json({
            error: "Workflow execution failed",
            execution_id: execution.id,
            failed_step: step.name,
            details: stepError.message,
          });
        }
      }
    } else if (workflow.workflow_type === "parallel") {
      // Parallel execution - all agents run simultaneously
      const parallelPromises = steps.map(async (step) => {
        const stepExecResult = await pool.query(
          `INSERT INTO workflow_step_executions (execution_id, step_id, status, started_at, agent_id, input_data)
           VALUES ($1, $2, 'running', NOW(), $3, $4) RETURNING *`,
          [execution.id, step.id, step.agent_id, input_payload || {}]
        );

        try {
          // Simulate parallel agent execution
          const agentResult = { status: "completed", output: { message: `Step ${step.name} completed` } };

          await pool.query(
            `UPDATE workflow_step_executions 
             SET status = 'completed', completed_at = NOW(), output_data = $1
             WHERE id = $2`,
            [agentResult.output, stepExecResult.rows[0].id]
          );

          return { stepId: step.id, output: agentResult.output };
        } catch (stepError: any) {
          await pool.query(
            `UPDATE workflow_step_executions 
             SET status = 'failed', completed_at = NOW(), error_message = $1
             WHERE id = $2`,
            [stepError.message, stepExecResult.rows[0].id]
          );

          return { stepId: step.id, error: stepError.message };
        }
      });

      const results = await Promise.all(parallelPromises);
      
      // Check if any failed
      const hasFailure = results.some((r: any) => r.error);
      
      // Update execution status
      await pool.query(
        `UPDATE workflow_executions 
         SET status = $1, completed_at = NOW(), output_payload = $2
         WHERE id = $3`,
        [hasFailure ? "failed" : "completed", JSON.stringify(results), execution.id]
      );

      if (hasFailure) {
        return res.status(500).json({
          error: "Some parallel steps failed",
          execution_id: execution.id,
          results,
        });
      }
    } else if (workflow.workflow_type === "conditional") {
      // Conditional execution
      for (let i = 0; i < steps.length; i++) {
        const step = steps[i];
        
        if (step.step_type === "condition" && step.condition_expression) {
          // Evaluate condition (simplified - in real implementation use proper evaluation)
          const conditionMet = true; // This would be dynamic based on input_payload and expression
          
          const trueStep = steps.find((s: any) => s.id === step.true_step_id);
          const falseStep = steps.find((s: any) => s.id === step.false_step_id);
          
          const nextStep = conditionMet ? trueStep : falseStep;
          
          if (nextStep) {
            // Execute the next step based on condition
            const stepExecResult = await pool.query(
              `INSERT INTO workflow_step_executions (execution_id, step_id, status, started_at, agent_id, input_data)
               VALUES ($1, $2, 'running', NOW(), $3, $4) RETURNING *`,
              [execution.id, nextStep.id, nextStep.agent_id, input_payload || {}]
            );

            try {
              const agentResult = { status: "completed", output: { message: `Step ${nextStep.name} completed` } };

              await pool.query(
                `UPDATE workflow_step_executions 
                 SET status = 'completed', completed_at = NOW(), output_data = $1
                 WHERE id = $2`,
                [agentResult.output, stepExecResult.rows[0].id]
              );

              executionOutput[nextStep.id] = agentResult.output;
            } catch (stepError: any) {
              await pool.query(
                `UPDATE workflow_step_executions 
                 SET status = 'failed', completed_at = NOW(), error_message = $1
                 WHERE id = $2`,
                [stepError.message, stepExecResult.rows[0].id]
              );
            }
          }
        } else if (step.step_type === "agent") {
          // Regular agent step
          const stepExecResult = await pool.query(
            `INSERT INTO workflow_step_executions (execution_id, step_id, status, started_at, agent_id, input_data)
             VALUES ($1, $2, 'running', NOW(), $3, $4) RETURNING *`,
            [execution.id, step.id, step.agent_id, input_payload || {}]
          );

          try {
            const agentResult = { status: "completed", output: { message: `Step ${step.name} completed` } };

            await pool.query(
              `UPDATE workflow_step_executions 
               SET status = 'completed', completed_at = NOW(), output_data = $1
               WHERE id = $2`,
              [agentResult.output, stepExecResult.rows[0].id]
            );

            executionOutput[step.id] = agentResult.output;
          } catch (stepError: any) {
            await pool.query(
              `UPDATE workflow_step_executions 
               SET status = 'failed', completed_at = NOW(), error_message = $1
               WHERE id = $2`,
              [stepError.message, stepExecResult.rows[0].id]
            );
          }
        }
      }

      // Mark execution as completed
      await pool.query(
        `UPDATE workflow_executions 
         SET status = 'completed', completed_at = NOW(), output_payload = $1
         WHERE id = $2`,
        [JSON.stringify(executionOutput), execution.id]
      );
    }

    // Return execution result
    const finalExecution = await pool.query(
      "SELECT * FROM workflow_executions WHERE id = $1",
      [execution.id]
    );

    res.json({
      execution: finalExecution.rows[0],
      output: executionOutput,
    });
  } catch (err) {
    await client.query("ROLLBACK");
    res.status(500).json({ error: "Failed to execute workflow", details: String(err) });
  } finally {
    client.release();
  }
});

// Get workflow executions
workflowsRouter.get("/:id/executions", async (req, res) => {
  try {
    const { limit = 10 } = req.query;
    
    const result = await pool.query(
      `SELECT we.*, w.name as workflow_name
       FROM workflow_executions we
       JOIN workflows w ON we.workflow_id = w.id
       WHERE we.workflow_id = $1
       ORDER BY we.created_at DESC
       LIMIT $2`,
      [req.params.id, limit]
    );

    res.json({ executions: result.rows });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch executions", details: String(err) });
  }
});

// Get all workflow executions (for dashboard)
workflowsRouter.get("/executions/all", async (req, res) => {
  try {
    const { limit = 20 } = req.query;
    
    const result = await pool.query(
      `SELECT we.*, w.name as workflow_name
       FROM workflow_executions we
       JOIN workflows w ON we.workflow_id = w.id
       ORDER BY we.created_at DESC
       LIMIT $1`,
      [limit]
    );

    res.json({ executions: result.rows });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch executions", details: String(err) });
  }
});
