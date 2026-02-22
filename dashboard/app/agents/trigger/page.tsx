"use client";

import { useEffect, useState } from "react";
import {
  Play,
  Check,
  X,
  Clock,
  AlertCircle,
  Bot,
  Plus,
  Layers,
  ChevronRight,
  Terminal,
  FileJson,
  Copy,
  CheckCircle2,
  Loader2,
} from "lucide-react";
import { Card, Button, Badge, Input, Textarea, Select, useToastHelpers } from "@/components/ui";
import api from "@/lib/api";

interface Agent {
  id: string;
  name: string;
  specialty: string;
  squad: string;
  status: string;
}

interface Trigger {
  id: string;
  agent_id: string;
  agent_name?: string;
  agent_specialty?: string;
  status: string;
  input_params: Record<string, any>;
  output_result: Record<string, any>;
  error_message?: string;
  started_at: string;
  completed_at: string;
  created_at: string;
}

interface TriggerResult {
  trigger: Trigger;
  agent: Agent;
  output_result?: any;
  error?: string;
}

export default function TriggerPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [triggers, setTriggers] = useState<Trigger[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAgents, setSelectedAgents] = useState<string[]>([]);
  const [inputParams, setInputParams] = useState("");
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<TriggerResult[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [filter, setFilter] = useState("all");
  const { success, error } = useToastHelpers();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [agentsRes, triggersRes] = await Promise.all([
        api.get("/agents"),
        api.get("/triggers"),
      ]);
      setAgents(agentsRes.data.agents || []);
      setTriggers(triggersRes.data.triggers || []);
    } catch (err) {
      console.error("Failed to fetch data:", err);
    } finally {
      setLoading(false);
    }
  };

  const toggleAgent = (agentId: string) => {
    setSelectedAgents((prev) =>
      prev.includes(agentId)
        ? prev.filter((id) => id !== agentId)
        : [...prev, agentId]
    );
  };

  const selectAll = () => {
    if (selectedAgents.length === agents.length) {
      setSelectedAgents([]);
    } else {
      setSelectedAgents(agents.map((a) => a.id));
    }
  };

  const runAgents = async () => {
    if (selectedAgents.length === 0) {
      error("Please select at least one agent");
      return;
    }

    setRunning(true);
    setResults([]);
    setShowResults(true);

    try {
      let parsedParams = {};
      if (inputParams.trim()) {
        try {
          parsedParams = JSON.parse(inputParams);
        } catch {
          error("Invalid JSON in input parameters");
          setRunning(false);
          return;
        }
      }

      const res = await api.post("/triggers/batch", {
        agent_ids: selectedAgents,
        input_params: parsedParams,
      });

      setResults(res.data.results || []);
      
      if (res.data.summary?.failed > 0) {
        error(`${res.data.summary.failed} agent(s) failed`);
      } else {
        success(`${res.data.summary?.succeeded || 0} agent(s) executed successfully`);
      }

      fetchData();
    } catch (err: any) {
      error(err.response?.data?.error || "Failed to run agents");
    } finally {
      setRunning(false);
    }
  };

  const runSingleAgent = async (agentId: string) => {
    setRunning(true);
    setResults([]);
    setSelectedAgents([agentId]);
    setShowResults(true);

    try {
      let parsedParams = {};
      if (inputParams.trim()) {
        try {
          parsedParams = JSON.parse(inputParams);
        } catch {
          error("Invalid JSON in input parameters");
          setRunning(false);
          return;
        }
      }

      const res = await api.post(`/triggers/${agentId}`, {
        input_params: parsedParams,
      });

      setResults([res.data]);
      success("Agent executed successfully");
      fetchData();
    } catch (err: any) {
      error(err.response?.data?.error || "Failed to run agent");
    } finally {
      setRunning(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "completed":
        return <CheckCircle2 className="w-4 h-4 text-green-400" />;
      case "failed":
        return <AlertCircle className="w-4 h-4 text-red-400" />;
      case "running":
        return <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />;
      default:
        return <Clock className="w-4 h-4 text-gray-400" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return <Badge variant="success" size="sm">Completed</Badge>;
      case "failed":
        return <Badge variant="error" size="sm">Failed</Badge>;
      case "running":
        return <Badge variant="primary" size="sm">Running</Badge>;
      default:
        return <Badge variant="default" size="sm">{status}</Badge>;
    }
  };

  const filteredTriggers = triggers.filter((t) => {
    if (filter === "all") return true;
    return t.status === filter;
  });

  const stats = {
    total: triggers.length,
    completed: triggers.filter((t) => t.status === "completed").length,
    failed: triggers.filter((t) => t.status === "failed").length,
    running: triggers.filter((t) => t.status === "running").length,
  };

  const squadColors: Record<string, string> = {
    engineering: "bg-blue-500/20 text-blue-400 border-blue-500/30",
    business: "bg-green-500/20 text-green-400 border-green-500/30",
    ops: "bg-purple-500/20 text-purple-400 border-purple-500/30",
    lead: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  };

  return (
    <div className="space-y-8 fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="page-title">Agent Trigger</h1>
          <p className="page-subtitle">
            Select and run agents manually
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Left Panel - Agent Selection */}
        <div className="space-y-6">
          {/* Stats */}
          {!loading && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[
                { label: "Total", value: stats.total, color: "text-white" },
                { label: "Completed", value: stats.completed, color: "text-green-400" },
                { label: "Failed", value: stats.failed, color: "text-red-400" },
                { label: "Running", value: stats.running, color: "text-blue-400" },
              ].map((stat) => (
                <Card key={stat.label} className="text-center py-3">
                  <p className={`text-xl font-bold ${stat.color}`}>{stat.value}</p>
                  <p className="text-xs text-gray-500">{stat.label}</p>
                </Card>
              ))}
            </div>
          )}

          {/* Agent Selection */}
          <Card>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                <Bot className="w-5 h-5 text-indigo-400" />
                Select Agents
              </h2>
              <Button
                size="sm"
                variant="ghost"
                onClick={selectAll}
              >
                {selectedAgents.length === agents.length ? "Deselect All" : "Select All"}
              </Button>
            </div>

            {loading ? (
              <div className="space-y-2">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="h-12 bg-gray-800/50 rounded-lg animate-pulse" />
                ))}
              </div>
            ) : (
              <div className="space-y-2 max-h-[400px] overflow-y-auto">
                {agents.map((agent) => {
                  const isSelected = selectedAgents.includes(agent.id);
                  return (
                    <button
                      key={agent.id}
                      onClick={() => toggleAgent(agent.id)}
                      className={`w-full flex items-center gap-3 p-3 rounded-lg border transition-all ${
                        isSelected
                          ? "bg-indigo-500/10 border-indigo-500/50"
                          : "bg-gray-800/30 border-gray-800 hover:border-gray-700"
                      }`}
                    >
                      <div className={`w-5 h-5 rounded flex items-center justify-center ${
                        isSelected ? "bg-indigo-500" : "border border-gray-600"
                      }`}>
                        {isSelected && <Check className="w-3 h-3 text-white" />}
                      </div>
                      <div className="flex-1 text-left">
                        <p className="text-sm font-medium text-white">{agent.name}</p>
                        <p className="text-xs text-gray-500">{agent.specialty}</p>
                      </div>
                      <Badge
                        variant="outline"
                        size="sm"
                        className={squadColors[agent.squad] || "bg-gray-800 text-gray-400"}
                      >
                        {agent.squad}
                      </Badge>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Selected Count */}
            <div className="mt-4 pt-4 border-t border-gray-800 flex items-center justify-between">
              <span className="text-sm text-gray-400">
                {selectedAgents.length} agent(s) selected
              </span>
              {selectedAgents.length > 0 && (
                <Button
                  size="sm"
                  variant="ghost"
                  leftIcon={<Terminal className="w-4 h-4" />}
                  onClick={() => setSelectedAgents([])}
                >
                  Clear
                </Button>
              )}
            </div>
          </Card>

          {/* Input Parameters */}
          <Card>
            <h2 className="text-lg font-semibold text-white flex items-center gap-2 mb-4">
              <FileJson className="w-5 h-5 text-indigo-400" />
              Input Parameters (Optional)
            </h2>
            <Textarea
              placeholder='{"key": "value"}'
              value={inputParams}
              onChange={(e) => setInputParams(e.target.value)}
              rows={5}
              className="font-mono text-sm"
            />
            <p className="text-xs text-gray-500 mt-2">
              Enter JSON parameters to pass to the agents
            </p>
          </Card>

          {/* Run Button */}
          <Button
            onClick={runAgents}
            disabled={selectedAgents.length === 0 || running}
            loading={running}
            leftIcon={<Play className="w-4 h-4" />}
            className="w-full"
            size="lg"
          >
            {running ? "Running Agents..." : `Run ${selectedAgents.length} Agent${selectedAgents.length !== 1 ? "s" : ""}`}
          </Button>
        </div>

        {/* Right Panel - Results & History */}
        <div className="space-y-6">
          {/* Results Panel */}
          {showResults && results.length > 0 && (
            <Card>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                  <Terminal className="w-5 h-5 text-green-400" />
                  Execution Results
                </h2>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setShowResults(false)}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>

              <div className="space-y-3">
                {results.map((result, index) => (
                  <div
                    key={index}
                    className="p-4 bg-gray-800/50 rounded-lg border border-gray-800"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Bot className="w-4 h-4 text-indigo-400" />
                        <span className="font-medium text-white">
                          {result.agent?.name || result.trigger?.agent_id}
                        </span>
                      </div>
                      {getStatusBadge(result.trigger?.status || result.error ? "failed" : "completed")}
                    </div>

                    {result.error ? (
                      <div className="text-sm text-red-400 bg-red-500/10 p-2 rounded">
                        {result.error}
                      </div>
                    ) : (
                      <pre className="text-xs text-gray-300 bg-gray-900 p-3 rounded-lg overflow-x-auto mt-2">
                        {JSON.stringify(result.trigger?.output_result || result.output_result || {}, null, 2)}
                      </pre>
                    )}
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Trigger History */}
          <Card>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                <Clock className="w-5 h-5 text-indigo-400" />
                Trigger History
              </h2>
            </div>

            {/* Filters */}
            <div className="flex gap-2 mb-4">
              {["all", "completed", "failed", "running"].map((status) => (
                <button
                  key={status}
                  onClick={() => setFilter(status)}
                  className={`px-3 py-1.5 text-xs rounded-lg transition-colors ${
                    filter === status
                      ? "bg-indigo-500 text-white"
                      : "bg-gray-800 text-gray-400 hover:text-white"
                  }`}
                >
                  {status === "all" ? "All" : status.charAt(0).toUpperCase() + status.slice(1)}
                </button>
              ))}
            </div>

            {loading ? (
              <div className="space-y-2">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="h-16 bg-gray-800/50 rounded-lg animate-pulse" />
                ))}
              </div>
            ) : filteredTriggers.length === 0 ? (
              <div className="text-center py-8">
                <Terminal className="w-10 h-10 text-gray-700 mx-auto mb-2" />
                <p className="text-sm text-gray-500">No triggers yet</p>
                <p className="text-xs text-gray-600">Run agents to see history</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-[500px] overflow-y-auto">
                {filteredTriggers.slice(0, 20).map((trigger) => (
                  <div
                    key={trigger.id}
                    className="flex items-center gap-3 p-3 bg-gray-800/30 rounded-lg hover:bg-gray-800/50 transition-colors"
                  >
                    <div className="w-8 h-8 rounded-full bg-gray-800 flex items-center justify-center">
                      {getStatusIcon(trigger.status)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white truncate">
                        {trigger.agent_name || trigger.agent_id}
                      </p>
                      <p className="text-xs text-gray-500">
                        {new Date(trigger.created_at).toLocaleString()}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {getStatusBadge(trigger.status)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
