/**
 * Agent Swarm Orchestrator
 * Manages 100+ parallel agents with lifecycle management,
 * event-driven progress tracking, and result aggregation.
 */

import { EventEmitter } from "events";
import { Pool, PoolClient } from "pg";
import { v4 as uuidv4 } from "uuid";
import { BaseAgent, AgentTask, AgentResult } from "./agent-base";

// Types
export interface SwarmConfig {
  maxConcurrent?: number;
  timeoutSeconds?: number;
  retryAttempts?: number;
  batchSize?: number;
  metadata?: Record<string, any>;
}

export interface Swarm {
  id: string;
  name: string;
  description?: string;
  config: SwarmConfig;
  status: "active" | "paused" | "completed" | "terminated";
  agentCount: number;
  completedCount: number;
  failedCount: number;
  createdBy?: string;
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
}

export interface SwarmAgent {
  id: string;
  swarmId: string;
  templateId: string;
  task: AgentTask;
  status: "pending" | "running" | "completed" | "failed" | "timeout";
  progress: number;
  result?: AgentResult;
  error?: string;
  startedAt?: Date;
  completedAt?: Date;
  timeoutSeconds: number;
  createdAt: Date;
}

export interface SwarmStatus {
  swarm: Swarm;
  agents: SwarmAgent[];
  summary: {
    pending: number;
    running: number;
    completed: number;
    failed: number;
    timeout: number;
    total: number;
    progressPercent: number;
  };
}

// Agent template registry
export interface AgentTemplate {
  id: string;
  name: string;
  description: string;
  factory: (task: AgentTask, config: any) => BaseAgent;
}

export class SwarmOrchestrator extends EventEmitter {
  private pool: Pool;
  private templates: Map<string, AgentTemplate> = new Map();
  private activeAgents: Map<string, BaseAgent> = new Map();
  private maxConcurrent: number = 50; // Default max concurrent agents
  private processingQueues: Map<string, Set<string>> = new Map(); // swarmId -> Set of agent IDs being processed

  constructor(pool: Pool, options?: { maxConcurrent?: number }) {
    super();
    this.pool = pool;
    if (options?.maxConcurrent) {
      this.maxConcurrent = options.maxConcurrent;
    }
  }

  /**
   * Register an agent template
   */
  registerTemplate(template: AgentTemplate): void {
    this.templates.set(template.id, template);
    console.log(`[SwarmOrchestrator] Registered template: ${template.id}`);
  }

  /**
   * Create a new swarm
   */
  async createSwarm(
    name: string,
    config: SwarmConfig = {},
    description?: string,
    userId?: string
  ): Promise<Swarm> {
    const id = uuidv4();
    const mergedConfig = {
      maxConcurrent: 50,
      timeoutSeconds: 300,
      retryAttempts: 2,
      batchSize: 100,
      ...config,
    };

    const result = await this.pool.query(
      `INSERT INTO swarms (id, name, description, config, status, agent_count, completed_count, failed_count, created_by, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
       RETURNING *`,
      [id, name, description || null, JSON.stringify(mergedConfig), "active", 0, 0, 0, userId || null]
    );

    const swarm = this.rowToSwarm(result.rows[0]);
    this.emit("swarm:created", { swarm });
    return swarm;
  }

  /**
   * Spawn a single agent in a swarm
   */
  async spawnAgent(swarmId: string, templateId: string, task: AgentTask): Promise<SwarmAgent> {
    const template = this.templates.get(templateId);
    if (!template) {
      throw new Error(`Agent template not found: ${templateId}`);
    }

    // Get swarm config
    const swarmResult = await this.pool.query("SELECT * FROM swarms WHERE id = $1", [swarmId]);
    if (swarmResult.rows.length === 0) {
      throw new Error(`Swarm not found: ${swarmId}`);
    }

    const swarm = this.rowToSwarm(swarmResult.rows[0]);
    if (swarm.status !== "active") {
      throw new Error(`Cannot spawn agent in ${swarm.status} swarm`);
    }

    const agentId = uuidv4();
    const timeoutSeconds = task.timeoutSeconds || swarm.config.timeoutSeconds || 300;

    // Create swarm agent record
    const result = await this.pool.query(
      `INSERT INTO swarm_agents (id, swarm_id, template_id, task, status, progress, timeout_seconds, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
       RETURNING *`,
      [agentId, swarmId, templateId, JSON.stringify(task), "pending", 0, timeoutSeconds]
    );

    // Update swarm agent count
    await this.pool.query(
      `UPDATE swarms SET agent_count = agent_count + 1, updated_at = NOW() WHERE id = $1`,
      [swarmId]
    );

    const swarmAgent = this.rowToSwarmAgent(result.rows[0]);

    // Emit event
    await this.logEvent(swarmId, agentId, "agent_spawned", {
      templateId,
      taskId: task.id,
    });

    this.emit("agent:spawned", { swarmId, agent: swarmAgent });

    // Process immediately if under concurrency limit
    this.processAgent(swarmId, swarmAgent);

    return swarmAgent;
  }

  /**
   * Spawn multiple agents in parallel (batch)
   */
  async spawnBatch(
    swarmId: string,
    templateId: string,
    tasks: AgentTask[],
    agentConfig?: Record<string, any>
  ): Promise<SwarmAgent[]> {
    const template = this.templates.get(templateId);
    if (!template) {
      throw new Error(`Agent template not found: ${templateId}`);
    }

    // Get swarm config
    const swarmResult = await this.pool.query("SELECT * FROM swarms WHERE id = $1", [swarmId]);
    if (swarmResult.rows.length === 0) {
      throw new Error(`Swarm not found: ${swarmId}`);
    }

    const swarm = this.rowToSwarm(swarmResult.rows[0]);
    if (swarm.status !== "active") {
      throw new Error(`Cannot spawn agents in ${swarm.status} swarm`);
    }

    const timeoutSeconds = swarm.config.timeoutSeconds || 300;
    const batchSize = swarm.config.batchSize || 100;
    const agents: SwarmAgent[] = [];

    // Process in batches to avoid overwhelming the database
    for (let i = 0; i < tasks.length; i += batchSize) {
      const batch = tasks.slice(i, i + batchSize);
      const batchAgents: SwarmAgent[] = [];

      const client = await this.pool.connect();
      try {
        await client.query("BEGIN");

        for (const task of batch) {
          const agentId = uuidv4();
          const result = await client.query(
            `INSERT INTO swarm_agents (id, swarm_id, template_id, task, status, progress, timeout_seconds, created_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
             RETURNING *`,
            [agentId, swarmId, templateId, JSON.stringify(task), "pending", 0, timeoutSeconds]
          );
          batchAgents.push(this.rowToSwarmAgent(result.rows[0]));
        }

        await client.query(
          `UPDATE swarms SET agent_count = agent_count + $1, updated_at = NOW() WHERE id = $2`,
          [batch.length, swarmId]
        );

        await client.query("COMMIT");
        agents.push(...batchAgents);
      } catch (err) {
        await client.query("ROLLBACK");
        throw err;
      } finally {
        client.release();
      }

      // Log batch events
      for (const agent of batchAgents) {
        await this.logEvent(swarmId, agent.id, "agent_spawned", {
          templateId,
          taskId: agent.task.id,
        });
      }
    }

    this.emit("agents:spawned", { swarmId, count: agents.length });

    // Store agent config for processing
    if (agentConfig) {
      (this as any).agentConfigCache = (this as any).agentConfigCache || new Map();
      (this as any).agentConfigCache.set(swarmId, agentConfig);
    }

    // Start processing agents respecting concurrency limits
    this.processBatch(swarmId, agents, agentConfig);

    return agents;
  }

  /**
   * Process a single agent
   */
  private async processAgent(swarmId: string, swarmAgent: SwarmAgent, agentConfig?: Record<string, any>): Promise<void> {
    const template = this.templates.get(swarmAgent.templateId);
    if (!template) {
      await this.failAgent(swarmAgent.id, "Template not found");
      return;
    }

    // Check concurrency limit
    const processing = this.processingQueues.get(swarmId) || new Set();
    if (processing.size >= this.maxConcurrent) {
      // Will be picked up when slots are available
      return;
    }

    processing.add(swarmAgent.id);
    this.processingQueues.set(swarmId, processing);

    try {
      // Update status to running
      await this.pool.query(
        `UPDATE swarm_agents SET status = 'running', started_at = NOW() WHERE id = $1`,
        [swarmAgent.id]
      );

      await this.logEvent(swarmId, swarmAgent.id, "agent_started", {});

      // Get cached agent config if available
      if (!agentConfig) {
        const configCache = (this as any).agentConfigCache;
        if (configCache?.has(swarmId)) {
          agentConfig = configCache.get(swarmId);
        }
      }

      // Create and run the agent with config
      const agent = template.factory(swarmAgent.task, {
        timeoutSeconds: swarmAgent.timeoutSeconds,
        ...agentConfig,
      });

      this.activeAgents.set(swarmAgent.id, agent);

      // Listen for progress updates
      agent.on("progress", async (data: { progress: number; message?: string }) => {
        await this.updateAgentProgress(swarmAgent.id, data.progress);
        await this.logEvent(swarmId, swarmAgent.id, "agent_progress", data);
      });

      // Execute the agent
      const result = await agent.execute();

      // Complete the agent
      await this.completeAgent(swarmAgent.id, result);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      await this.failAgent(swarmAgent.id, errorMessage);
    } finally {
      processing.delete(swarmAgent.id);
      this.activeAgents.delete(swarmAgent.id);

      // Process next pending agents
      this.processPendingAgents(swarmId);
    }
  }

  /**
   * Process a batch of agents respecting concurrency limits
   */
  private async processBatch(swarmId: string, agents: SwarmAgent[], agentConfig?: Record<string, any>): Promise<void> {
    const processing = this.processingQueues.get(swarmId) || new Set();
    const availableSlots = this.maxConcurrent - processing.size;

    if (availableSlots <= 0) {
      // All slots filled, agents will be picked up as slots free
      return;
    }

    const toProcess = agents.slice(0, availableSlots);
    const remaining = agents.slice(availableSlots);

    // Process initial batch
    for (const agent of toProcess) {
      this.processAgent(swarmId, agent, agentConfig);
    }

    // Store remaining for later processing
    // They'll be picked up when active agents complete
  }

  /**
   * Process pending agents when slots become available
   */
  private async processPendingAgents(swarmId: string): Promise<void> {
    const processing = this.processingQueues.get(swarmId) || new Set();
    const availableSlots = this.maxConcurrent - processing.size;

    if (availableSlots <= 0) return;

    // Get pending agents from database
    const result = await this.pool.query(
      `SELECT * FROM swarm_agents 
       WHERE swarm_id = $1 AND status = 'pending' 
       ORDER BY created_at ASC 
       LIMIT $2`,
      [swarmId, availableSlots]
    );

    const pendingAgents = result.rows.map((row) => this.rowToSwarmAgent(row));

    for (const agent of pendingAgents) {
      this.processAgent(swarmId, agent);
    }
  }

  /**
   * Update agent progress
   */
  private async updateAgentProgress(agentId: string, progress: number): Promise<void> {
    await this.pool.query(
      `UPDATE swarm_agents SET progress = $1 WHERE id = $2`,
      [Math.min(100, Math.max(0, progress)), agentId]
    );
    this.emit("agent:progress", { agentId, progress });
  }

  /**
   * Complete an agent successfully
   */
  private async completeAgent(agentId: string, result: AgentResult): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");

      // Get swarm agent to find swarm_id
      const agentResult = await client.query(
        `SELECT * FROM swarm_agents WHERE id = $1`,
        [agentId]
      );
      if (agentResult.rows.length === 0) return;

      const swarmAgent = this.rowToSwarmAgent(agentResult.rows[0]);

      // Update agent status
      await client.query(
        `UPDATE swarm_agents 
         SET status = 'completed', progress = 100, result = $1, completed_at = NOW() 
         WHERE id = $2`,
        [JSON.stringify(result), agentId]
      );

      // Update swarm stats
      await client.query(
        `UPDATE swarms 
         SET completed_count = completed_count + 1, updated_at = NOW() 
         WHERE id = $1`,
        [swarmAgent.swarmId]
      );

      // Log event
      await client.query(
        `INSERT INTO swarm_events (id, swarm_id, agent_id, event_type, payload, created_at)
         VALUES ($1, $2, $3, $4, $5, NOW())`,
        [uuidv4(), swarmAgent.swarmId, agentId, "agent_complete", JSON.stringify({ result })]
      );

      await client.query("COMMIT");

      this.emit("agent:complete", { swarmId: swarmAgent.swarmId, agentId, result });

      // Check if swarm is complete
      await this.checkSwarmCompletion(swarmAgent.swarmId);
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  }

  /**
   * Mark an agent as failed
   */
  private async failAgent(agentId: string, error: string): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");

      const agentResult = await client.query(
        `SELECT * FROM swarm_agents WHERE id = $1`,
        [agentId]
      );
      if (agentResult.rows.length === 0) return;

      const swarmAgent = this.rowToSwarmAgent(agentResult.rows[0]);

      await client.query(
        `UPDATE swarm_agents 
         SET status = 'failed', error = $1, completed_at = NOW() 
         WHERE id = $2`,
        [error, agentId]
      );

      await client.query(
        `UPDATE swarms 
         SET failed_count = failed_count + 1, updated_at = NOW() 
         WHERE id = $1`,
        [swarmAgent.swarmId]
      );

      await client.query(
        `INSERT INTO swarm_events (id, swarm_id, agent_id, event_type, payload, created_at)
         VALUES ($1, $2, $3, $4, $5, NOW())`,
        [uuidv4(), swarmAgent.swarmId, agentId, "agent_error", JSON.stringify({ error })]
      );

      await client.query("COMMIT");

      this.emit("agent:error", { swarmId: swarmAgent.swarmId, agentId, error });

      await this.checkSwarmCompletion(swarmAgent.swarmId);
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  }

  /**
   * Check if a swarm has completed all agents
   */
  private async checkSwarmCompletion(swarmId: string): Promise<void> {
    const result = await this.pool.query(
      `SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status = 'completed') as completed,
        COUNT(*) FILTER (WHERE status = 'failed') as failed,
        COUNT(*) FILTER (WHERE status IN ('pending', 'running')) as active
       FROM swarm_agents WHERE swarm_id = $1`,
      [swarmId]
    );

    const { total, completed, failed, active } = result.rows[0];

    if (active === 0 && parseInt(total) > 0) {
      // All agents finished
      const status = parseInt(failed) === 0 ? "completed" : "completed";
      
      await this.pool.query(
        `UPDATE swarms 
         SET status = $1, completed_at = NOW(), updated_at = NOW() 
         WHERE id = $2`,
        [status, swarmId]
      );

      await this.logEvent(swarmId, null, "swarm_complete", {
        total: parseInt(total),
        completed: parseInt(completed),
        failed: parseInt(failed),
      });

      this.emit("swarm:complete", {
        swarmId,
        summary: { total: parseInt(total), completed: parseInt(completed), failed: parseInt(failed) },
      });
    }
  }

  /**
   * Get swarm status with all agent details
   */
  async getSwarmStatus(swarmId: string): Promise<SwarmStatus | null> {
    const swarmResult = await this.pool.query("SELECT * FROM swarms WHERE id = $1", [swarmId]);
    if (swarmResult.rows.length === 0) {
      return null;
    }

    const swarm = this.rowToSwarm(swarmResult.rows[0]);

    const agentsResult = await this.pool.query(
      `SELECT * FROM swarm_agents WHERE swarm_id = $1 ORDER BY created_at ASC`,
      [swarmId]
    );

    const agents = agentsResult.rows.map((row) => this.rowToSwarmAgent(row));

    const summary = {
      pending: agents.filter((a) => a.status === "pending").length,
      running: agents.filter((a) => a.status === "running").length,
      completed: agents.filter((a) => a.status === "completed").length,
      failed: agents.filter((a) => a.status === "failed").length,
      timeout: agents.filter((a) => a.status === "timeout").length,
      total: agents.length,
      progressPercent: agents.length > 0 
        ? Math.round(agents.reduce((sum, a) => sum + a.progress, 0) / agents.length)
        : 0,
    };

    return { swarm, agents, summary };
  }

  /**
   * Get aggregated results for a swarm
   */
  async getSwarmResults(swarmId: string): Promise<any[]> {
    const result = await this.pool.query(
      `SELECT * FROM swarm_results WHERE swarm_id = $1 ORDER BY created_at DESC`,
      [swarmId]
    );
    return result.rows.map((row) => ({
      id: row.id,
      type: row.result_type,
      data: row.data,
      createdAt: row.created_at,
    }));
  }

  /**
   * Get swarm events (for real-time updates)
   */
  async getSwarmEvents(swarmId: string, since?: Date): Promise<any[]> {
    let query = `SELECT * FROM swarm_events WHERE swarm_id = $1`;
    const params: any[] = [swarmId];

    if (since) {
      query += ` AND created_at > $2`;
      params.push(since);
    }

    query += ` ORDER BY created_at DESC LIMIT 1000`;

    const result = await this.pool.query(query, params);
    return result.rows.map((row) => ({
      id: row.id,
      agentId: row.agent_id,
      type: row.event_type,
      payload: row.payload,
      createdAt: row.created_at,
    }));
  }

  /**
   * Terminate a swarm (stop all agents)
   */
  async terminateSwarm(swarmId: string): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");

      // Cancel all running agents
      const runningResult = await client.query(
        `SELECT * FROM swarm_agents WHERE swarm_id = $1 AND status = 'running'`,
        [swarmId]
      );

      for (const row of runningResult.rows) {
        const agent = this.activeAgents.get(row.id);
        if (agent) {
          agent.terminate();
          this.activeAgents.delete(row.id);
        }
      }

      // Update all pending and running agents to terminated
      await client.query(
        `UPDATE swarm_agents 
         SET status = 'failed', error = 'Swarm terminated', completed_at = NOW() 
         WHERE swarm_id = $1 AND status IN ('pending', 'running')`,
        [swarmId]
      );

      // Update swarm status
      await client.query(
        `UPDATE swarms 
         SET status = 'terminated', updated_at = NOW() 
         WHERE id = $1`,
        [swarmId]
      );

      // Log event
      await client.query(
        `INSERT INTO swarm_events (id, swarm_id, agent_id, event_type, payload, created_at)
         VALUES ($1, $2, $3, $4, $5, NOW())`,
        [uuidv4(), swarmId, null, "swarm_terminated", {}]
      );

      await client.query("COMMIT");

      // Clear processing queue for this swarm
      this.processingQueues.delete(swarmId);

      this.emit("swarm:terminated", { swarmId });
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  }

  /**
   * Pause a swarm (pause new agent spawning)
   */
  async pauseSwarm(swarmId: string): Promise<void> {
    await this.pool.query(
      `UPDATE swarms SET status = 'paused', updated_at = NOW() WHERE id = $1`,
      [swarmId]
    );
    this.emit("swarm:paused", { swarmId });
  }

  /**
   * Resume a paused swarm
   */
  async resumeSwarm(swarmId: string): Promise<void> {
    await this.pool.query(
      `UPDATE swarms SET status = 'active', updated_at = NOW() WHERE id = $1`,
      [swarmId]
    );
    this.emit("swarm:resumed", { swarmId });

    // Resume processing pending agents
    this.processPendingAgents(swarmId);
  }

  /**
   * List all swarms
   */
  async listSwarms(
    userId?: string,
    status?: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<Swarm[]> {
    let query = `SELECT * FROM swarms`;
    const params: any[] = [];
    const conditions: string[] = [];

    if (userId) {
      conditions.push(`created_by = $${params.length + 1}`);
      params.push(userId);
    }

    if (status) {
      conditions.push(`status = $${params.length + 1}`);
      params.push(status);
    }

    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(" AND ")}`;
    }

    query += ` ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    const result = await this.pool.query(query, params);
    return result.rows.map((row) => this.rowToSwarm(row));
  }

  /**
   * Store aggregated results
   */
  async storeResults(swarmId: string, resultType: string, data: any): Promise<void> {
    await this.pool.query(
      `INSERT INTO swarm_results (id, swarm_id, result_type, data, created_at)
       VALUES ($1, $2, $3, $4, NOW())`,
      [uuidv4(), swarmId, resultType, JSON.stringify(data)]
    );
  }

  /**
   * Log a swarm event
   */
  private async logEvent(
    swarmId: string,
    agentId: string | null,
    eventType: string,
    payload: any
  ): Promise<void> {
    await this.pool.query(
      `INSERT INTO swarm_events (id, swarm_id, agent_id, event_type, payload, created_at)
       VALUES ($1, $2, $3, $4, $5, NOW())`,
      [uuidv4(), swarmId, agentId, eventType, JSON.stringify(payload)]
    );
  }

  /**
   * Convert database row to Swarm object
   */
  private rowToSwarm(row: any): Swarm {
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      config: row.config,
      status: row.status,
      agentCount: parseInt(row.agent_count),
      completedCount: parseInt(row.completed_count),
      failedCount: parseInt(row.failed_count),
      createdBy: row.created_by,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      completedAt: row.completed_at,
    };
  }

  /**
   * Convert database row to SwarmAgent object
   */
  private rowToSwarmAgent(row: any): SwarmAgent {
    return {
      id: row.id,
      swarmId: row.swarm_id,
      templateId: row.template_id,
      task: row.task,
      status: row.status,
      progress: row.progress,
      result: row.result,
      error: row.error,
      startedAt: row.started_at,
      completedAt: row.completed_at,
      timeoutSeconds: row.timeout_seconds,
      createdAt: row.created_at,
    };
  }

  /**
   * Get active agent count (for monitoring)
   */
  getActiveAgentCount(): number {
    return this.activeAgents.size;
  }

  /**
   * Get processing queue sizes
   */
  getProcessingQueueSizes(): Record<string, number> {
    const sizes: Record<string, number> = {};
    for (const [swarmId, agents] of this.processingQueues.entries()) {
      sizes[swarmId] = agents.size;
    }
    return sizes;
  }
}

// Singleton instance
let orchestrator: SwarmOrchestrator | null = null;

export function getOrchestrator(pool: Pool): SwarmOrchestrator {
  if (!orchestrator) {
    orchestrator = new SwarmOrchestrator(pool);
  }
  return orchestrator;
}

export function resetOrchestrator(): void {
  orchestrator = null;
}
