"use client";

import { useEffect, useState } from "react";
import {
  ScrollText,
  Filter,
  ChevronDown,
  Activity,
  AlertCircle,
} from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

interface AuditEntry {
  id: string;
  agent_id?: string;
  agent_name?: string;
  action: string;
  target_type?: string;
  target_id?: string;
  details?: string | Record<string, unknown>;
  created_at: string;
}

interface AuditStats {
  agent_id?: string;
  agent_name?: string;
  total_actions: number;
  last_action?: string;
}

const agentBadgeColors = [
  "bg-blue-900/50 text-blue-300 border-blue-800",
  "bg-emerald-900/50 text-emerald-300 border-emerald-800",
  "bg-amber-900/50 text-amber-300 border-amber-800",
  "bg-purple-900/50 text-purple-300 border-purple-800",
  "bg-rose-900/50 text-rose-300 border-rose-800",
  "bg-cyan-900/50 text-cyan-300 border-cyan-800",
];

function getAgentBadgeColor(agentName: string): string {
  let hash = 0;
  for (let i = 0; i < (agentName || "system").length; i++) {
    hash = (hash << 5) - hash + (agentName || "system").charCodeAt(i);
    hash |= 0;
  }
  return agentBadgeColors[Math.abs(hash) % agentBadgeColors.length];
}

function StatCard({
  label,
  value,
  agentName,
}: {
  label: string;
  value: number;
  agentName?: string;
}) {
  const color = getAgentBadgeColor(agentName || "system");
  return (
    <div className="card flex items-center justify-between">
      <div>
        <p className="text-sm text-gray-400">{label}</p>
        <p className="text-2xl font-bold text-white mt-0.5">{value}</p>
      </div>
      {agentName && (
        <span
          className={`badge border ${color} text-xs uppercase tracking-wider`}
        >
          {agentName}
        </span>
      )}
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="card animate-pulse">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-3 w-24 bg-gray-800 rounded" />
          <div className="h-6 w-12 bg-gray-800 rounded" />
        </div>
        <div className="h-6 w-20 bg-gray-800 rounded-full" />
      </div>
    </div>
  );
}

function SkeletonEntry() {
  return (
    <div className="flex items-start gap-3 p-4 rounded-lg border border-gray-800 animate-pulse">
      <div className="w-10 h-10 bg-gray-800 rounded-lg shrink-0" />
      <div className="flex-1 space-y-2">
        <div className="h-4 w-3/4 bg-gray-800 rounded" />
        <div className="h-3 w-1/2 bg-gray-800 rounded" />
        <div className="h-3 w-24 bg-gray-800 rounded" />
      </div>
    </div>
  );
}

export default function AuditPage() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [stats, setStats] = useState<AuditStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [agentFilter, setAgentFilter] = useState<string>("all");
  const [actionFilter, setActionFilter] = useState<string>("all");
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({ limit: "100" });
        if (agentFilter !== "all") params.set("agent_id", agentFilter);
        if (actionFilter !== "all") params.set("action", actionFilter);

        const [entriesRes, statsRes] = await Promise.all([
          fetch(`${API}/api/audit?${params}`),
          fetch(`${API}/api/audit/stats`),
        ]);

        if (!entriesRes.ok) {
          const errData = await entriesRes.json().catch(() => ({}));
          throw new Error(errData.error || "Failed to fetch audit log");
        }
        const entriesData = await entriesRes.json();
        setEntries(entriesData.entries || []);

        if (statsRes.ok) {
          const statsData = await statsRes.json();
          setStats(statsData.stats || []);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load audit log");
        setEntries([]);
        setStats([]);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [agentFilter, actionFilter]);

  const agentOptions = Array.from(
    new Map(
      [...stats, ...entries]
        .filter((e: { agent_id?: string; agent_name?: string }) => e.agent_id || e.agent_name)
        .map((e: { agent_id?: string; agent_name?: string }) => [
          e.agent_id || e.agent_name,
          { id: e.agent_id, name: e.agent_name || e.agent_id },
        ])
    ).values()
  ) as { id?: string; name?: string }[];
  const actions = [...new Set(entries.map((e) => e.action).filter(Boolean))];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-white">Audit Log</h1>
        <p className="text-gray-400 mt-1">
          Track all agent actions and system events
        </p>
      </div>

      {error && (
        <div className="card border-red-900/50 bg-red-950/20 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
          <p className="text-sm text-red-300">{error}</p>
        </div>
      )}

      {/* Stats */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : stats.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {stats.slice(0, 6).map((s, i) => (
            <StatCard
              key={s.agent_id || s.agent_name || i}
              label="Total Actions"
              value={s.total_actions}
              agentName={s.agent_name || s.agent_id || "System"}
            />
          ))}
        </div>
      ) : null}

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <button
          onClick={() => setShowFilters(!showFilters)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-gray-900 text-gray-400 hover:text-white hover:bg-gray-800 border border-gray-800 transition-colors"
        >
          <Filter className="w-4 h-4" />
          Filters
          <ChevronDown
            className={`w-4 h-4 transition-transform ${showFilters ? "rotate-180" : ""}`}
          />
        </button>
        {showFilters && (
          <div className="flex items-center gap-3 flex-wrap">
            <select
              value={agentFilter}
              onChange={(e) => setAgentFilter(e.target.value)}
              className="px-3 py-2 rounded-lg text-sm bg-gray-900 text-gray-200 border border-gray-800 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value="all">All agents</option>
              {agentOptions.map((a) => (
                <option key={a.id || a.name} value={a.id || a.name}>
                  {a.name || a.id}
                </option>
              ))}
            </select>
            <select
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
              className="px-3 py-2 rounded-lg text-sm bg-gray-900 text-gray-200 border border-gray-800 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value="all">All action types</option>
              {actions.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Audit Feed */}
      <div className="card !p-0 overflow-hidden">
        <div className="flex items-center gap-2 px-6 py-4 border-b border-gray-800">
          <ScrollText className="w-5 h-5 text-gray-400" />
          <h2 className="text-lg font-semibold text-white">Activity Feed</h2>
        </div>
        <div className="max-h-[600px] overflow-y-auto">
          {loading ? (
            <div className="p-6 space-y-4">
              {[...Array(10)].map((_, i) => (
                <SkeletonEntry key={i} />
              ))}
            </div>
          ) : entries.length === 0 ? (
            <div className="p-12 text-center">
              <Activity className="w-12 h-12 text-gray-700 mx-auto mb-3" />
              <p className="text-gray-500">No audit entries found</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-800/50">
              {entries.map((entry, i) => {
                const agentName = entry.agent_name || entry.agent_id || "System";
                const details =
                  typeof entry.details === "string"
                    ? entry.details
                    : entry.details && typeof entry.details === "object"
                    ? JSON.stringify(entry.details)
                    : null;
                const target = [entry.target_type, entry.target_id]
                  .filter(Boolean)
                  .join(": ") || null;

                return (
                  <div
                    key={entry.id || i}
                    className="flex items-start gap-3 p-4 hover:bg-gray-800/30 transition-colors"
                  >
                    <div
                      className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${getAgentBadgeColor(agentName)}`}
                    >
                      <Activity className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={`badge border ${getAgentBadgeColor(agentName)} text-xs`}
                        >
                          {agentName}
                        </span>
                        <span className="text-sm font-medium text-gray-300">
                          {entry.action}
                        </span>
                      </div>
                      {target && (
                        <p className="text-sm text-gray-500 mt-0.5">
                          Target: {target}
                        </p>
                      )}
                      {details && (
                        <p className="text-xs text-gray-600 mt-1 truncate max-w-md">
                          {details}
                        </p>
                      )}
                      <p className="text-xs text-gray-600 mt-1.5">
                        {new Date(entry.created_at).toLocaleString()}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
