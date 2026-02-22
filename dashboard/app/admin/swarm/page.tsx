"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Bot,
  Play,
  Pause,
  Square,
  Download,
  FileSpreadsheet,
  FileText,
  X,
  ExternalLink,
  Plus,
  Search,
  Filter,
  RefreshCw,
  Terminal,
  Trash2,
  MoreHorizontal,
  CheckCircle,
  XCircle,
  Loader2,
  Activity,
  Clock,
  Users,
  Zap,
  AlertCircle,
  ChevronDown,
  ChevronRight,
  Server,
  Globe,
  Cpu,
} from "lucide-react";
import { Breadcrumb, useBreadcrumbs } from "@/components/Breadcrumb";

// ============================================
// TYPES
// ============================================

type AgentStatus = "running" | "completed" | "failed" | "idle" | "queued";

interface OpenClawAgent {
  id: string;
  name: string;
  status: AgentStatus;
  model?: string;
  sessionId?: string;
  workspace?: string;
}

interface Agent {
  id: string;
  name: string;
  status: AgentStatus;
  progress: number;
  target?: string;
  result?: string;
  startedAt?: string;
  completedAt?: string;
  error?: string;
  niche?: string;
}

interface SwarmStats {
  totalAgents: number;
  running: number;
  completed: number;
  failed: number;
  idle: number;
  queued: number;
  totalProgress: number;
  estimatedTimeRemaining?: number;
}

type SwarmStatus = "running" | "paused" | "completed" | "failed" | "stopped" | "pending";

interface Swarm {
  id: string;
  name: string;
  description: string;
  status: SwarmStatus;
  niches: string[];
  creatorsPerNiche: number;
  concurrency: number;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  stats: SwarmStats;
  agents: Agent[];
  openclawSwarmId?: string;
  configurationId?: string;
}

interface SwarmConfiguration {
  id: string;
  name: string;
  description: string;
  openclawAgentIds: string[];
  coordinationMode: string;
  maxConcurrent: number;
  timeoutSeconds: number;
  retryAttempts: number;
  isPublic: boolean;
  createdAt: string;
}

interface SwarmExecution {
  id: string;
  configurationId: string;
  configurationName?: string;
  openclawSwarmId?: string;
  name: string;
  description?: string;
  status: SwarmStatus;
  totalAgents: number;
  runningAgents: number;
  completedAgents: number;
  failedAgents: number;
  progressPercent: number;
  startedAt?: string;
  completedAt?: string;
  createdAt: string;
}

interface CreatorResult {
  id: string;
  agentId: string;
  channelName: string;
  subscriberCount: string;
  videoCount: number;
  category: string;
  email?: string;
  socialLinks: {
    twitter?: string;
    instagram?: string;
    website?: string;
  };
  location: string;
  status: "completed" | "failed" | "pending";
  collectedAt?: string;
}

interface SwarmLog {
  timestamp: string;
  level: "info" | "warn" | "error" | "success";
  message: string;
  agentId?: string;
}

interface OpenClawStats {
  activeAgents: number;
  activeSessions: number;
  totalSessions: number;
  uptime: number;
}

interface OpenClawHealth {
  status: "healthy" | "degraded" | "unhealthy";
  version: string;
  uptime: number;
  activeAgents: number;
  activeSessions: number;
}

// ============================================
// CONSTANTS
// ============================================

const STATUS_COLORS: Record<AgentStatus, { bg: string; text: string; border: string; icon: React.ElementType }> = {
  running: { bg: "bg-blue-900/30", text: "text-blue-400", border: "border-blue-500/50", icon: Loader2 },
  completed: { bg: "bg-green-900/30", text: "text-green-400", border: "border-green-500/50", icon: CheckCircle },
  failed: { bg: "bg-red-900/30", text: "text-red-400", border: "border-red-500/50", icon: XCircle },
  idle: { bg: "bg-gray-800/50", text: "text-gray-500", border: "border-gray-700", icon: Clock },
  queued: { bg: "bg-amber-900/30", text: "text-amber-400", border: "border-amber-500/50", icon: Clock },
};

const SWARM_STATUS_COLORS: Record<SwarmStatus, string> = {
  running: "bg-blue-600",
  paused: "bg-amber-600",
  completed: "bg-green-600",
  failed: "bg-red-600",
  stopped: "bg-gray-600",
  pending: "bg-purple-600",
};

// ============================================
// UTILITY FUNCTIONS
// ============================================

const formatTime = (seconds: number): string => {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  return `${hrs.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
};

const formatDuration = (start: string, end?: string): string => {
  const startTime = new Date(start).getTime();
  const endTime = end ? new Date(end).getTime() : Date.now();
  const seconds = Math.floor((endTime - startTime) / 1000);
  return formatTime(seconds);
};

const calculateStats = (agents: Agent[]): SwarmStats => {
  const running = agents.filter(a => a.status === "running").length;
  const completed = agents.filter(a => a.status === "completed").length;
  const failed = agents.filter(a => a.status === "failed").length;
  const idle = agents.filter(a => a.status === "idle").length;
  const queued = agents.filter(a => a.status === "queued").length;
  const totalProgress = agents.length > 0 ? (completed / agents.length) * 100 : 0;
  
  return {
    totalAgents: agents.length,
    running,
    completed,
    failed,
    idle,
    queued,
    totalProgress,
  };
};

// ============================================
// MAIN COMPONENT
// ============================================

export default function SwarmControlPage() {
  // State
  const [swarms, setSwarms] = useState<Swarm[]>([]);
  const [executions, setExecutions] = useState<SwarmExecution[]>([]);
  const [configurations, setConfigurations] = useState<SwarmConfiguration[]>([]);
  const [openclawAgents, setOpenclawAgents] = useState<OpenClawAgent[]>([]);
  const [openclawStats, setOpenclawStats] = useState<OpenClawStats | null>(null);
  const [openclawHealth, setOpenclawHealth] = useState<OpenClawHealth | null>(null);
  const [activeSwarmId, setActiveSwarmId] = useState<string | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isResultsModalOpen, setIsResultsModalOpen] = useState(false);
  const [isLogsModalOpen, setIsLogsModalOpen] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [logs, setLogs] = useState<SwarmLog[]>([]);
  const [results, setResults] = useState<CreatorResult[]>([]);
  const [resultsPage, setResultsPage] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const breadcrumbs = useBreadcrumbs();
  const [expandedSwarmId, setExpandedSwarmId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"executions" | "configurations" | "openclaw">("executions");
  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  
  // Form state
  const [swarmName, setSwarmName] = useState("");
  const [swarmDescription, setSwarmDescription] = useState("");
  const [selectedAgentIds, setSelectedAgentIds] = useState<string[]>([]);
  const [swarmPrompt, setSwarmPrompt] = useState("");
  const [coordinationMode, setCoordinationMode] = useState<"parallel" | "sequential" | "round-robin">("parallel");
  
  const resultsPerPage = 20;
  const activeSwarm = swarms.find(s => s.id === activeSwarmId);

  // ============================================
  // API FUNCTIONS
  // ============================================

  const fetchOpenClawHealth = useCallback(async () => {
    try {
      const response = await fetch("/api/swarm/openclaw/health");
      if (response.ok) {
        const data = await response.json();
        setOpenclawHealth(data);
      } else {
        setOpenclawHealth(null);
      }
    } catch {
      setOpenclawHealth(null);
    }
  }, []);

  const fetchOpenClawAgents = useCallback(async () => {
    try {
      const response = await fetch("/api/swarm/openclaw/agents");
      if (response.ok) {
        const data = await response.json();
        setOpenclawAgents(data.agents || []);
      }
    } catch (error) {
      console.error("Failed to fetch OpenClaw agents:", error);
    }
  }, []);

  const fetchOpenClawStats = useCallback(async () => {
    try {
      const response = await fetch("/api/swarm/openclaw/stats");
      if (response.ok) {
        const data = await response.json();
        setOpenclawStats(data);
      }
    } catch (error) {
      console.error("Failed to fetch OpenClaw stats:", error);
    }
  }, []);

  const fetchExecutions = useCallback(async () => {
    try {
      const response = await fetch("/api/swarm/executions");
      if (response.ok) {
        const data = await response.json();
        setExecutions(data.executions || []);
      }
    } catch (error) {
      console.error("Failed to fetch executions:", error);
    }
  }, []);

  const fetchConfigurations = useCallback(async () => {
    try {
      const response = await fetch("/api/swarm/configurations");
      if (response.ok) {
        const data = await response.json();
        setConfigurations(data.configurations || []);
      }
    } catch (error) {
      console.error("Failed to fetch configurations:", error);
    }
  }, []);

  const fetchOpenClawSwarms = useCallback(async () => {
    try {
      const response = await fetch("/api/swarm/openclaw/swarms");
      if (response.ok) {
        const data = await response.json();
        // Convert OpenClaw swarms to local format
        const convertedSwarms: Swarm[] = (data.swarms || []).map((s: any) => ({
          id: s.id,
          name: s.name,
          description: s.config?.description || "",
          status: s.status,
          niches: [],
          creatorsPerNiche: s.agents?.length || 0,
          concurrency: s.agents?.length || 0,
          createdAt: s.createdAt,
          completedAt: s.completedAt,
          stats: calculateStats(s.agents || []),
          agents: (s.agents || []).map((a: any, i: number) => ({
            id: a.id || `agent-${i}`,
            name: a.name || `Agent ${i + 1}`,
            status: a.status || "idle",
            progress: 0,
          })),
          openclawSwarmId: s.id,
        }));
        setSwarms(convertedSwarms);
      }
    } catch (error) {
      console.error("Failed to fetch OpenClaw swarms:", error);
    }
  }, []);

  const fetchAll = useCallback(async () => {
    setIsLoading(true);
    try {
      await Promise.all([
        fetchOpenClawHealth(),
        fetchOpenClawAgents(),
        fetchOpenClawStats(),
        fetchExecutions(),
        fetchConfigurations(),
        fetchOpenClawSwarms(),
      ]);
    } finally {
      setIsLoading(false);
    }
  }, [fetchOpenClawHealth, fetchOpenClawAgents, fetchOpenClawStats, fetchExecutions, fetchConfigurations, fetchOpenClawSwarms]);

  useEffect(() => {
    fetchAll();
    
    // Poll for updates every 5 seconds
    pollingRef.current = setInterval(() => {
      fetchOpenClawHealth();
      fetchOpenClawStats();
      fetchExecutions();
      fetchOpenClawSwarms();
    }, 5000);

    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
      }
    };
  }, [fetchAll, fetchOpenClawHealth, fetchOpenClawStats, fetchExecutions, fetchOpenClawSwarms]);

  // ============================================
  // HANDLERS
  // ============================================

  const handleCreateSwarm = async () => {
    if (!swarmName || selectedAgentIds.length === 0 || !swarmPrompt) return;
    
    setIsLoading(true);
    try {
      const response = await fetch("/api/swarm/openclaw/swarms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: swarmName,
          description: swarmDescription,
          agentIds: selectedAgentIds,
          prompt: swarmPrompt,
          coordinationMode,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        
        // Refresh data
        await fetchOpenClawSwarms();
        await fetchExecutions();
        
        // Reset form
        setSwarmName("");
        setSwarmDescription("");
        setSelectedAgentIds([]);
        setSwarmPrompt("");
        setCoordinationMode("parallel");
        setIsCreateModalOpen(false);
      } else {
        const error = await response.json();
        alert(`Failed to create swarm: ${error.message}`);
      }
    } catch (error) {
      console.error("Failed to create swarm:", error);
      alert("Failed to create swarm");
    } finally {
      setIsLoading(false);
    }
  };

  const handleTerminateSwarm = async (swarmId: string) => {
    if (!confirm("Are you sure you want to terminate this swarm?")) return;
    
    setIsLoading(true);
    try {
      const response = await fetch(`/api/swarm/openclaw/swarms/${swarmId}`, {
        method: "DELETE",
      });

      if (response.ok) {
        await fetchOpenClawSwarms();
        await fetchExecutions();
      }
    } catch (error) {
      console.error("Failed to terminate swarm:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePauseSwarm = async (swarmId: string) => {
    try {
      await fetch(`/api/swarm/openclaw/swarms/${swarmId}/pause`, { method: "POST" });
      await fetchOpenClawSwarms();
    } catch (error) {
      console.error("Failed to pause swarm:", error);
    }
  };

  const handleResumeSwarm = async (swarmId: string) => {
    try {
      await fetch(`/api/swarm/openclaw/swarms/${swarmId}/resume`, { method: "POST" });
      await fetchOpenClawSwarms();
    } catch (error) {
      console.error("Failed to resume swarm:", error);
    }
  };

  const handleStartAgent = async (agentId: string, prompt: string) => {
    try {
      const response = await fetch(`/api/swarm/openclaw/agents/${agentId}/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });

      if (response.ok) {
        await fetchOpenClawAgents();
        await fetchOpenClawStats();
      }
    } catch (error) {
      console.error("Failed to start agent:", error);
    }
  };

  const handleStopAgent = async (agentId: string) => {
    try {
      await fetch(`/api/swarm/openclaw/agents/${agentId}/stop`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      await fetchOpenClawAgents();
      await fetchOpenClawStats();
    } catch (error) {
      console.error("Failed to stop agent:", error);
    }
  };

  // ============================================
  // FILTERED DATA
  // ============================================

  const paginatedResults = results.slice(
    (resultsPage - 1) * resultsPerPage,
    resultsPage * resultsPerPage
  );
  const totalResultPages = Math.ceil(results.length / resultsPerPage);

  // ============================================
  // RENDER
  // ============================================

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <Breadcrumb items={breadcrumbs} />
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <Bot className="w-8 h-8 text-purple-500" />
            Swarm Control
          </h1>
          <p className="text-gray-400 mt-1">
            Manage OpenClaw agent swarms and monitor execution
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={fetchAll}
            className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg text-sm font-medium transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
            Refresh
          </button>
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition-colors"
          >
            <Plus className="w-4 h-4" />
            Create Swarm
          </button>
        </div>
      </div>

      {/* OpenClaw Status Card */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <Server className="w-5 h-5 text-indigo-500" />
            OpenClaw Gateway
          </h2>
          <div className="flex items-center gap-2">
            {openclawHealth ? (
              <>
                <span className={`w-3 h-3 rounded-full ${
                  openclawHealth.status === "healthy" ? "bg-green-500" :
                  openclawHealth.status === "degraded" ? "bg-amber-500" : "bg-red-500"
                }`} />
                <span className="text-sm text-gray-400 capitalize">{openclawHealth.status}</span>
              </>
            ) : (
              <>
                <span className="w-3 h-3 rounded-full bg-red-500" />
                <span className="text-sm text-gray-400">Offline</span>
              </>
            )}
          </div>
        </div>
        
        {openclawHealth && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-gray-800/50 rounded-lg p-3">
              <p className="text-xs text-gray-400">Version</p>
              <p className="text-sm text-white font-mono">{openclawHealth.version}</p>
            </div>
            <div className="bg-gray-800/50 rounded-lg p-3">
              <p className="text-xs text-gray-400">Active Agents</p>
              <p className="text-sm text-white">{openclawHealth.activeAgents}</p>
            </div>
            <div className="bg-gray-800/50 rounded-lg p-3">
              <p className="text-xs text-gray-400">Active Sessions</p>
              <p className="text-sm text-white">{openclawHealth.activeSessions}</p>
            </div>
            <div className="bg-gray-800/50 rounded-lg p-3">
              <p className="text-xs text-gray-400">Uptime</p>
              <p className="text-sm text-white">{formatTime(Math.floor(openclawHealth.uptime / 1000))}</p>
            </div>
          </div>
        )}

        {!openclawHealth && (
          <div className="text-center py-8">
            <AlertCircle className="w-12 h-12 text-gray-600 mx-auto mb-4" />
            <p className="text-gray-400 mb-2">OpenClaw Gateway is not reachable</p>
            <p className="text-sm text-gray-500">Make sure OpenClaw is running on port 18789</p>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-gray-800">
        <button
          onClick={() => setActiveTab("executions")}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "executions"
              ? "border-indigo-500 text-indigo-400"
              : "border-transparent text-gray-400 hover:text-white"
          }`}
        >
          <Activity className="w-4 h-4 inline mr-2" />
          Running Swarms
        </button>
        <button
          onClick={() => setActiveTab("configurations")}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "configurations"
              ? "border-indigo-500 text-indigo-400"
              : "border-transparent text-gray-400 hover:text-white"
          }`}
        >
          <Cpu className="w-4 h-4 inline mr-2" />
          Configurations
        </button>
        <button
          onClick={() => setActiveTab("openclaw")}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "openclaw"
              ? "border-indigo-500 text-indigo-400"
              : "border-transparent text-gray-400 hover:text-white"
          }`}
        >
          <Users className="w-4 h-4 inline mr-2" />
          OpenClaw Agents
        </button>
      </div>

      {/* Executions Tab */}
      {activeTab === "executions" && (
        <div className="space-y-4">
          <div className="card">
            <h3 className="text-lg font-semibold text-white mb-4">Running Swarms</h3>
            
            {executions.length === 0 && swarms.length === 0 ? (
              <div className="text-center py-12 border-2 border-dashed border-gray-800 rounded-lg">
                <Bot className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                <p className="text-gray-400 mb-2">No swarms running</p>
                <p className="text-sm text-gray-500">Create a new swarm to get started</p>
              </div>
            ) : (
              <div className="space-y-3">
                {/* Show executions from database */}
                {executions.map((execution) => (
                  <div key={execution.id} className="border border-gray-800 rounded-lg p-4 bg-gray-900/50">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="font-semibold text-white">{execution.name}</h4>
                            <span className={`badge ${SWARM_STATUS_COLORS[execution.status]} text-white text-xs`}>
                              {execution.status}
                            </span>
                          </div>
                          <p className="text-sm text-gray-400">
                            {execution.configurationName || "Custom swarm"}
                          </p>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <p className="text-sm text-gray-400">
                            {execution.completedAgents}/{execution.totalAgents} completed
                          </p>
                          <p className="text-lg font-semibold text-white">
                            {execution.progressPercent}%
                          </p>
                        </div>
                        
                        <div className="flex gap-2">
                          {execution.status === "running" && (
                            <button
                              onClick={() => execution.openclawSwarmId && handlePauseSwarm(execution.openclawSwarmId)}
                              className="p-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg"
                              title="Pause"
                            >
                              <Pause className="w-4 h-4" />
                            </button>
                          )}
                          {execution.status === "paused" && (
                            <button
                              onClick={() => execution.openclawSwarmId && handleResumeSwarm(execution.openclawSwarmId)}
                              className="p-2 bg-green-600 hover:bg-green-700 text-white rounded-lg"
                              title="Resume"
                            >
                              <Play className="w-4 h-4" />
                            </button>
                          )}
                          {(execution.status === "running" || execution.status === "paused") && (
                            <button
                              onClick={() => execution.openclawSwarmId && handleTerminateSwarm(execution.openclawSwarmId)}
                              className="p-2 bg-red-600 hover:bg-red-700 text-white rounded-lg"
                              title="Terminate"
                            >
                              <Square className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    <div className="mt-4">
                      <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all"
                          style={{ width: `${execution.progressPercent}%` }}
                        />
                      </div>
                    </div>
                  </div>
                ))}

                {/* Show OpenClaw swarms */}
                {swarms.filter(s => !executions.find(e => e.openclawSwarmId === s.openclawSwarmId)).map((swarm) => (
                  <div key={swarm.id} className="border border-gray-800 rounded-lg p-4 bg-gray-900/50">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="font-semibold text-white">{swarm.name}</h4>
                            <span className={`badge ${SWARM_STATUS_COLORS[swarm.status]} text-white text-xs`}>
                              {swarm.status}
                            </span>
                          </div>
                          <p className="text-sm text-gray-400">
                            {swarm.stats.totalAgents} agents
                          </p>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <p className="text-sm text-gray-400">
                            {swarm.stats.completed}/{swarm.stats.totalAgents} completed
                          </p>
                          <p className="text-lg font-semibold text-white">
                            {swarm.stats.totalProgress.toFixed(0)}%
                          </p>
                        </div>
                        
                        <div className="flex gap-2">
                          {swarm.status === "running" && swarm.openclawSwarmId && (
                            <>
                              <button
                                onClick={() => handlePauseSwarm(swarm.openclawSwarmId || "")}
                                className="p-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg"
                                title="Pause"
                              >
                                <Pause className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleTerminateSwarm(swarm.openclawSwarmId || "")}
                                className="p-2 bg-red-600 hover:bg-red-700 text-white rounded-lg"
                                title="Terminate"
                              >
                                <Square className="w-4 h-4" />
                              </button>
                            </>
                          )}
                          {swarm.status === "paused" && swarm.openclawSwarmId && (
                            <>
                              <button
                                onClick={() => handleResumeSwarm(swarm.openclawSwarmId || "")}
                                className="p-2 bg-green-600 hover:bg-green-700 text-white rounded-lg"
                                title="Resume"
                              >
                                <Play className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleTerminateSwarm(swarm.openclawSwarmId || "")}
                                className="p-2 bg-red-600 hover:bg-red-700 text-white rounded-lg"
                                title="Terminate"
                              >
                                <Square className="w-4 h-4" />
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Configurations Tab */}
      {activeTab === "configurations" && (
        <div className="space-y-4">
          <div className="card">
            <h3 className="text-lg font-semibold text-white mb-4">Swarm Configurations</h3>
            
            {configurations.length === 0 ? (
              <div className="text-center py-12 border-2 border-dashed border-gray-800 rounded-lg">
                <Cpu className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                <p className="text-gray-400 mb-2">No configurations saved</p>
                <p className="text-sm text-gray-500">Create a swarm to save its configuration</p>
              </div>
            ) : (
              <div className="space-y-3">
                {configurations.map((config) => (
                  <div key={config.id} className="border border-gray-800 rounded-lg p-4 bg-gray-900/50">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-semibold text-white">{config.name}</h4>
                        <p className="text-sm text-gray-400">{config.description || "No description"}</p>
                        <div className="flex gap-2 mt-2">
                          {config.openclawAgentIds.slice(0, 3).map((id) => (
                            <span key={id} className="badge bg-gray-800 text-gray-400 text-xs">
                              {id}
                            </span>
                          ))}
                          {config.openclawAgentIds.length > 3 && (
                            <span className="badge bg-gray-800 text-gray-400 text-xs">
                              +{config.openclawAgentIds.length - 3} more
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <p className="text-sm text-gray-400">Mode</p>
                          <p className="text-sm text-white capitalize">{config.coordinationMode}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm text-gray-400">Max Agents</p>
                          <p className="text-sm text-white">{config.maxConcurrent}</p>
                        </div>
                        {config.isPublic && (
                          <span className="badge bg-green-900/50 text-green-400 text-xs">Public</span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* OpenClaw Agents Tab */}
      {activeTab === "openclaw" && (
        <div className="space-y-4">
          <div className="card">
            <h3 className="text-lg font-semibold text-white mb-4">Available Agents</h3>
            
            {openclawAgents.length === 0 ? (
              <div className="text-center py-12 border-2 border-dashed border-gray-800 rounded-lg">
                <Users className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                <p className="text-gray-400 mb-2">No OpenClaw agents found</p>
                <p className="text-sm text-gray-500">Check if OpenClaw Gateway is running</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {openclawAgents.map((agent) => (
                  <div key={agent.id} className="border border-gray-800 rounded-lg p-4 bg-gray-900/50">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <Bot className="w-5 h-5 text-indigo-500" />
                        <h4 className="font-semibold text-white">{agent.name}</h4>
                      </div>
                      <span className={`badge ${
                        agent.status === "running" ? "bg-green-900/50 text-green-400" :
                        agent.status === "idle" ? "bg-gray-800 text-gray-400" :
                        "bg-amber-900/50 text-amber-400"
                      } text-xs`}>
                        {agent.status}
                      </span>
                    </div>
                    <div className="text-sm text-gray-400 mb-3">
                      <p>ID: {agent.id}</p>
                      {agent.model && <p>Model: {agent.model}</p>}
                      {agent.workspace && <p className="truncate">Workspace: {agent.workspace}</p>}
                    </div>
                    <div className="flex gap-2">
                      {agent.status === "idle" ? (
                        <button
                          onClick={() => handleStartAgent(agent.id, "Hello, please introduce yourself.")}
                          className="flex-1 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded text-sm"
                        >
                          Start
                        </button>
                      ) : agent.status === "running" ? (
                        <button
                          onClick={() => handleStopAgent(agent.id)}
                          className="flex-1 px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded text-sm"
                        >
                          Stop
                        </button>
                      ) : null}
                      <button
                        className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded text-sm"
                      >
                        Logs
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Create Swarm Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70">
          <div className="bg-gray-900 border border-gray-800 rounded-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-6 border-b border-gray-800">
              <div>
                <h2 className="text-xl font-semibold text-white flex items-center gap-2">
                  <Plus className="w-5 h-5 text-indigo-500" />
                  Create New Swarm
                </h2>
                <p className="text-sm text-gray-400 mt-1">
                  Configure a new OpenClaw agent swarm
                </p>
              </div>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            <div className="flex-1 overflow-auto p-6 space-y-6">
              {/* Swarm Name */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Swarm Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={swarmName}
                  onChange={(e) => setSwarmName(e.target.value)}
                  placeholder="e.g., Research Swarm"
                  className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Description
                </label>
                <textarea
                  value={swarmDescription}
                  onChange={(e) => setSwarmDescription(e.target.value)}
                  placeholder="Describe the purpose of this swarm..."
                  rows={2}
                  className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                />
              </div>

              {/* Prompt */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Task Prompt <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={swarmPrompt}
                  onChange={(e) => setSwarmPrompt(e.target.value)}
                  placeholder="Enter the task description for the swarm..."
                  rows={4}
                  className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                />
              </div>

              {/* Agent Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Select Agents <span className="text-red-500">*</span>
                  <span className="text-gray-500 ml-2">({selectedAgentIds.length} selected)</span>
                </label>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2 max-h-48 overflow-y-auto p-2 bg-gray-800/50 rounded-lg border border-gray-700">
                  {openclawAgents.map((agent) => (
                    <label
                      key={agent.id}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-colors ${
                        selectedAgentIds.includes(agent.id)
                          ? "bg-indigo-900/50 border border-indigo-500"
                          : "hover:bg-gray-700"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={selectedAgentIds.includes(agent.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedAgentIds([...selectedAgentIds, agent.id]);
                          } else {
                            setSelectedAgentIds(selectedAgentIds.filter(id => id !== agent.id));
                          }
                        }}
                        className="w-4 h-4 rounded border-gray-600 bg-gray-900 text-indigo-600 focus:ring-indigo-500"
                      />
                      <span className="text-sm text-gray-300 truncate">{agent.name}</span>
                    </label>
                  ))}
                  {openclawAgents.length === 0 && (
                    <p className="col-span-full text-center text-gray-500 py-4">
                      No agents available. Check OpenClaw connection.
                    </p>
                  )}
                </div>
              </div>

              {/* Coordination Mode */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Coordination Mode
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(["parallel", "sequential", "round-robin"] as const).map((mode) => (
                    <button
                      key={mode}
                      onClick={() => setCoordinationMode(mode)}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                        coordinationMode === mode
                          ? "bg-indigo-600 text-white"
                          : "bg-gray-800 text-gray-400 hover:bg-gray-700"
                      }`}
                    >
                      {mode.charAt(0).toUpperCase() + mode.slice(1).replace("-", " ")}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between p-6 border-t border-gray-800">
              <div className="text-sm text-gray-400">
                {selectedAgentIds.length > 0 && (
                  <span>
                    Will create swarm with <strong className="text-white">{selectedAgentIds.length}</strong> agents
                  </span>
                )}
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg text-sm font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateSwarm}
                  disabled={!swarmName || selectedAgentIds.length === 0 || !swarmPrompt || isLoading}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    <>
                      <Plus className="w-4 h-4" />
                      Create Swarm
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Logs Modal */}
      {isLogsModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70">
          <div className="bg-gray-900 border border-gray-800 rounded-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-6 border-b border-gray-800">
              <div>
                <h2 className="text-xl font-semibold text-white flex items-center gap-2">
                  <Terminal className="w-5 h-5 text-indigo-500" />
                  Swarm Logs
                </h2>
                <p className="text-sm text-gray-400 mt-1">
                  Real-time log output from agent operations
                </p>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setLogs([])}
                  className="px-3 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg text-sm transition-colors"
                >
                  Clear
                </button>
                <button
                  onClick={() => setIsLogsModalOpen(false)}
                  className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-gray-400" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-auto p-6 bg-gray-950 font-mono text-sm">
              {logs.length === 0 ? (
                <p className="text-gray-500 text-center py-8">No logs yet...</p>
              ) : (
                <div className="space-y-2">
                  {logs.map((log, index) => (
                    <div key={index} className="flex gap-3">
                      <span className="text-gray-500 shrink-0">
                        {new Date(log.timestamp).toLocaleTimeString()}
                      </span>
                      <span
                        className={`shrink-0 w-16 text-center text-xs px-1.5 py-0.5 rounded ${
                          log.level === "error"
                            ? "bg-red-900/50 text-red-400"
                            : log.level === "warn"
                            ? "bg-amber-900/50 text-amber-400"
                            : log.level === "success"
                            ? "bg-green-900/50 text-green-400"
                            : "bg-blue-900/50 text-blue-400"
                        }`}
                      >
                        {log.level.toUpperCase()}
                      </span>
                      {log.agentId && (
                        <span className="text-purple-400 shrink-0">[{log.agentId}]</span>
                      )}
                      <span className="text-gray-300">{log.message}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Results Modal */}
      {isResultsModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70">
          <div className="bg-gray-900 border border-gray-800 rounded-xl w-full max-w-6xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-6 border-b border-gray-800">
              <div>
                <h2 className="text-xl font-semibold text-white flex items-center gap-2">
                  <FileText className="w-5 h-5 text-indigo-500" />
                  Results
                </h2>
              </div>
              <button
                onClick={() => setIsResultsModalOpen(false)}
                className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>
            <div className="flex-1 overflow-auto p-6">
              <p className="text-gray-500 text-center py-8">Results will appear here</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
