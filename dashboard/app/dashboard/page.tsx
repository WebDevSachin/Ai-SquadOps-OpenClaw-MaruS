"use client";

import { useEffect, useState } from "react";
import {
  ListTodo,
  Bot,
  ShieldCheck,
  DollarSign,
  Activity,
  Circle,
  TrendingUp,
  Clock,
  CheckCircle2,
  AlertCircle,
  PlayCircle,
  ArrowRight,
  Zap,
} from "lucide-react";
import {
  Card,
  CardHeader,
  CardTitle,
  SkeletonCard,
  SkeletonList,
  Badge,
  Button,
  useToastHelpers,
} from "@/components/ui";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import api from "@/lib/api";
import Link from "next/link";

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
  details?: string | { title?: string; [key: string]: unknown };
  timestamp: string;
  created_at?: string;
}

interface Task {
  id: string;
  title: string;
  status: string;
  priority?: string;
  assigned_to?: string;
  assignedTo?: string;
  agent_name?: string;
  agentName?: string;
  created_at?: string;
  createdAt?: string;
  due_date?: string;
  dueDate?: string;
}

interface TaskStats {
  total: number;
  pending: number;
  in_progress: number;
  completed: number;
  failed?: number;
}

// Stat Card Component
function StatCard({
  label,
  value,
  icon: Icon,
  color,
  trend,
}: {
  label: string;
  value: string | number;
  icon: React.ElementType;
  color: string;
  trend?: { value: string; positive: boolean };
}) {
  return (
    <Card hover className="relative overflow-hidden group">
      <div
        className={`absolute top-0 right-0 w-32 h-32 ${color} opacity-5 rounded-full -translate-y-1/2 translate-x-1/2 group-hover:opacity-10 transition-opacity duration-500`}
      />
      
      <div className="flex items-center gap-4 relative">
        <div
          className={`p-3 rounded-xl ${color} shadow-lg shadow-black/20 transition-transform duration-200 group-hover:scale-110`}
        >
          <Icon className="w-5 h-5 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm text-gray-400 font-medium">{label}</p>
          <div className="flex items-center gap-2">
            <p className="text-2xl font-bold text-white tracking-tight">
              {value}
            </p>
            {trend && (
              <span
                className={`text-xs font-medium flex items-center gap-0.5 ${
                  trend.positive ? "text-green-400" : "text-red-400"
                }`}
              >
                <TrendingUp
                  className={`w-3 h-3 ${!trend.positive ? "rotate-180" : ""}`}
                />
                {trend.value}
              </span>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}

// Status Dot Component
function StatusDot({ status }: { status: string }) {
  const colors: Record<string, string> = {
    active: "text-green-400 shadow-[0_0_8px_rgba(74,222,128,0.5)]",
    paused: "text-yellow-400",
    error: "text-red-400 shadow-[0_0_8px_rgba(248,113,113,0.5)]",
    inactive: "text-gray-500",
  };
  
  const color = colors[status] || colors.inactive;
  const isActive = status === "active";
  
  return (
    <span className="relative flex h-2.5 w-2.5">
      {isActive && (
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
      )}
      <Circle
        className={`w-2.5 h-2.5 fill-current ${color} relative inline-flex rounded-full`}
      />
    </span>
  );
}

// Squad Badge Component
function SquadBadge({ squad }: { squad: string }) {
  const colors: Record<string, { bg: string; text: string; border: string }> = {
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
  
  const style =
    colors[squad] || {
      bg: "bg-gray-800",
      text: "text-gray-400",
      border: "border-gray-700",
    };
    
  return (
    <Badge
      variant="outline"
      className={`${style.bg} ${style.text} ${style.border} text-[10px] uppercase tracking-wider`}
    >
      {squad}
    </Badge>
  );
}

// Activity Item Component
function ActivityItem({
  entry,
  index,
}: {
  entry: AuditEntry;
  index: number;
}) {
  const { success } = useToastHelpers();
  
  const handleClick = () => {
    success(`Activity: ${entry.action}`);
  };
  
  return (
    <div
      onClick={handleClick}
      className="flex items-start gap-3 p-3 rounded-xl hover:bg-gray-800/50 transition-all duration-200 cursor-pointer group"
      style={{ animationDelay: `${index * 50}ms` }}
    >
      <div className="w-8 h-8 rounded-lg bg-gray-800 flex items-center justify-center shrink-0 mt-0.5 group-hover:bg-gray-700 transition-colors">
        <Activity className="w-3.5 h-3.5 text-gray-400" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-gray-200">
          <span className="font-medium text-white">
            {entry.agent_name || entry.agentName || "System"}
          </span>{" "}
          <span className="text-gray-400">{entry.action}</span>
        </p>
        {entry.details && (
          <p className="text-xs text-gray-500 mt-0.5 truncate group-hover:text-gray-400 transition-colors">
            {typeof entry.details === 'string' 
              ? entry.details 
              : entry.details.title || JSON.stringify(entry.details)}
          </p>
        )}
        <p className="text-xs text-gray-600 mt-1 flex items-center gap-1">
          <Clock className="w-3 h-3" />
          {new Date(
            entry.timestamp || entry.created_at || ""
          ).toLocaleString()}
        </p>
      </div>
    </div>
  );
}

// Agent Item Component
function AgentItem({
  agent,
  index,
}: {
  agent: Agent;
  index: number;
}) {
  return (
    <div
      className="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-800/50 transition-all duration-200 group cursor-pointer"
      style={{ animationDelay: `${index * 50}ms` }}
    >
      <StatusDot status={agent.status} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-200 truncate group-hover:text-white transition-colors">
          {agent.name}
        </p>
        <p className="text-xs text-gray-500 truncate">{agent.specialty}</p>
      </div>
      <SquadBadge squad={agent.squad} />
    </div>
  );
}

export default function DashboardPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [audit, setAudit] = useState<AuditEntry[]>([]);
  const [stats, setStats] = useState<TaskStats | null>(null);
  const [recentTasks, setRecentTasks] = useState<Task[]>([]);
  const [pendingApprovals, setPendingApprovals] = useState(0);
  const [loading, setLoading] = useState(true);
  const { error } = useToastHelpers();

  useEffect(() => {
    async function fetchData() {
      try {
        const [agentsRes, auditRes, statsRes, approvalsRes, tasksRes] =
          await Promise.allSettled([
            api.get("/agents").catch(() => ({ data: { agents: [] } })),
            api.get("/audit").catch(() => ({ data: { entries: [] } })),
            api.get("/tasks/stats/summary").catch(() => ({ data: { stats: [] } })),
            api.get("/approvals?status=pending").catch(() => ({ data: { approvals: [] } })),
            api.get("/tasks?limit=10&status=all").catch(() => ({ data: { tasks: [] } })),
          ]);

        if (agentsRes.status === "fulfilled") {
          const data = agentsRes.value?.data;
          // Ensure data is valid
          if (data && typeof data === 'object') {
            setAgents(Array.isArray(data) ? data : data.agents || []);
          }
        }

        if (auditRes.status === "fulfilled") {
          const data = auditRes.value?.data;
          if (data && typeof data === 'object') {
            const entries = Array.isArray(data) ? data : (data.entries || []);
            setAudit(entries.slice(0, 20));
          }
        }

        if (statsRes.status === "fulfilled") {
          const data = statsRes.value?.data;
          if (data && typeof data === 'object') {
            // Transform stats array into object
            if (Array.isArray(data.stats)) {
              const statsObj: TaskStats = {
                total: 0,
                pending: 0,
                in_progress: 0,
                completed: 0,
                failed: 0,
              };
              data.stats.forEach((s: { status: string; count: string | number }) => {
                const count = parseInt(String(s.count)) || 0;
                statsObj.total += count;
                if (s.status === "pending") statsObj.pending = count;
                if (s.status === "in_progress") statsObj.in_progress = count;
                if (s.status === "completed") statsObj.completed = count;
                if (s.status === "failed") statsObj.failed = count;
              });
              setStats(statsObj);
            } else if (data.total !== undefined) {
              // Already in object format
              setStats(data as TaskStats);
            }
          }
        }

        if (approvalsRes.status === "fulfilled") {
          const data = approvalsRes.value?.data;
          if (data && typeof data === 'object') {
            const list = Array.isArray(data) ? data : (data.approvals || []);
            setPendingApprovals(list.length);
          }
        }

        if (tasksRes.status === "fulfilled") {
          const data = tasksRes.value?.data;
          if (data && typeof data === 'object') {
            const tasks = Array.isArray(data) ? data : (data.tasks || []);
            setRecentTasks(tasks.slice(0, 8));
          }
        }
      } catch (err) {
        console.error("Failed to fetch dashboard data:", err);
        error("Failed to load dashboard data");
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [error]);

  const totalCost = stats
    ? `$${((stats.total || 0) * 0.12).toFixed(2)}`
    : "$0.00";

  const activeAgentsCount = agents.filter((a) => a.status === "active").length;

  // Calculate completion rate
  const completionRate = stats && stats.total > 0
    ? Math.round((stats.completed / stats.total) * 100)
    : 0;

  // Priority colors
  const priorityColors: Record<string, string> = {
    high: "text-red-400",
    medium: "text-yellow-400",
    low: "text-green-400",
  };

  // Status colors for tasks
  const taskStatusColors: Record<string, { bg: string; text: string }> = {
    pending: { bg: "bg-yellow-500/20", text: "text-yellow-400" },
    in_progress: { bg: "bg-blue-500/20", text: "text-blue-400" },
    completed: { bg: "bg-green-500/20", text: "text-green-400" },
    failed: { bg: "bg-red-500/20", text: "text-red-400" },
  };

  // Format date
  const formatDate = (dateStr?: string) => {
    if (!dateStr) return "";
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // Get relative time
  const getRelativeTime = (dateStr?: string) => {
    if (!dateStr) return "";
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return formatDate(dateStr);
  };

  return (
    <div className="space-y-8 fade-in">
      {/* Header */}
      <div className="page-header">
        <h1 className="page-title">Dashboard</h1>
        <p className="page-subtitle">
          Overview of your AI agent operations
        </p>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Link href="/tasks" className="block">
          <Card hover className="h-full transition-all hover:scale-[1.02]">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-blue-600/20 rounded-lg">
                <ListTodo className="w-5 h-5 text-blue-400" />
              </div>
              <div>
                <p className="text-sm text-gray-400">View Tasks</p>
                <p className="text-lg font-semibold text-white">{stats?.total || 0}</p>
              </div>
            </div>
          </Card>
        </Link>
        <Link href="/agents" className="block">
          <Card hover className="h-full transition-all hover:scale-[1.02]">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-emerald-600/20 rounded-lg">
                <Bot className="w-5 h-5 text-emerald-400" />
              </div>
              <div>
                <p className="text-sm text-gray-400">Active Agents</p>
                <p className="text-lg font-semibold text-white">{activeAgentsCount}</p>
              </div>
            </div>
          </Card>
        </Link>
        <Link href="/approvals" className="block">
          <Card hover className="h-full transition-all hover:scale-[1.02]">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-amber-600/20 rounded-lg">
                <ShieldCheck className="w-5 h-5 text-amber-400" />
              </div>
              <div>
                <p className="text-sm text-gray-400">Approvals</p>
                <p className="text-lg font-semibold text-white">{pendingApprovals}</p>
              </div>
            </div>
          </Card>
        </Link>
        <Link href="/usage" className="block">
          <Card hover className="h-full transition-all hover:scale-[1.02]">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-purple-600/20 rounded-lg">
                <Zap className="w-5 h-5 text-purple-400" />
              </div>
              <div>
                <p className="text-sm text-gray-400">Completion</p>
                <p className="text-lg font-semibold text-white">{completionRate}%</p>
              </div>
            </div>
          </Card>
        </Link>
      </div>

      {/* Task Overview Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="relative overflow-hidden">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-400">Pending</p>
              <p className="text-3xl font-bold text-white mt-1">{stats?.pending || 0}</p>
            </div>
            <div className="p-3 bg-yellow-500/20 rounded-xl">
              <AlertCircle className="w-6 h-6 text-yellow-400" />
            </div>
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-yellow-500/30" />
        </Card>
        <Card className="relative overflow-hidden">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-400">In Progress</p>
              <p className="text-3xl font-bold text-white mt-1">{stats?.in_progress || 0}</p>
            </div>
            <div className="p-3 bg-blue-500/20 rounded-xl">
              <PlayCircle className="w-6 h-6 text-blue-400" />
            </div>
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-blue-500/30" />
        </Card>
        <Card className="relative overflow-hidden">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-400">Completed</p>
              <p className="text-3xl font-bold text-white mt-1">{stats?.completed || 0}</p>
            </div>
            <div className="p-3 bg-green-500/20 rounded-xl">
              <CheckCircle2 className="w-6 h-6 text-green-400" />
            </div>
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-green-500/30" />
        </Card>
        <Card className="relative overflow-hidden">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-400">Failed</p>
              <p className="text-3xl font-bold text-white mt-1">{stats?.failed || 0}</p>
            </div>
            <div className="p-3 bg-red-500/20 rounded-xl">
              <AlertCircle className="w-6 h-6 text-red-400" />
            </div>
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-red-500/30" />
        </Card>
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
            trend={{ value: "12%", positive: true }}
          />
          <StatCard
            label="Active Agents"
            value={activeAgentsCount}
            icon={Bot}
            color="bg-emerald-600"
            trend={{ value: "5%", positive: true }}
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
            trend={{ value: "8%", positive: false }}
          />
        </div>
      )}

      {/* Two Column Layout */}
      {loading ? (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          <div className="lg:col-span-3">
            <SkeletonList items={5} />
          </div>
          <div className="lg:col-span-2">
            <SkeletonList items={5} avatar={false} />
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Recent Tasks */}
          <Card className="lg:col-span-3">
            <CardHeader>
              <div className="flex items-center gap-2">
                <ListTodo className="w-5 h-5 text-gray-400" />
                <CardTitle>Recent Tasks</CardTitle>
              </div>
              <Link href="/tasks">
                <Button variant="ghost" size="sm" rightIcon={<ArrowRight className="w-4 h-4" />}>
                  View All
                </Button>
              </Link>
            </CardHeader>
            <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2 scrollbar-hide">
              {recentTasks.length === 0 ? (
                <div className="empty-state py-8">
                  <ListTodo className="w-12 h-12 text-gray-600 mb-3" />
                  <p className="text-sm text-gray-500">No tasks yet</p>
                </div>
              ) : (
                recentTasks.map((task, i) => {
                  const statusStyle = taskStatusColors[task.status] || taskStatusColors.pending;
                  return (
                    <div
                      key={task.id || i}
                      className="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-800/50 transition-all duration-200 group"
                      style={{ animationDelay: `${i * 50}ms` }}
                    >
                      <div className={`p-2 rounded-lg ${statusStyle.bg}`}>
                        {task.status === "completed" ? (
                          <CheckCircle2 className={`w-4 h-4 ${statusStyle.text}`} />
                        ) : task.status === "in_progress" ? (
                          <PlayCircle className={`w-4 h-4 ${statusStyle.text}`} />
                        ) : task.status === "failed" ? (
                          <AlertCircle className={`w-4 h-4 ${statusStyle.text}`} />
                        ) : (
                          <Clock className={`w-4 h-4 ${statusStyle.text}`} />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-200 truncate group-hover:text-white transition-colors">
                          {task.title}
                        </p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-xs text-gray-500">
                            {task.agent_name || task.agentName || task.assigned_to || task.assignedTo || "Unassigned"}
                          </span>
                          {task.priority && (
                            <>
                              <span className="text-gray-600">•</span>
                              <span className={`text-xs capitalize ${priorityColors[task.priority] || "text-gray-500"}`}>
                                {task.priority}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <Badge variant={task.status === "completed" ? "success" : task.status === "failed" ? "error" : task.status === "in_progress" ? "primary" : "warning"} size="sm">
                          {task.status.replace("_", " ")}
                        </Badge>
                        <p className="text-xs text-gray-500 mt-1">
                          {getRelativeTime(task.created_at || task.createdAt)}
                        </p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </Card>

          {/* Agent Status */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Bot className="w-5 h-5 text-gray-400" />
                <CardTitle>Agent Status</CardTitle>
              </div>
              <Badge variant="primary" size="sm">
                {agents.length} agents
              </Badge>
            </CardHeader>
            <div className="space-y-1 max-h-[400px] overflow-y-auto pr-2 scrollbar-hide">
              {agents.length === 0 ? (
                <div className="empty-state py-8">
                  <Bot className="w-12 h-12 text-gray-600 mb-3" />
                  <p className="text-sm text-gray-500">No agents found</p>
                </div>
              ) : (
                agents.map((agent, i) => (
                  <AgentItem key={agent.id || i} agent={agent} index={i} />
                ))
              )}
            </div>
          </Card>
        </div>
      )}

      {/* Recent Activity - Full Width */}
      {loading ? (
        <div className="grid grid-cols-1 gap-6">
          <SkeletonList items={5} />
        </div>
      ) : (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Activity className="w-5 h-5 text-gray-400" />
              <CardTitle>Recent Activity</CardTitle>
            </div>
            <Badge variant="default" size="sm">
              {audit.length} entries
            </Badge>
          </CardHeader>
          <div className="space-y-1 max-h-[300px] overflow-y-auto pr-2 scrollbar-hide">
            {audit.length === 0 ? (
              <div className="empty-state py-8">
                <Activity className="w-12 h-12 text-gray-600 mb-3" />
                <p className="text-sm text-gray-500">No recent activity</p>
              </div>
            ) : (
              audit.map((entry, i) => (
                <ActivityItem key={entry.id || i} entry={entry} index={i} />
              ))
            )}
          </div>
        </Card>
      )}
    </div>
  );
}
