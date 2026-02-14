"use client";

import { useEffect, useState } from "react";
import {
  ListTodo,
  Bot,
  ShieldCheck,
  DollarSign,
  Activity,
  Circle,
} from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

interface Agent {
  id: string;
  name: string;
  specialty: string;
  squad: string;
  status: string;
}

interface AuditEntry {
  id: string;
  action: string;
  agent_name?: string;
  agentName?: string;
  details?: string;
  timestamp: string;
  created_at?: string;
}

interface TaskStats {
  total: number;
  pending: number;
  in_progress: number;
  completed: number;
}

function StatCard({
  label,
  value,
  icon: Icon,
  color,
}: {
  label: string;
  value: string | number;
  icon: React.ElementType;
  color: string;
}) {
  return (
    <div className="card flex items-center gap-4">
      <div className={`p-3 rounded-lg ${color}`}>
        <Icon className="w-5 h-5 text-white" />
      </div>
      <div>
        <p className="text-sm text-gray-400">{label}</p>
        <p className="text-2xl font-bold text-white">{value}</p>
      </div>
    </div>
  );
}

function StatusDot({ status }: { status: string }) {
  const color =
    status === "active"
      ? "text-green-400"
      : status === "paused"
      ? "text-yellow-400"
      : status === "error"
      ? "text-red-400"
      : "text-gray-500";
  return <Circle className={`w-2.5 h-2.5 fill-current ${color}`} />;
}

function SkeletonCard() {
  return (
    <div className="card animate-pulse">
      <div className="flex items-center gap-4">
        <div className="w-11 h-11 bg-gray-800 rounded-lg" />
        <div className="space-y-2">
          <div className="h-3 w-20 bg-gray-800 rounded" />
          <div className="h-6 w-16 bg-gray-800 rounded" />
        </div>
      </div>
    </div>
  );
}

function SkeletonList() {
  return (
    <div className="card animate-pulse space-y-4">
      <div className="h-5 w-32 bg-gray-800 rounded" />
      {[...Array(5)].map((_, i) => (
        <div key={i} className="flex items-center gap-3">
          <div className="w-8 h-8 bg-gray-800 rounded-full" />
          <div className="flex-1 space-y-1.5">
            <div className="h-3 w-3/4 bg-gray-800 rounded" />
            <div className="h-2.5 w-1/2 bg-gray-800 rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function DashboardPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [audit, setAudit] = useState<AuditEntry[]>([]);
  const [stats, setStats] = useState<TaskStats | null>(null);
  const [pendingApprovals, setPendingApprovals] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const [agentsRes, auditRes, statsRes, approvalsRes] = await Promise.allSettled([
          fetch(`${API}/api/agents`),
          fetch(`${API}/api/audit`),
          fetch(`${API}/api/tasks/stats/summary`),
          fetch(`${API}/api/approvals?status=pending`),
        ]);

        if (agentsRes.status === "fulfilled" && agentsRes.value.ok) {
          const data = await agentsRes.value.json();
          setAgents(Array.isArray(data) ? data : data.agents || []);
        }

        if (auditRes.status === "fulfilled" && auditRes.value.ok) {
          const data = await auditRes.value.json();
          setAudit(Array.isArray(data) ? data.slice(0, 20) : (data.entries || []).slice(0, 20));
        }

        if (statsRes.status === "fulfilled" && statsRes.value.ok) {
          const data = await statsRes.value.json();
          setStats(data);
        }

        if (approvalsRes.status === "fulfilled" && approvalsRes.value.ok) {
          const data = await approvalsRes.value.json();
          const list = Array.isArray(data) ? data : data.approvals || [];
          setPendingApprovals(list.length);
        }
      } catch (err) {
        console.error("Failed to fetch dashboard data:", err);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  const totalCost = stats
    ? `$${((stats.total || 0) * 0.12).toFixed(2)}`
    : "$0.00";

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-white">Dashboard</h1>
        <p className="text-gray-400 mt-1">
          Overview of your AI agent operations
        </p>
      </div>

      {/* Stat Cards */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {[...Array(4)].map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatCard
            label="Total Tasks"
            value={stats?.total ?? 0}
            icon={ListTodo}
            color="bg-blue-600"
          />
          <StatCard
            label="Active Agents"
            value={agents.filter((a) => a.status === "active").length}
            icon={Bot}
            color="bg-emerald-600"
          />
          <StatCard
            label="Pending Approvals"
            value={pendingApprovals}
            icon={ShieldCheck}
            color="bg-amber-600"
          />
          <StatCard
            label="Total Cost"
            value={totalCost}
            icon={DollarSign}
            color="bg-purple-600"
          />
        </div>
      )}

      {/* Two Column Layout */}
      {loading ? (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          <div className="lg:col-span-3">
            <SkeletonList />
          </div>
          <div className="lg:col-span-2">
            <SkeletonList />
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Recent Activity */}
          <div className="lg:col-span-3 card">
            <div className="flex items-center gap-2 mb-6">
              <Activity className="w-5 h-5 text-gray-400" />
              <h2 className="text-lg font-semibold text-white">
                Recent Activity
              </h2>
            </div>
            <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2">
              {audit.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-8">
                  No recent activity
                </p>
              ) : (
                audit.map((entry, i) => (
                  <div
                    key={entry.id || i}
                    className="flex items-start gap-3 p-3 rounded-lg hover:bg-gray-800/50 transition-colors"
                  >
                    <div className="w-8 h-8 rounded-full bg-gray-800 flex items-center justify-center shrink-0 mt-0.5">
                      <Activity className="w-3.5 h-3.5 text-gray-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-200">
                        <span className="font-medium text-white">
                          {entry.agent_name || entry.agentName || "System"}
                        </span>{" "}
                        {entry.action}
                      </p>
                      {entry.details && (
                        <p className="text-xs text-gray-500 mt-0.5 truncate">
                          {entry.details}
                        </p>
                      )}
                      <p className="text-xs text-gray-600 mt-1">
                        {new Date(
                          entry.timestamp || entry.created_at || ""
                        ).toLocaleString()}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Agent Status */}
          <div className="lg:col-span-2 card">
            <div className="flex items-center gap-2 mb-6">
              <Bot className="w-5 h-5 text-gray-400" />
              <h2 className="text-lg font-semibold text-white">
                Agent Status
              </h2>
              <span className="ml-auto badge bg-gray-800 text-gray-400">
                {agents.length} agents
              </span>
            </div>
            <div className="space-y-2 max-h-[500px] overflow-y-auto pr-2">
              {agents.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-8">
                  No agents found
                </p>
              ) : (
                agents.map((agent, i) => (
                  <div
                    key={agent.id || i}
                    className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-gray-800/50 transition-colors"
                  >
                    <StatusDot status={agent.status} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-200 truncate">
                        {agent.name}
                      </p>
                      <p className="text-xs text-gray-500 truncate">
                        {agent.specialty}
                      </p>
                    </div>
                    <SquadBadge squad={agent.squad} />
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SquadBadge({ squad }: { squad: string }) {
  const colors: Record<string, string> = {
    engineering: "bg-blue-900/50 text-blue-300 border-blue-800",
    business: "bg-green-900/50 text-green-300 border-green-800",
    ops: "bg-purple-900/50 text-purple-300 border-purple-800",
    lead: "bg-amber-900/50 text-amber-300 border-amber-800",
  };
  const style = colors[squad] || "bg-gray-800 text-gray-400 border-gray-700";
  return (
    <span className={`badge border ${style} text-[10px] uppercase tracking-wider`}>
      {squad}
    </span>
  );
}
