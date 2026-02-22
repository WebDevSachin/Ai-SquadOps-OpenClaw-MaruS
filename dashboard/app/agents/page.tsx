"use client";

import { useEffect, useState } from "react";
import { Bot, X, Search, Filter, Plus } from "lucide-react";
import {
  Card,
  Badge,
  Button,
  SkeletonGrid,
  useToastHelpers,
} from "@/components/ui";
import { Breadcrumb, useBreadcrumbs } from "@/components/Breadcrumb";
import api from "@/lib/api";

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

const squadColors: Record<string, { bg: string; text: string; border: string }> =
  {
    engineering: {
      bg: "bg-blue-900/30",
      text: "text-blue-300",
      border: "border-blue-800",
    },
    business: {
      bg: "bg-green-900/30",
      text: "text-green-300",
      border: "border-green-800",
    },
    ops: {
      bg: "bg-purple-900/30",
      text: "text-purple-300",
      border: "border-purple-800",
    },
    lead: {
      bg: "bg-amber-900/30",
      text: "text-amber-300",
      border: "border-amber-800",
    },
  };

const statusConfig: Record<
  string,
  { dot: string; bg: string; animate?: boolean }
> = {
  active: {
    dot: "bg-green-400",
    bg: "bg-green-900/20",
    animate: true,
  },
  paused: {
    dot: "bg-yellow-400",
    bg: "bg-yellow-900/20",
  },
  error: {
    dot: "bg-red-400",
    bg: "bg-red-900/20",
  },
  inactive: {
    dot: "bg-gray-500",
    bg: "bg-gray-800",
  },
};

function StatusBadge({ status }: { status: string }) {
  const config = statusConfig[status] || statusConfig.inactive;

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${config.bg}`}
    >
      <span className="relative flex h-2 w-2">
        {config.animate && (
          <span
            className={`animate-ping absolute inline-flex h-full w-full rounded-full ${config.dot} opacity-75`}
          />
        )}
        <span
          className={`relative inline-flex rounded-full h-2 w-2 ${config.dot}`}
        />
      </span>
      <span className="capitalize text-gray-300">{status}</span>
    </span>
  );
}

function SquadBadge({ squad }: { squad: string }) {
  const colors =
    squadColors[squad] || {
      bg: "bg-gray-800",
      text: "text-gray-400",
      border: "border-gray-700",
    };

  return (
    <Badge
      variant="outline"
      size="sm"
      className={`${colors.bg} ${colors.text} ${colors.border} uppercase tracking-wider`}
    >
      {squad}
    </Badge>
  );
}

function AgentCard({
  agent,
  onClick,
}: {
  agent: Agent;
  onClick: () => void;
}) {
  return (
    <Card
      interactive
      onClick={onClick}
      className="group h-full flex flex-col"
    >
      <div className="flex items-start justify-between mb-4">
        <div className="w-12 h-12 rounded-xl bg-gray-800 flex items-center justify-center group-hover:bg-gray-700 transition-colors shadow-inner">
          <Bot className="w-6 h-6 text-gray-400 group-hover:text-gray-300 transition-colors" />
        </div>
        <StatusBadge status={agent.status} />
      </div>

      <h3 className="text-base font-semibold text-white mb-1 truncate group-hover:text-indigo-300 transition-colors">
        {agent.name}
      </h3>
      <p className="text-sm text-gray-400 mb-4 line-clamp-2 flex-1">
        {agent.specialty}
      </p>

      <div className="flex items-center justify-between pt-4 border-t border-gray-800">
        <SquadBadge squad={agent.squad} />
        <span className="text-xs text-gray-500 font-mono">
          {agent.id.slice(0, 8)}...
        </span>
      </div>
    </Card>
  );
}

function AgentDetail({
  agent,
  onClose,
}: {
  agent: Agent;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div
        className="w-full max-w-lg scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        <Card className="relative">
          {/* Close Button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Header */}
          <div className="flex items-center gap-4 mb-6">
            <div className="w-14 h-14 rounded-2xl bg-gray-800 flex items-center justify-center shadow-inner">
              <Bot className="w-7 h-7 text-gray-400" />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-xl font-bold text-white truncate">
                {agent.name}
              </h2>
              <div className="flex items-center gap-2 mt-1">
                <StatusBadge status={agent.status} />
                <SquadBadge squad={agent.squad} />
              </div>
            </div>
          </div>

          {/* Details */}
          <div className="space-y-5">
            <DetailItem label="Specialty" value={agent.specialty} />
            {agent.role && <DetailItem label="Role" value={agent.role} />}
            {agent.description && (
              <DetailItem label="Description" value={agent.description} />
            )}
            {agent.model && (
              <DetailItem
                label="Model"
                value={agent.model}
                isCode
              />
            )}
            <DetailItem
              label="Agent ID"
              value={agent.id}
              isCode
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3 mt-6 pt-6 border-t border-gray-800">
            <Button variant="primary" className="flex-1">
              Edit Agent
            </Button>
            <Button variant="secondary" className="flex-1">
              View Logs
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}

function DetailItem({
  label,
  value,
  isCode = false,
}: {
  label: string;
  value: string;
  isCode?: boolean;
}) {
  return (
    <div>
      <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
        {label}
      </label>
      <p
        className={`text-sm text-gray-200 mt-1.5 ${
          isCode
            ? "font-mono text-xs bg-gray-800/50 p-2 rounded-lg border border-gray-800"
            : ""
        }`}
      >
        {value}
      </p>
    </div>
  );
}

export default function AgentsPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Agent | null>(null);
  const [filter, setFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const { error } = useToastHelpers();

  useEffect(() => {
    async function fetchAgents() {
      try {
        const res = await api.get("/agents");
        const data = res.data;
        setAgents(Array.isArray(data) ? data : data.agents || []);
      } catch (err) {
        console.error("Failed to fetch agents:", err);
        error("Failed to load agents");
      } finally {
        setLoading(false);
      }
    }
    fetchAgents();
  }, [error]);

  const squads = ["all", ...new Set(agents.map((a) => a.squad))];
  
  const filtered = agents.filter((agent) => {
    const matchesSquad = filter === "all" || agent.squad === filter;
    const matchesSearch =
      searchQuery === "" ||
      agent.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      agent.specialty.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSquad && matchesSearch;
  });

  const activeCount = agents.filter((a) => a.status === "active").length;

  return (
    <div className="space-y-8 fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="page-title">Agents</h1>
          <p className="page-subtitle">
            Manage and monitor your AI agent fleet
          </p>
        </div>
        <Button leftIcon={<Plus className="w-4 h-4" />}>
          Add Agent
        </Button>
      </div>

      {/* Stats Bar */}
      {!loading && (
        <div className="flex flex-wrap items-center gap-4 text-sm">
          <div className="flex items-center gap-2 px-4 py-2 bg-gray-900 rounded-xl border border-gray-800">
            <Bot className="w-4 h-4 text-gray-400" />
            <span className="text-gray-400">Total:</span>
            <span className="font-semibold text-white">{agents.length}</span>
          </div>
          <div className="flex items-center gap-2 px-4 py-2 bg-gray-900 rounded-xl border border-gray-800">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-green-400" />
            </span>
            <span className="text-gray-400">Active:</span>
            <span className="font-semibold text-white">{activeCount}</span>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col lg:flex-row gap-4">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
          <input
            type="text"
            placeholder="Search agents..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="input-with-icon"
          />
        </div>

        {/* Squad Filters */}
        <div className="flex items-center gap-2 flex-wrap">
          {squads.map((squad) => (
            <button
              key={squad}
              onClick={() => setFilter(squad)}
              className={`
                px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200
                ${
                  filter === squad
                    ? "bg-indigo-600 text-white shadow-lg shadow-indigo-500/20"
                    : "bg-gray-900 text-gray-400 hover:text-white hover:bg-gray-800 border border-gray-800"
                }
              `}
            >
              {squad === "all"
                ? "All Squads"
                : squad.charAt(0).toUpperCase() + squad.slice(1)}
              {squad !== "all" && (
                <span className="ml-1.5 text-xs opacity-60">
                  ({agents.filter((a) => a.squad === squad).length})
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Agent Grid */}
      {loading ? (
        <SkeletonGrid items={8} columns={4} />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((agent) => (
            <AgentCard
              key={agent.id}
              agent={agent}
              onClick={() => setSelected(agent)}
            />
          ))}
          {filtered.length === 0 && (
            <div className="col-span-full">
              <div className="card py-16 text-center">
                <Bot className="w-16 h-16 text-gray-700 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-300 mb-1">
                  No agents found
                </h3>
                <p className="text-sm text-gray-500">
                  {searchQuery
                    ? "Try adjusting your search query"
                    : "No agents match the selected filter"}
                </p>
              </div>
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
