"use client";

import { useEffect, useState } from "react";
import {
  Play,
  Pause,
  CheckCircle,
  XCircle,
  Loader2,
  Activity,
  Zap,
  Clock,
  Users,
} from "lucide-react";

export interface Agent {
  id: string;
  name: string;
  status: "running" | "completed" | "failed" | "idle" | "queued";
  progress: number;
  target?: string;
  result?: string;
  startedAt?: string;
  completedAt?: string;
  error?: string;
}

export interface SwarmStats {
  totalAgents: number;
  running: number;
  completed: number;
  failed: number;
  idle: number;
  queued: number;
  totalProgress: number;
  estimatedTimeRemaining?: number;
}

interface SwarmMonitorProps {
  agents: Agent[];
  stats: SwarmStats;
  isRunning: boolean;
  onStart: () => void;
  onPause: () => void;
  onAgentClick?: (agent: Agent) => void;
}

const statusColors: Record<string, { bg: string; text: string; icon: React.ElementType }> = {
  running: { bg: "bg-blue-900/50", text: "text-blue-400", icon: Loader2 },
  completed: { bg: "bg-green-900/50", text: "text-green-400", icon: CheckCircle },
  failed: { bg: "bg-red-900/50", text: "text-red-400", icon: XCircle },
  idle: { bg: "bg-gray-800", text: "text-gray-500", icon: Clock },
  queued: { bg: "bg-amber-900/50", text: "text-amber-400", icon: Clock },
};

export default function SwarmMonitor({
  agents,
  stats,
  isRunning,
  onStart,
  onPause,
  onAgentClick,
}: SwarmMonitorProps) {
  const [timeElapsed, setTimeElapsed] = useState(0);

  useEffect(() => {
    if (!isRunning) return;
    const interval = setInterval(() => {
      setTimeElapsed((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [isRunning]);

  const formatTime = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hrs.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div className="space-y-6">
      {/* Stats Overview */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        <StatCard
          label="Total Agents"
          value={stats.totalAgents}
          icon={Users}
          color="bg-indigo-600"
        />
        <StatCard
          label="Running"
          value={stats.running}
          icon={Activity}
          color="bg-blue-600"
        />
        <StatCard
          label="Completed"
          value={stats.completed}
          icon={CheckCircle}
          color="bg-green-600"
        />
        <StatCard
          label="Failed"
          value={stats.failed}
          icon={XCircle}
          color="bg-red-600"
        />
        <StatCard
          label="Queued"
          value={stats.queued}
          icon={Clock}
          color="bg-amber-600"
        />
        <StatCard
          label="Progress"
          value={`${stats.totalProgress.toFixed(1)}%`}
          icon={Zap}
          color="bg-purple-600"
        />
      </div>

      {/* Progress Bar */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-white">Swarm Progress</h3>
            <p className="text-sm text-gray-400">
              {stats.completed} of {stats.totalAgents} agents completed
            </p>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-sm text-gray-400">Time Elapsed</p>
              <p className="text-lg font-mono text-white">{formatTime(timeElapsed)}</p>
            </div>
            {stats.estimatedTimeRemaining && (
              <div className="text-right">
                <p className="text-sm text-gray-400">Est. Remaining</p>
                <p className="text-lg font-mono text-white">
                  {formatTime(stats.estimatedTimeRemaining)}
                </p>
              </div>
            )}
            <button
              onClick={isRunning ? onPause : onStart}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
                isRunning
                  ? "bg-amber-600 hover:bg-amber-700 text-white"
                  : "bg-green-600 hover:bg-green-700 text-white"
              }`}
            >
              {isRunning ? (
                <>
                  <Pause className="w-4 h-4" />
                  Pause
                </>
              ) : (
                <>
                  <Play className="w-4 h-4" />
                  Start
                </>
              )}
            </button>
          </div>
        </div>
        <div className="h-4 bg-gray-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 transition-all duration-500"
            style={{ width: `${stats.totalProgress}%` }}
          />
        </div>
        <div className="flex justify-between mt-2 text-xs text-gray-500">
          <span>0%</span>
          <span>50%</span>
          <span>100%</span>
        </div>
      </div>

      {/* Agent Grid */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-white">Agent Status</h3>
          <div className="flex items-center gap-2 text-sm text-gray-400">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-blue-500" />
              Running
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-green-500" />
              Completed
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-red-500" />
              Failed
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-amber-500" />
              Queued
            </span>
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-8 xl:grid-cols-10 gap-2 max-h-[400px] overflow-y-auto p-2">
          {agents.map((agent) => {
            const StatusIcon = statusColors[agent.status].icon;
            return (
              <button
                key={agent.id}
                onClick={() => onAgentClick?.(agent)}
                className={`p-3 rounded-lg border transition-all hover:scale-105 ${
                  agent.status === "running"
                    ? "border-blue-500/50 bg-blue-900/20 animate-pulse"
                    : agent.status === "completed"
                    ? "border-green-500/50 bg-green-900/20"
                    : agent.status === "failed"
                    ? "border-red-500/50 bg-red-900/20"
                    : "border-gray-700 bg-gray-800/50"
                }`}
              >
                <div className="flex flex-col items-center gap-2">
                  <StatusIcon
                    className={`w-5 h-5 ${statusColors[agent.status].text} ${
                      agent.status === "running" ? "animate-spin" : ""
                    }`}
                  />
                  <span className="text-xs font-medium text-gray-300 truncate w-full text-center">
                    {agent.name}
                  </span>
                  {agent.progress > 0 && agent.status === "running" && (
                    <div className="w-full h-1 bg-gray-700 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-500 transition-all duration-300"
                        style={{ width: `${agent.progress}%` }}
                      />
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Running Agents Detail */}
      {agents.filter((a) => a.status === "running").length > 0 && (
        <div className="card">
          <h3 className="text-lg font-semibold text-white mb-4">Active Agents</h3>
          <div className="space-y-3 max-h-[300px] overflow-y-auto">
            {agents
              .filter((a) => a.status === "running")
              .map((agent) => (
                <div
                  key={agent.id}
                  className="flex items-center gap-4 p-3 bg-gray-800/50 rounded-lg"
                >
                  <Loader2 className="w-5 h-5 text-blue-400 animate-spin" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-gray-200">
                        {agent.name}
                      </span>
                      <span className="text-xs text-gray-500">
                        {agent.progress.toFixed(0)}%
                      </span>
                    </div>
                    <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-500 transition-all duration-300"
                        style={{ width: `${agent.progress}%` }}
                      />
                    </div>
                    {agent.target && (
                      <p className="text-xs text-gray-500 mt-1 truncate">
                        Target: {agent.target}
                      </p>
                    )}
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
  color,
}: {
  label: string;
  value: number | string;
  icon: React.ElementType;
  color: string;
}) {
  return (
    <div className="card p-4 flex items-center gap-3">
      <div className={`p-2 rounded-lg ${color}`}>
        <Icon className="w-4 h-4 text-white" />
      </div>
      <div>
        <p className="text-xs text-gray-400">{label}</p>
        <p className="text-xl font-bold text-white">{value}</p>
      </div>
    </div>
  );
}
