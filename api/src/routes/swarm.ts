/**
 * Swarm API Routes
 * Provides REST API endpoints for swarm management
 */

import { Router, Request, Response } from "express";
import { Pool } from "pg";
import { v4 as uuidv4 } from "uuid";
import {
  SwarmOrchestrator,
  getOrchestrator,
  registerAllTemplates,
  AgentTask,
} from "../swarm";
import { getLLMProviderConfig } from "../utils/llm-provider";

// Extend Express Request to include user from auth middleware
interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    name: string;
    role: string;
  };
}

export function createSwarmRouter(pool: Pool): Router {
  const router = Router();
  const orchestrator = getOrchestrator(pool);

  // Register all agent templates
  registerAllTemplates(orchestrator);

  // ============================================================
  // POST /swarm/youtube-research - Start YouTube research swarm
  // ============================================================
  router.post("/youtube-research", async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { niches, maxCreatorsPerNiche = 3, config = {} } = req.body;
      const userId = req.user?.id;

      // Validate input
      if (!niches || !Array.isArray(niches) || niches.length === 0) {
        return res.status(400).json({
          error: "Invalid input",
          message: "niches must be a non-empty array of niche strings",
        });
      }

      if (niches.length > 100) {
        return res.status(400).json({
          error: "Too many niches",
          message: "Maximum 100 niches allowed per swarm",
        });
      }

      // Validate each niche
      for (const niche of niches) {
        if (typeof niche !== "string" || niche.trim().length === 0) {
          return res.status(400).json({
            error: "Invalid niche",
            message: "Each niche must be a non-empty string",
          });
        }
      }

      // Check LLM provider configuration
      let llmApiKey: string | undefined;
      if (userId) {
        const providerConfig = await getLLMProviderConfig(userId, "openrouter");
        if (providerConfig?.keyData?.apiKey) {
          llmApiKey = providerConfig.keyData.apiKey;
        }
      }
      
      // Fall back to system keys if no user key configured
      if (!llmApiKey) {
        llmApiKey = process.env.SYSTEM_OPENROUTER_KEY || process.env.OPENROUTER_API_KEY;
      }
      
      // Return error if no API key available
      if (!llmApiKey) {
        return res.status(400).json({
          error: "No LLM API key configured",
          message: "Please add OpenRouter API key in settings or set SYSTEM_OPENROUTER_KEY",
        });
      }

      // Create swarm
      const swarm = await orchestrator.createSwarm(
        `YouTube Research: ${niches.slice(0, 3).join(", ")}${niches.length > 3 ? ` +${niches.length - 3} more` : ""}`,
        {
          maxConcurrent: config.maxConcurrent || 20,
          timeoutSeconds: config.timeoutSeconds || 300,
          retryAttempts: config.retryAttempts || 2,
          batchSize: config.batchSize || 50,
          metadata: {
            type: "youtube-research",
            totalNiches: niches.length,
            maxCreatorsPerNiche,
          },
        },
        `Research top YouTube creators in ${niches.length} niches`,
        userId
      );

      // Prepare tasks for each niche
      const tasks: AgentTask[] = niches.map((niche) => ({
        id: uuidv4(),
        type: "youtube-research",
        payload: {
          niche: niche.trim(),
          maxCreators: maxCreatorsPerNiche,
          minSubscribers: config.minSubscribers || 10000,
          includeStats: true,
        },
        timeoutSeconds: config.timeoutSeconds || 300,
        retries: config.retryAttempts || 2,
        metadata: {
          swarmId: swarm.id,
          niche,
          userId,
        },
      }));

      // Spawn batch of agents with LLM API key in config
      const agents = await orchestrator.spawnBatch(swarm.id, "youtube-researcher", tasks, {
        apiKey: llmApiKey,
        userId,
      });

      // Return immediate response with swarm info
      res.status(202).json({
        success: true,
        message: "YouTube research swarm started",
        swarm: {
          id: swarm.id,
          name: swarm.name,
          status: swarm.status,
          totalAgents: agents.length,
          createdAt: swarm.createdAt,
        },
        agentsSpawned: agents.length,
        estimatedTimeSeconds: Math.ceil(agents.length * 30), // Rough estimate
      });
    } catch (error) {
      console.error("[Swarm API] Error starting YouTube research:", error);
      res.status(500).json({
        error: "Failed to start YouTube research swarm",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  // ============================================================
  // POST /swarm - Create a custom swarm
  // ============================================================
  router.post("/", async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { name, description, config = {}, templateId, tasks = [] } = req.body;
      const userId = req.user?.id;

      if (!name || typeof name !== "string") {
        return res.status(400).json({
          error: "Invalid input",
          message: "name is required",
        });
      }

      if (!templateId || typeof templateId !== "string") {
        return res.status(400).json({
          error: "Invalid input",
          message: "templateId is required",
        });
      }

      if (!Array.isArray(tasks) || tasks.length === 0) {
        return res.status(400).json({
          error: "Invalid input",
          message: "tasks must be a non-empty array",
        });
      }

      if (tasks.length > 1000) {
        return res.status(400).json({
          error: "Too many tasks",
          message: "Maximum 1000 tasks allowed per swarm",
        });
      }

      // Check LLM provider configuration for agents that require LLM
      const llmTemplates = ["youtube-researcher"];
      let llmApiKey: string | undefined;
      
      if (llmTemplates.includes(templateId)) {
        if (userId) {
          const providerConfig = await getLLMProviderConfig(userId, "openrouter");
          if (providerConfig?.keyData?.apiKey) {
            llmApiKey = providerConfig.keyData.apiKey;
          }
        }
        
        // Fall back to system keys if no user key configured
        if (!llmApiKey) {
          llmApiKey = process.env.SYSTEM_OPENROUTER_KEY || process.env.OPENROUTER_API_KEY;
        }
        
        // Return error if no API key available
        if (!llmApiKey) {
          return res.status(400).json({
            error: "No LLM API key configured",
            message: "Please add OpenRouter API key in settings or set SYSTEM_OPENROUTER_KEY",
          });
        }
      }

      // Create swarm
      const swarm = await orchestrator.createSwarm(name, config, description, userId);

      // Prepare agent tasks
      const agentTasks: AgentTask[] = tasks.map((task: any) => ({
        id: uuidv4(),
        type: templateId,
        payload: task.payload || task,
        timeoutSeconds: task.timeoutSeconds || config.timeoutSeconds,
        retries: task.retries || config.retryAttempts,
        metadata: {
          swarmId: swarm.id,
          userId,
          ...task.metadata,
        },
      }));

      // Spawn batch with LLM API key if available
      const agentConfig: Record<string, any> = {};
      if (llmApiKey) {
        agentConfig.apiKey = llmApiKey;
        agentConfig.userId = userId;
      }
      const agents = await orchestrator.spawnBatch(swarm.id, templateId, agentTasks, agentConfig);

      res.status(202).json({
        success: true,
        message: "Swarm created successfully",
        swarm: {
          id: swarm.id,
          name: swarm.name,
          status: swarm.status,
          totalAgents: agents.length,
          createdAt: swarm.createdAt,
        },
        agentsSpawned: agents.length,
      });
    } catch (error) {
      console.error("[Swarm API] Error creating swarm:", error);
      res.status(500).json({
        error: "Failed to create swarm",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  // ============================================================
  // GET /swarm - List all swarms
  // ============================================================
  router.get("/", async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { status, limit = "50", offset = "0" } = req.query;
      const userId = req.user?.id;

      const swarms = await orchestrator.listSwarms(
        userId,
        status as string | undefined,
        parseInt(limit as string),
        parseInt(offset as string)
      );

      res.json({
        swarms: swarms.map((swarm) => ({
          id: swarm.id,
          name: swarm.name,
          description: swarm.description,
          status: swarm.status,
          agentCount: swarm.agentCount,
          completedCount: swarm.completedCount,
          failedCount: swarm.failedCount,
          progress: swarm.agentCount > 0
            ? Math.round(((swarm.completedCount + swarm.failedCount) / swarm.agentCount) * 100)
            : 0,
          createdAt: swarm.createdAt,
          updatedAt: swarm.updatedAt,
          completedAt: swarm.completedAt,
        })),
        pagination: {
          limit: parseInt(limit as string),
          offset: parseInt(offset as string),
        },
      });
    } catch (error) {
      console.error("[Swarm API] Error listing swarms:", error);
      res.status(500).json({
        error: "Failed to list swarms",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  // ============================================================
  // GET /swarm/:id/status - Get swarm progress
  // ============================================================
  router.get("/:id/status", async (req: AuthenticatedRequest, res: Response) => {
    try {
      const id = req.params.id as string;

      const status = await orchestrator.getSwarmStatus(id);

      if (!status) {
        return res.status(404).json({
          error: "Swarm not found",
          message: `No swarm found with ID: ${id}`,
        });
      }

      res.json({
        swarm: {
          id: status.swarm.id,
          name: status.swarm.name,
          description: status.swarm.description,
          status: status.swarm.status,
          config: status.swarm.config,
          createdAt: status.swarm.createdAt,
          updatedAt: status.swarm.updatedAt,
          completedAt: status.swarm.completedAt,
        },
        summary: status.summary,
        agents: status.agents.map((agent) => ({
          id: agent.id,
          templateId: agent.templateId,
          status: agent.status,
          progress: agent.progress,
          task: {
            id: agent.task.id,
            type: agent.task.type,
            payload: agent.task.payload,
          },
          error: agent.error,
          startedAt: agent.startedAt,
          completedAt: agent.completedAt,
        })),
      });
    } catch (error) {
      console.error("[Swarm API] Error getting swarm status:", error);
      res.status(500).json({
        error: "Failed to get swarm status",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  // ============================================================
  // GET /swarm/:id/results - Get aggregated results
  // ============================================================
  router.get("/:id/results", async (req: AuthenticatedRequest, res: Response) => {
    try {
      const id = req.params.id as string;
      const format = req.query.format as string | undefined;

      const status = await orchestrator.getSwarmStatus(id);

      if (!status) {
        return res.status(404).json({
          error: "Swarm not found",
          message: `No swarm found with ID: ${id}`,
        });
      }

      // Get completed agents with results
      const completedAgents = status.agents.filter((a) => a.status === "completed" && a.result);

      // Aggregate results by type
      const aggregatedResults = completedAgents.reduce((acc: any[], agent) => {
        if (agent.result?.data) {
          acc.push({
            agentId: agent.id,
            taskId: agent.task.id,
            taskType: agent.task.type,
            data: agent.result.data,
            metadata: agent.result.metadata,
          });
        }
        return acc;
      }, []);

      // Get stored aggregated results
      const storedResults = await orchestrator.getSwarmResults(id);

      // Format response based on format parameter
      if (format === "compact") {
        res.json({
          swarmId: id,
          status: status.swarm.status,
          summary: {
            total: status.summary.total,
            completed: status.summary.completed,
            failed: status.summary.failed,
            progress: status.summary.progressPercent,
          },
          resultCount: aggregatedResults.length,
          results: aggregatedResults.map((r: any) => ({
            type: r.taskType,
            niche: r.data?.niche,
            creatorsFound: r.data?.creators?.length || 0,
          })),
        });
      } else {
        res.json({
          swarm: {
            id: status.swarm.id,
            name: status.swarm.name,
            status: status.swarm.status,
          },
          summary: status.summary,
          results: {
            agents: aggregatedResults,
            aggregated: storedResults,
          },
          errors: status.agents
            .filter((a) => a.status === "failed")
            .map((a) => ({
              agentId: a.id,
              taskId: a.task.id,
              error: a.error,
            })),
        });
      }
    } catch (error) {
      console.error("[Swarm API] Error getting swarm results:", error);
      res.status(500).json({
        error: "Failed to get swarm results",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  // ============================================================
  // GET /swarm/:id/events - Get swarm events (for real-time updates)
  // ============================================================
  router.get("/:id/events", async (req: AuthenticatedRequest, res: Response) => {
    try {
      const id = req.params.id as string;
      const since = req.query.since;

      const sinceDate = since && typeof since === "string" ? new Date(since) : undefined;
      const events = await orchestrator.getSwarmEvents(id, sinceDate);

      res.json({
        swarmId: id,
        events: events.map((e) => ({
          id: e.id,
          agentId: e.agentId,
          type: e.type,
          payload: e.payload,
          createdAt: e.createdAt,
        })),
        count: events.length,
      });
    } catch (error) {
      console.error("[Swarm API] Error getting swarm events:", error);
      res.status(500).json({
        error: "Failed to get swarm events",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  // ============================================================
  // POST /swarm/:id/pause - Pause a swarm
  // ============================================================
  router.post("/:id/pause", async (req: AuthenticatedRequest, res: Response) => {
    try {
      const id = req.params.id as string;

      const status = await orchestrator.getSwarmStatus(id);
      if (!status) {
        return res.status(404).json({ error: "Swarm not found" });
      }

      await orchestrator.pauseSwarm(id);

      res.json({
        success: true,
        message: "Swarm paused successfully",
        swarmId: id,
      });
    } catch (error) {
      console.error("[Swarm API] Error pausing swarm:", error);
      res.status(500).json({
        error: "Failed to pause swarm",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  // ============================================================
  // POST /swarm/:id/resume - Resume a paused swarm
  // ============================================================
  router.post("/:id/resume", async (req: AuthenticatedRequest, res: Response) => {
    try {
      const id = req.params.id as string;

      const status = await orchestrator.getSwarmStatus(id);
      if (!status) {
        return res.status(404).json({ error: "Swarm not found" });
      }

      await orchestrator.resumeSwarm(id);

      res.json({
        success: true,
        message: "Swarm resumed successfully",
        swarmId: id,
      });
    } catch (error) {
      console.error("[Swarm API] Error resuming swarm:", error);
      res.status(500).json({
        error: "Failed to resume swarm",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  // ============================================================
  // DELETE /swarm/:id - Stop/terminate a swarm
  // ============================================================
  router.delete("/:id", async (req: AuthenticatedRequest, res: Response) => {
    try {
      const id = req.params.id as string;

      const status = await orchestrator.getSwarmStatus(id);
      if (!status) {
        return res.status(404).json({ error: "Swarm not found" });
      }

      // Cannot terminate already completed swarms
      if (status.swarm.status === "completed") {
        return res.status(400).json({
          error: "Cannot terminate",
          message: "Swarm is already completed",
        });
      }

      await orchestrator.terminateSwarm(id);

      res.json({
        success: true,
        message: "Swarm terminated successfully",
        swarmId: id,
        terminatedAgents: status.summary.running + status.summary.pending,
      });
    } catch (error) {
      console.error("[Swarm API] Error terminating swarm:", error);
      res.status(500).json({
        error: "Failed to terminate swarm",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  // ============================================================
  // GET /swarm/templates - List available agent templates
  // ============================================================
  router.get("/templates/list", async (_req: AuthenticatedRequest, res: Response) => {
    try {
      // Return available templates
      res.json({
        templates: [
          {
            id: "youtube-researcher",
            name: "YouTube Researcher",
            description: "Researches niche domains and finds top YouTube creators with detailed stats",
            supportedPayload: {
              niche: "string (required) - The niche to research",
              maxCreators: "number (optional) - Max creators to find (default: 3)",
              minSubscribers: "number (optional) - Minimum subscriber threshold (default: 10000)",
              includeStats: "boolean (optional) - Include detailed stats (default: true)",
            },
            examplePayload: {
              niche: "fitness",
              maxCreators: 3,
              minSubscribers: 100000,
              includeStats: true,
            },
          },
        ],
      });
    } catch (error) {
      console.error("[Swarm API] Error listing templates:", error);
      res.status(500).json({
        error: "Failed to list templates",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  // ============================================================
  // GET /swarm/stats - Get orchestrator stats
  // ============================================================
  router.get("/stats/system", async (_req: AuthenticatedRequest, res: Response) => {
    try {
      res.json({
        activeAgents: orchestrator.getActiveAgentCount(),
        processingQueues: orchestrator.getProcessingQueueSizes(),
        maxConcurrent: 50,
      });
    } catch (error) {
      console.error("[Swarm API] Error getting stats:", error);
      res.status(500).json({
        error: "Failed to get stats",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  // ============================================================
  // OPENCLAW INTEGRATION ROUTES
  // ============================================================

  // GET /swarm/openclaw/health - Check OpenClaw Gateway health
  router.get("/openclaw/health", async (_req: AuthenticatedRequest, res: Response) => {
    try {
      const { getOpenClawClient } = await import("../openclaw-client");
      const client = getOpenClawClient();
      const health = await client.healthCheck();
      res.json(health);
    } catch (error) {
      console.error("[Swarm API] OpenClaw health check failed:", error);
      res.status(503).json({
        error: "OpenClaw Gateway unavailable",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  // GET /swarm/openclaw/agents - List all OpenClaw agents
  router.get("/openclaw/agents", async (_req: AuthenticatedRequest, res: Response) => {
    try {
      const { getOpenClawClient } = await import("../openclaw-client");
      const client = getOpenClawClient();
      const agents = await client.listAgents();
      res.json({ agents });
    } catch (error) {
      console.error("[Swarm API] Error listing OpenClaw agents:", error);
      res.status(500).json({
        error: "Failed to list OpenClaw agents",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  // GET /swarm/openclaw/agents/:id - Get specific OpenClaw agent
  router.get("/openclaw/agents/:id", async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { getOpenClawClient } = await import("../openclaw-client");
      const client = getOpenClawClient();
      const agent = await client.getAgent(req.params.id as string);
      res.json(agent);
    } catch (error) {
      console.error("[Swarm API] Error getting OpenClaw agent:", error);
      res.status(500).json({
        error: "Failed to get OpenClaw agent",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  // POST /swarm/openclaw/agents/:id/start - Start an OpenClaw agent
  router.post("/openclaw/agents/:id/start", async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { prompt, context, timeout } = req.body;
      const agentId = req.params.id as string;
      const userId = req.user?.id;

      if (!prompt) {
        return res.status(400).json({
          error: "Invalid input",
          message: "prompt is required",
        });
      }

      const { getOpenClawClient } = await import("../openclaw-client");
      const client = getOpenClawClient();
      const result = await client.startAgent({
        agentId,
        prompt,
        context: context || { userId },
        timeout,
      });

      // Log the action
      await pool.query(
        `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, new_values, ip_address)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [userId, "AGENT_START", "openclaw_agent", agentId, JSON.stringify(result), req.ip]
      );

      res.status(202).json({
        success: true,
        message: "Agent started successfully",
        sessionId: result.sessionId,
        agentId,
      });
    } catch (error) {
      console.error("[Swarm API] Error starting OpenClaw agent:", error);
      res.status(500).json({
        error: "Failed to start agent",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  // POST /swarm/openclaw/agents/:id/stop - Stop an OpenClaw agent
  router.post("/openclaw/agents/:id/stop", async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { sessionId } = req.body;
      const agentId = req.params.id as string;
      const userId = req.user?.id;

      const { getOpenClawClient } = await import("../openclaw-client");
      const client = getOpenClawClient();
      const result = await client.stopAgent(agentId, sessionId);

      // Log the action
      await pool.query(
        `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, new_values, ip_address)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [userId, "AGENT_STOP", "openclaw_agent", agentId, JSON.stringify(result), req.ip]
      );

      res.json(result);
    } catch (error) {
      console.error("[Swarm API] Error stopping OpenClaw agent:", error);
      res.status(500).json({
        error: "Failed to stop agent",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  // GET /swarm/openclaw/agents/:id/logs - Get agent logs
  router.get("/openclaw/agents/:id/logs", async (req: AuthenticatedRequest, res: Response) => {
    try {
      const limit = parseInt(req.query.limit as string) || 100;
      const { getOpenClawClient } = await import("../openclaw-client");
      const client = getOpenClawClient();
      const logs = await client.getAgentLogs(req.params.id as string, limit);
      res.json(logs);
    } catch (error) {
      console.error("[Swarm API] Error getting agent logs:", error);
      res.status(500).json({
        error: "Failed to get agent logs",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  // POST /swarm/openclaw/swarms - Create an OpenClaw swarm
  router.post("/openclaw/swarms", async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { name, description, agentIds, prompt, coordinationMode } = req.body;
      const userId = req.user?.id;

      if (!name || !agentIds || !Array.isArray(agentIds) || agentIds.length === 0) {
        return res.status(400).json({
          error: "Invalid input",
          message: "name and agentIds (non-empty array) are required",
        });
      }

      if (!prompt) {
        return res.status(400).json({
          error: "Invalid input",
          message: "prompt is required",
        });
      }

      const { getOpenClawClient } = await import("../openclaw-client");
      const client = getOpenClawClient();
      const result = await client.createSwarm({
        name,
        agentIds,
        prompt,
        coordinationMode: coordinationMode || "parallel",
      });

      // Store swarm configuration in database
      const configResult = await pool.query(
        `INSERT INTO swarm_configurations (
          name, description, openclaw_agent_ids, coordination_mode,
          max_concurrent, default_prompt, metadata, created_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING id`,
        [
          name,
          description,
          agentIds,
          coordinationMode || "parallel",
          agentIds.length,
          prompt,
          JSON.stringify({ openclawSwarmId: result.swarmId }),
          userId,
        ]
      );

      // Log the action
      await pool.query(
        `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, new_values, ip_address)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          userId,
          "SWARM_CREATE",
          "swarm_configuration",
          configResult.rows[0].id,
          JSON.stringify({ openclawSwarmId: result.swarmId, agentIds }),
          req.ip,
        ]
      );

      res.status(202).json({
        success: true,
        message: "Swarm created successfully",
        swarmId: result.swarmId,
        configurationId: configResult.rows[0].id,
      });
    } catch (error) {
      console.error("[Swarm API] Error creating OpenClaw swarm:", error);
      res.status(500).json({
        error: "Failed to create swarm",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  // GET /swarm/openclaw/swarms - List OpenClaw swarms
  router.get("/openclaw/swarms", async (_req: AuthenticatedRequest, res: Response) => {
    try {
      const { getOpenClawClient } = await import("../openclaw-client");
      const client = getOpenClawClient();
      const swarms = await client.listSwarms();
      res.json({ swarms });
    } catch (error) {
      console.error("[Swarm API] Error listing OpenClaw swarms:", error);
      res.status(500).json({
        error: "Failed to list swarms",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  // GET /swarm/openclaw/swarms/:id - Get OpenClaw swarm status
  router.get("/openclaw/swarms/:id", async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { getOpenClawClient } = await import("../openclaw-client");
      const client = getOpenClawClient();
      const swarm = await client.getSwarm(req.params.id as string);
      res.json(swarm);
    } catch (error) {
      console.error("[Swarm API] Error getting OpenClaw swarm:", error);
      res.status(500).json({
        error: "Failed to get swarm status",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  // DELETE /swarm/openclaw/swarms/:id - Terminate OpenClaw swarm
  router.delete("/openclaw/swarms/:id", async (req: AuthenticatedRequest, res: Response) => {
    try {
      const swarmId = req.params.id as string;
      const userId = req.user?.id;

      const { getOpenClawClient } = await import("../openclaw-client");
      const client = getOpenClawClient();
      const result = await client.terminateSwarm(swarmId);

      // Log the action
      await pool.query(
        `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, new_values, ip_address)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [userId, "SWARM_TERMINATE", "openclaw_swarm", swarmId, JSON.stringify(result), req.ip]
      );

      res.json(result);
    } catch (error) {
      console.error("[Swarm API] Error terminating OpenClaw swarm:", error);
      res.status(500).json({
        error: "Failed to terminate swarm",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  // POST /swarm/openclaw/swarms/:id/pause - Pause OpenClaw swarm
  router.post("/openclaw/swarms/:id/pause", async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { getOpenClawClient } = await import("../openclaw-client");
      const client = getOpenClawClient();
      const result = await client.pauseSwarm(req.params.id as string);
      res.json(result);
    } catch (error) {
      console.error("[Swarm API] Error pausing OpenClaw swarm:", error);
      res.status(500).json({
        error: "Failed to pause swarm",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  // POST /swarm/openclaw/swarms/:id/resume - Resume OpenClaw swarm
  router.post("/openclaw/swarms/:id/resume", async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { getOpenClawClient } = await import("../openclaw-client");
      const client = getOpenClawClient();
      const result = await client.resumeSwarm(req.params.id as string);
      res.json(result);
    } catch (error) {
      console.error("[Swarm API] Error resuming OpenClaw swarm:", error);
      res.status(500).json({
        error: "Failed to resume swarm",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  // GET /swarm/openclaw/stats - Get OpenClaw system stats
  router.get("/openclaw/stats", async (_req: AuthenticatedRequest, res: Response) => {
    try {
      const { getOpenClawClient } = await import("../openclaw-client");
      const client = getOpenClawClient();
      const stats = await client.getStats();
      res.json(stats);
    } catch (error) {
      console.error("[Swarm API] Error getting OpenClaw stats:", error);
      res.status(500).json({
        error: "Failed to get OpenClaw stats",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  // ============================================================
  // DATABASE SWARM MANAGEMENT ROUTES
  // ============================================================

  // GET /swarm/configurations - List saved swarm configurations
  router.get("/configurations", async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user?.id;
      const { role } = req.user || {};

      let query = `
        SELECT sc.*, u.email as creator_email, u.name as creator_name
        FROM swarm_configurations sc
        LEFT JOIN users u ON sc.created_by = u.id
        WHERE sc.is_active = true
      `;
      const params: any[] = [];

      // Filter to user's configs unless admin
      if (role !== "admin") {
        query += ` AND (sc.is_public = true OR sc.created_by = $1)`;
        params.push(userId);
      }

      query += ` ORDER BY sc.created_at DESC`;

      const result = await pool.query(query, params);
      res.json({ configurations: result.rows });
    } catch (error) {
      console.error("[Swarm API] Error listing configurations:", error);
      res.status(500).json({
        error: "Failed to list configurations",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  // POST /swarm/configurations - Create a swarm configuration
  router.post("/configurations", async (req: AuthenticatedRequest, res: Response) => {
    try {
      const {
        name,
        description,
        openclawAgentIds,
        coordinationMode,
        maxConcurrent,
        timeoutSeconds,
        retryAttempts,
        taskTemplate,
        defaultPrompt,
        context,
        agentAllocationStrategy,
        loadBalancingEnabled,
        isPublic,
      } = req.body;
      const userId = req.user?.id;

      if (!name || !openclawAgentIds || !Array.isArray(openclawAgentIds)) {
        return res.status(400).json({
          error: "Invalid input",
          message: "name and openclawAgentIds (array) are required",
        });
      }

      const result = await pool.query(
        `INSERT INTO swarm_configurations (
          name, description, openclaw_agent_ids, coordination_mode,
          max_concurrent, timeout_seconds, retry_attempts, task_template,
          default_prompt, context, agent_allocation_strategy, load_balancing_enabled,
          is_public, created_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
        RETURNING *`,
        [
          name,
          description,
          openclawAgentIds,
          coordinationMode || "parallel",
          maxConcurrent || 10,
          timeoutSeconds || 300,
          retryAttempts || 2,
          taskTemplate,
          defaultPrompt,
          context || {},
          agentAllocationStrategy || "round_robin",
          loadBalancingEnabled !== false,
          isPublic || false,
          userId,
        ]
      );

      res.status(201).json({
        success: true,
        configuration: result.rows[0],
      });
    } catch (error) {
      console.error("[Swarm API] Error creating configuration:", error);
      res.status(500).json({
        error: "Failed to create configuration",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  // GET /swarm/configurations/:id - Get a specific configuration
  router.get("/configurations/:id", async (req: AuthenticatedRequest, res: Response) => {
    try {
      const result = await pool.query(
        `SELECT sc.*, u.email as creator_email, u.name as creator_name
         FROM swarm_configurations sc
         LEFT JOIN users u ON sc.created_by = u.id
         WHERE sc.id = $1`,
        [req.params.id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: "Configuration not found" });
      }

      res.json({ configuration: result.rows[0] });
    } catch (error) {
      console.error("[Swarm API] Error getting configuration:", error);
      res.status(500).json({
        error: "Failed to get configuration",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  // DELETE /swarm/configurations/:id - Delete a configuration
  router.delete("/configurations/:id", async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user?.id;
      const { role } = req.user || {};

      // Check ownership or admin
      const check = await pool.query(
        `SELECT created_by FROM swarm_configurations WHERE id = $1`,
        [req.params.id]
      );

      if (check.rows.length === 0) {
        return res.status(404).json({ error: "Configuration not found" });
      }

      if (check.rows[0].created_by !== userId && role !== "admin") {
        return res.status(403).json({ error: "Not authorized" });
      }

      await pool.query(
        `UPDATE swarm_configurations SET is_active = false, updated_at = NOW() WHERE id = $1`,
        [req.params.id]
      );

      res.json({ success: true, message: "Configuration deleted" });
    } catch (error) {
      console.error("[Swarm API] Error deleting configuration:", error);
      res.status(500).json({
        error: "Failed to delete configuration",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  // GET /swarm/executions - List swarm executions
  router.get("/executions", async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user?.id;
      const { role } = req.user || {};
      const { status, limit = "50", offset = "0" } = req.query;

      let query = `
        SELECT se.*, sc.name as configuration_name
        FROM swarm_executions se
        LEFT JOIN swarm_configurations sc ON se.configuration_id = sc.id
        WHERE 1=1
      `;
      const params: any[] = [];

      if (role !== "admin") {
        query += ` AND se.created_by = $1`;
        params.push(userId);
      }

      if (status) {
        params.push(status);
        query += ` AND se.status = $${params.length}`;
      }

      query += ` ORDER BY se.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
      params.push(parseInt(limit as string), parseInt(offset as string));

      const result = await pool.query(query, params);

      res.json({
        executions: result.rows,
        pagination: {
          limit: parseInt(limit as string),
          offset: parseInt(offset as string),
        },
      });
    } catch (error) {
      console.error("[Swarm API] Error listing executions:", error);
      res.status(500).json({
        error: "Failed to list executions",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  // GET /swarm/executions/:id - Get execution details
  router.get("/executions/:id", async (req: AuthenticatedRequest, res: Response) => {
    try {
      const executionResult = await pool.query(
        `SELECT se.*, sc.name as configuration_name, sc.openclaw_agent_ids
         FROM swarm_executions se
         LEFT JOIN swarm_configurations sc ON se.configuration_id = sc.id
         WHERE se.id = $1`,
        [req.params.id]
      );

      if (executionResult.rows.length === 0) {
        return res.status(404).json({ error: "Execution not found" });
      }

      const execution = executionResult.rows[0];

      // Get agent allocations
      const allocationsResult = await pool.query(
        `SELECT * FROM agent_allocations WHERE execution_id = $1 ORDER BY allocated_at`,
        [req.params.id]
      );

      res.json({
        execution,
        allocations: allocationsResult.rows,
      });
    } catch (error) {
      console.error("[Swarm API] Error getting execution:", error);
      res.status(500).json({
        error: "Failed to get execution",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  return router;
}
