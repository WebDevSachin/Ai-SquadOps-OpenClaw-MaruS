"use client";

import { useEffect, useState } from "react";
import { Bot, Circle, X } from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

interface Agent {
  id: string;
  name: string;
  specialty: string;
  squad: string;
  status: string;
  role?: string;
  description?: string;
  model?: string;
}

const squadColors: Record<string, string> = {
  engineering: "bg-blue-900/50 text-blue-300 border-blue-800",
  business: "bg-green-900/50 text-green-300 border-green-800",
  ops: "bg-purple-900/50 text-purple-300 border-purple-800",
  lead: "bg-amber-900/50 text-amber-300 border-amber-800",
};

const statusColors: Record<string, string> = {
  active: "text-green-400",
  paused: "text-yellow-400",
  error: "text-red-400",
};

function StatusDot({ status }: { status: string }) {
  return (
    <Circle
      className={`w-2.5 h-2.5 fill-current ${
        statusColors[status] || "text-gray-500"
      }`}
    />
  );
}

function AgentCard({
  agent,
  onClick,
}: {
  agent: Agent;
  onClick: () => void;
}) {
  const squad = squadColors[agent.squad] || "bg-gray-800 text-gray-400 border-gray-700";

  return (
    <button
      onClick={onClick}
      className="card text-left w-full hover:border-gray-700 hover:bg-gray-800/50 transition-all group"
    >
      <div className="flex items-start justify-between mb-3">
        <div className="w-10 h-10 rounded-lg bg-gray-800 flex items-center justify-center group-hover:bg-gray-700 transition-colors">
          <Bot className="w-5 h-5 text-gray-400" />
        </div>
        <div className="flex items-center gap-2">
          <StatusDot status={agent.status} />
          <span className="text-xs text-gray-500 capitalize">{agent.status}</span>
        </div>
      </div>
      <h3 className="text-sm font-semibold text-white mb-1 truncate">
        {agent.name}
      </h3>
      <p className="text-xs text-gray-400 mb-3 line-clamp-2">
        {agent.specialty}
      </p>
      <span className={`badge border ${squad} text-[10px] uppercase tracking-wider`}>
        {agent.squad}
      </span>
    </button>
  );
}

function AgentDetail({
  agent,
  onClose,
}: {
  agent: Agent;
  onClose: () => void;
}) {
  const squad = squadColors[agent.squad] || "bg-gray-800 text-gray-400 border-gray-700";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="card w-full max-w-lg mx-4 relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-4 mb-6">
          <div className="w-12 h-12 rounded-xl bg-gray-800 flex items-center justify-center">
            <Bot className="w-6 h-6 text-gray-400" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">{agent.name}</h2>
            <div className="flex items-center gap-2 mt-1">
              <StatusDot status={agent.status} />
              <span className="text-sm text-gray-400 capitalize">
                {agent.status}
              </span>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">
              Specialty
            </label>
            <p className="text-sm text-gray-200 mt-1">{agent.specialty}</p>
          </div>

          <div>
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">
              Squad
            </label>
            <div className="mt-1">
              <span className={`badge border ${squad} text-xs uppercase tracking-wider`}>
                {agent.squad}
              </span>
            </div>
          </div>

          {agent.role && (
            <div>
              <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                Role
              </label>
              <p className="text-sm text-gray-200 mt-1">{agent.role}</p>
            </div>
          )}

          {agent.description && (
            <div>
              <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                Description
              </label>
              <p className="text-sm text-gray-200 mt-1">{agent.description}</p>
            </div>
          )}

          {agent.model && (
            <div>
              <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                Model
              </label>
              <p className="text-sm text-gray-200 mt-1 font-mono">
                {agent.model}
              </p>
            </div>
          )}

          <div>
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">
              Agent ID
            </label>
            <p className="text-sm text-gray-400 mt-1 font-mono">{agent.id}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AgentsPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Agent | null>(null);
  const [filter, setFilter] = useState<string>("all");

  useEffect(() => {
    async function fetchAgents() {
      try {
        const res = await fetch(`${API}/api/agents`);
        if (res.ok) {
          const data = await res.json();
          setAgents(Array.isArray(data) ? data : data.agents || []);
        }
      } catch (err) {
        console.error("Failed to fetch agents:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchAgents();
  }, []);

  const squads = ["all", ...new Set(agents.map((a) => a.squad))];
  const filtered =
    filter === "all" ? agents : agents.filter((a) => a.squad === filter);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-white">Agents</h1>
        <p className="text-gray-400 mt-1">
          Manage and monitor your AI agent fleet
        </p>
      </div>

      {/* Squad Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        {squads.map((squad) => (
          <button
            key={squad}
            onClick={() => setFilter(squad)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filter === squad
                ? "bg-indigo-600 text-white"
                : "bg-gray-900 text-gray-400 hover:text-white hover:bg-gray-800 border border-gray-800"
            }`}
          >
            {squad === "all" ? "All" : squad.charAt(0).toUpperCase() + squad.slice(1)}
            {squad !== "all" && (
              <span className="ml-1.5 text-xs opacity-60">
                ({agents.filter((a) => a.squad === squad).length})
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Agent Grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {[...Array(12)].map((_, i) => (
            <div key={i} className="card animate-pulse">
              <div className="flex items-start justify-between mb-3">
                <div className="w-10 h-10 bg-gray-800 rounded-lg" />
                <div className="w-16 h-4 bg-gray-800 rounded" />
              </div>
              <div className="h-4 w-3/4 bg-gray-800 rounded mb-2" />
              <div className="h-3 w-full bg-gray-800 rounded mb-3" />
              <div className="h-5 w-20 bg-gray-800 rounded-full" />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((agent, i) => (
            <AgentCard
              key={agent.id || i}
              agent={agent}
              onClick={() => setSelected(agent)}
            />
          ))}
          {filtered.length === 0 && (
            <div className="col-span-full text-center py-12 text-gray-500">
              No agents found for this filter.
            </div>
          )}
        </div>
      )}

      {/* Detail Panel */}
      {selected && (
        <AgentDetail agent={selected} onClose={() => setSelected(null)} />
      )}
    </div>
  );
}
