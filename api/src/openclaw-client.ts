/**
 * OpenClaw Client
 * HTTP client to connect to OpenClaw Gateway API (port 18789)
 * Provides methods for agent management and swarm orchestration
 */

import axios, { AxiosInstance, AxiosError } from "axios";

const OPENCLAW_PORT = parseInt(process.env.OPENCLAW_PORT || "18789", 10);
const OPENCLAW_TOKEN = process.env.OPENCLAW_GATEWAY_TOKEN || process.env.OPENCLAW_TOKEN || "openclaw_dev_token_12345";
const OPENCLAW_HOST = process.env.OPENCLAW_HOST || process.env.OPENCLAW_GATEWAY_URL?.replace("http://", "").replace(":18789", "") || "localhost";

export interface OpenClawAgent {
  id: string;
  name: string;
  status: "running" | "idle" | "paused" | "stopped";
  model?: string;
  sessionId?: string;
  workspace?: string;
  createdAt?: string;
  lastActivity?: string;
}

export interface OpenClawSession {
  id: string;
  agentId: string;
  status: "active" | "completed" | "failed" | "cancelled";
  createdAt: string;
  completedAt?: string;
  messages?: number;
  tokens?: number;
}

export interface OpenClawSwarmStatus {
  id: string;
  name: string;
  status: "running" | "completed" | "failed" | "stopped";
  agents: OpenClawAgent[];
  config: Record<string, any>;
  createdAt: string;
  completedAt?: string;
}

export interface OpenClawHealthStatus {
  status: "healthy" | "degraded" | "unhealthy";
  version: string;
  uptime: number;
  activeAgents: number;
  activeSessions: number;
}

export interface OpenClawAgentConfig {
  id: string;
  name?: string;
  model?: string;
  workspace?: string;
  sandbox?: {
    mode?: "off" | "non-main" | "read-only";
    scope?: "agent" | "user";
    workspaceAccess?: "r" | "w" | "rw";
  };
  tools?: {
    allow?: string[];
    deny?: string[];
  };
}

export interface OpenClawCreateSessionRequest {
  agentId: string;
  prompt: string;
  context?: Record<string, any>;
  timeout?: number;
}

export interface OpenClawCreateSessionResponse {
  sessionId: string;
  agentId: string;
  status: "queued" | "started";
  message?: string;
}

export class OpenClawClient {
  private client: AxiosInstance;
  private token: string;

  constructor(host: string = OPENCLAW_HOST, port: number = OPENCLAW_PORT, token?: string) {
    this.token = token || OPENCLAW_TOKEN;
    this.client = axios.create({
      baseURL: `http://${host}:${port}`,
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${this.token}`,
      },
      timeout: 30000,
    });

    // Add response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => response,
      (error: AxiosError) => {
        if (error.response) {
          const { status, data } = error.response;
          console.error(`[OpenClaw API Error] ${status}:`, data);
          throw new Error(`OpenClaw API error: ${status} - ${JSON.stringify(data)}`);
        } else if (error.request) {
          console.error("[OpenClaw API Error] No response received:", error.message);
          throw new Error(`OpenClaw Gateway unreachable: ${error.message}`);
        }
        throw error;
      }
    );
  }

  /**
   * Health check - Verify OpenClaw Gateway is accessible
   */
  async healthCheck(): Promise<OpenClawHealthStatus> {
    const response = await this.client.get<OpenClawHealthStatus>("/health");
    return response.data;
  }

  /**
   * List all available agents
   */
  async listAgents(): Promise<OpenClawAgent[]> {
    const response = await this.client.get<{ agents: OpenClawAgent[] }>("/agents");
    return response.data.agents || [];
  }

  /**
   * Get a specific agent by ID
   */
  async getAgent(agentId: string): Promise<OpenClawAgent> {
    const response = await this.client.get<OpenClawAgent>(`/agents/${agentId}`);
    return response.data;
  }

  /**
   * Get agent configuration
   */
  async getAgentConfig(agentId: string): Promise<OpenClawAgentConfig> {
    const response = await this.client.get<OpenClawAgentConfig>(`/agents/${agentId}/config`);
    return response.data;
  }

  /**
   * Update agent configuration
   */
  async updateAgentConfig(agentId: string, config: Partial<OpenClawAgentConfig>): Promise<OpenClawAgent> {
    const response = await this.client.patch<OpenClawAgent>(`/agents/${agentId}/config`, config);
    return response.data;
  }

  /**
   * Start an agent (create a new session)
   */
  async startAgent(request: OpenClawCreateSessionRequest): Promise<OpenClawCreateSessionResponse> {
    const response = await this.client.post<OpenClawCreateSessionResponse>("/sessions", request);
    return response.data;
  }

  /**
   * Stop a running agent/session
   */
  async stopAgent(agentId: string, sessionId?: string): Promise<{ success: boolean; message: string }> {
    const endpoint = sessionId 
      ? `/sessions/${sessionId}/stop` 
      : `/agents/${agentId}/stop`;
    const response = await this.client.post<{ success: boolean; message: string }>(endpoint);
    return response.data;
  }

  /**
   * Get session status
   */
  async getSession(sessionId: string): Promise<OpenClawSession> {
    const response = await this.client.get<OpenClawSession>(`/sessions/${sessionId}`);
    return response.data;
  }

  /**
   * List all active sessions
   */
  async listSessions(agentId?: string): Promise<OpenClawSession[]> {
    const params = agentId ? { agentId } : {};
    const response = await this.client.get<{ sessions: OpenClawSession[] }>("/sessions", { params });
    return response.data.sessions || [];
  }

  /**
   * Send message to an agent session
   */
  async sendMessage(sessionId: string, message: string): Promise<{ response: string; sessionId: string }> {
    const response = await this.client.post<{ response: string; sessionId: string }>(`/sessions/${sessionId}/messages`, {
      message,
    });
    return response.data;
  }

  /**
   * Get agent logs
   */
  async getAgentLogs(agentId: string, limit: number = 100): Promise<{ logs: string[] }> {
    const response = await this.client.get<{ logs: string[] }>(`/agents/${agentId}/logs`, {
      params: { limit },
    });
    return response.data;
  }

  /**
   * Get session logs
   */
  async getSessionLogs(sessionId: string, limit: number = 100): Promise<{ logs: string[] }> {
    const response = await this.client.get<{ logs: string[] }>(`/sessions/${sessionId}/logs`, {
      params: { limit },
    });
    return response.data;
  }

  /**
   * Get system stats
   */
  async getStats(): Promise<{
    activeAgents: number;
    activeSessions: number;
    totalSessions: number;
    uptime: number;
  }> {
    const response = await this.client.get<{
      activeAgents: number;
      activeSessions: number;
      totalSessions: number;
      uptime: number;
    }>("/stats");
    return response.data;
  }

  /**
   * Create a swarm (group of agents working together)
   */
  async createSwarm(config: {
    name: string;
    agentIds: string[];
    prompt: string;
    coordinationMode?: "sequential" | "parallel" | "round-robin";
  }): Promise<{ swarmId: string; status: string }> {
    const response = await this.client.post<{ swarmId: string; status: string }>("/swarms", config);
    return response.data;
  }

  /**
   * Get swarm status
   */
  async getSwarm(swarmId: string): Promise<OpenClawSwarmStatus> {
    const response = await this.client.get<OpenClawSwarmStatus>(`/swarms/${swarmId}`);
    return response.data;
  }

  /**
   * List all swarms
   */
  async listSwarms(): Promise<OpenClawSwarmStatus[]> {
    const response = await this.client.get<{ swarms: OpenClawSwarmStatus[] }>("/swarms");
    return response.data.swarms || [];
  }

  /**
   * Terminate a swarm
   */
  async terminateSwarm(swarmId: string): Promise<{ success: boolean; message: string }> {
    const response = await this.client.delete<{ success: boolean; message: string }>(`/swarms/${swarmId}`);
    return response.data;
  }

  /**
   * Pause a swarm
   */
  async pauseSwarm(swarmId: string): Promise<{ success: boolean; message: string }> {
    const response = await this.client.post<{ success: boolean; message: string }>(`/swarms/${swarmId}/pause`);
    return response.data;
  }

  /**
   * Resume a paused swarm
   */
  async resumeSwarm(swarmId: string): Promise<{ success: boolean; message: string }> {
    const response = await this.client.post<{ success: boolean; message: string }>(`/swarms/${swarmId}/resume`);
    return response.data;
  }
}

// Singleton instance for reuse
let openClawClient: OpenClawClient | null = null;

/**
 * Get or create OpenClaw client instance
 */
export function getOpenClawClient(): OpenClawClient {
  if (!openClawClient) {
    openClawClient = new OpenClawClient();
  }
  return openClawClient;
}

/**
 * Create a new OpenClaw client with custom configuration
 */
export function createOpenClawClient(host?: string, port?: number, token?: string): OpenClawClient {
  return new OpenClawClient(host, port, token);
}

export default OpenClawClient;
