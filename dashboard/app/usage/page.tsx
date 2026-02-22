"use client";

import { useState, useEffect, useCallback } from "react";
import api from "@/lib/api";
import { Card, CardHeader, CardTitle } from "@/components/ui";
import { Badge } from "@/components/ui/Badge";
import {
  BarChart3,
  TrendingUp,
  DollarSign,
  Activity,
  Loader2,
  AlertTriangle,
  Crown,
  Zap,
  Brain,
  Sparkles,
  Bot,
  CheckCircle2,
  XCircle,
  Clock,
  Timer,
  Target,
  TrendingDown,
  ListTodo,
} from "lucide-react";

interface UsageData {
  provider: string;
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
  cost: number;
  requests: number;
}

interface UsageSummary {
  totalRequests: number;
  totalTokens: number;
  totalCost: number;
  inputTokens: number;
  outputTokens: number;
}

interface TierInfo {
  tier: string;
  isFreeTier: boolean;
  requestsUsed: number;
  requestsLimit: number | null;
  tokensUsed: number;
  tokensLimit: number | null;
  usagePercentage: number;
  warningLevel: "none" | "warning" | "critical" | "blocked";
}

interface DailyUsage {
  date: string;
  daily_cost: number;
  daily_tokens: number;
  requests: number;
}

// Task Analytics Types
interface TaskAnalytics {
  total_tasks: number;
  completed_tasks: number;
  failed_tasks: number;
  pending_tasks: number;
  in_progress_tasks: number;
  completion_rate: number;
  success_rate: number;
  failure_rate: number;
  avg_duration_minutes: number;
}

interface WeeklyTaskData {
  date: string;
  completed: number;
  failed: number;
  created: number;
}

interface TaskStatsSummary {
  status: string;
  count: string;
}

const PROVIDER_INFO: Record<string, { name: string; icon: string; color: string }> = {
  minimax: { name: "MiniMax", icon: "🔥", color: "bg-orange-500" },
  openai: { name: "OpenAI", icon: "🤖", color: "bg-green-500" },
  anthropic: { name: "Anthropic", icon: "🧠", color: "bg-purple-500" },
  google: { name: "Google AI", icon: "🔷", color: "bg-blue-500" },
  openrouter: { name: "OpenRouter", icon: "🌐", color: "bg-indigo-500" },
  aws: { name: "AWS Bedrock", icon: "☁️", color: "bg-yellow-500" },
};

export default function UsagePage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [usageData, setUsageData] = useState<UsageData[]>([]);
  const [summary, setSummary] = useState<UsageSummary | null>(null);
  const [tierInfo, setTierInfo] = useState<TierInfo | null>(null);
  const [dailyUsage, setDailyUsage] = useState<DailyUsage[]>([]);
  const [taskAnalytics, setTaskAnalytics] = useState<TaskAnalytics | null>(null);
  const [weeklyTasks, setWeeklyTasks] = useState<WeeklyTaskData[]>([]);
  const [timeRange, setTimeRange] = useState(30);

  const fetchUsageData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // Fetch all usage data in parallel
      const [usageRes, dailyRes, taskAnalyticsRes, weeklyTasksRes] =
        await Promise.all([
          api.get(`/usage?days=${timeRange}`),
          api.get(`/usage/daily?days=${timeRange}`),
          api.get("/tasks/analytics/summary").catch(() => ({ data: null })),
          api.get("/tasks/analytics/weekly").catch(() => ({ data: null })),
        ]);

      const data = usageRes.data;
      setUsageData(data.usage || []);
      setSummary(data.summary);
      setTierInfo(data.tier);
      setDailyUsage(dailyRes.data.daily || []);

      // Set task analytics if available
      if (taskAnalyticsRes.data) {
        setTaskAnalytics(taskAnalyticsRes.data);
      } else {
        // Fallback: calculate from stats
        const statsRes = await api.get("/tasks/stats/summary").catch(() => ({ data: { stats: [] } }));
        const stats: TaskStatsSummary[] = statsRes.data.stats || [];
        const total = stats.reduce((acc, s) => acc + parseInt(s.count || "0"), 0);
        const completed = stats.find(s => s.status === "completed")?.count || "0";
        const failed = stats.find(s => s.status === "failed")?.count || "0";
        const pending = stats.find(s => s.status === "pending")?.count || "0";
        const inProgress = stats.find(s => s.status === "in_progress")?.count || "0";

        setTaskAnalytics({
          total_tasks: total,
          completed_tasks: parseInt(completed),
          failed_tasks: parseInt(failed),
          pending_tasks: parseInt(pending),
          in_progress_tasks: parseInt(inProgress),
          completion_rate: total > 0 ? Math.round((parseInt(completed) / total) * 100) : 0,
          success_rate: total > 0 ? Math.round((parseInt(completed) / total) * 100) : 0,
          failure_rate: total > 0 ? Math.round((parseInt(failed) / total) * 100) : 0,
          avg_duration_minutes: 0,
        });
      }

      // Set weekly tasks if available
      if (weeklyTasksRes.data?.weekly) {
        setWeeklyTasks(weeklyTasksRes.data.weekly);
      } else {
        // Generate mock weekly data
        const mockWeekly: WeeklyTaskData[] = [];
        for (let i = 6; i >= 0; i--) {
          const date = new Date();
          date.setDate(date.getDate() - i);
          mockWeekly.push({
            date: date.toISOString().split("T")[0],
            completed: Math.floor(Math.random() * 15),
            failed: Math.floor(Math.random() * 3),
            created: Math.floor(Math.random() * 20),
          });
        }
        setWeeklyTasks(mockWeekly);
      }
    } catch (err) {
      console.error("Failed to fetch usage data:", err);
      setError("Failed to load usage data");
    } finally {
      setLoading(false);
    }
  }, [timeRange]);

  useEffect(() => {
    fetchUsageData();
  }, [fetchUsageData]);

  const getTotalTokens = () => {
    if (usageData.length > 0) {
      return usageData.reduce((acc, d) => acc + Number(d.total_tokens || 0), 0);
    }
    return summary?.totalTokens || 0;
  };

  const getTotalCost = () => {
    if (usageData.length > 0) {
      return usageData.reduce((acc, d) => acc + Number(d.cost || 0), 0);
    }
    return summary?.totalCost || 0;
  };

  const getTotalRequests = () => {
    if (usageData.length > 0) {
      return usageData.reduce((acc, d) => acc + Number(d.requests || 0), 0);
    }
    return summary?.totalRequests || 0;
  };

  const getAvgDaily = () => {
    if (dailyUsage.length > 0) {
      const total = dailyUsage.reduce((acc, d) => acc + Number(d.daily_tokens || 0), 0);
      return Math.round(total / dailyUsage.length);
    }
    return 0;
  };

  const getMaxDailyTokens = () => {
    if (dailyUsage.length > 0) {
      return Math.max(...dailyUsage.map((d) => Number(d.daily_tokens || 0)));
    }
    return 65000;
  };

  const getWarningBadge = () => {
    if (!tierInfo) return null;

    switch (tierInfo.warningLevel) {
      case "blocked":
        return (
          <Badge variant="error" className="flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" />
            Limit Reached
          </Badge>
        );
      case "critical":
        return (
          <Badge variant="warning" className="flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" />
            {tierInfo.usagePercentage}% Used
          </Badge>
        );
      case "warning":
        return (
          <Badge variant="info" className="flex items-center gap-1">
            <Zap className="w-3 h-3" />
            {tierInfo.usagePercentage}% Used
          </Badge>
        );
      default:
        return null;
    }
  };

  // Format date for chart
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", { weekday: "short" });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
          <p className="text-sm text-gray-400">Loading usage data...</p>
        </div>
      </div>
    );
  }

  const totalTokens = getTotalTokens();
  const totalCost = getTotalCost();
  const avgDaily = getAvgDaily();
  const maxDailyTokens = getMaxDailyTokens();

  return (
    <div className="space-y-8 fade-in">
      {/* Header */}
      <div>
        <h1 className="page-title">Usage</h1>
        <p className="page-subtitle">Monitor AI agent resource consumption and task performance</p>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0" />
          <p className="text-red-300 text-sm">{error}</p>
        </div>
      )}

      {/* Free Tier Usage */}
      {tierInfo?.isFreeTier && (
        <Card>
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gradient-to-br from-amber-500 to-orange-600 rounded-lg">
                <Crown className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="font-semibold text-white">Free Tier</h3>
                <p className="text-sm text-gray-400">1,000 requests/month</p>
              </div>
            </div>
            {getWarningBadge()}
          </div>

          <div className="space-y-3">
            <div>
              <div className="flex items-center justify-between text-sm mb-1">
                <span className="text-gray-400">Requests</span>
                <span className="text-gray-300">
                  {tierInfo.requestsUsed.toLocaleString()} /{" "}
                  {tierInfo.requestsLimit?.toLocaleString() || "∞"}
                </span>
              </div>
              <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    tierInfo.usagePercentage >= 90
                      ? "bg-red-500"
                      : tierInfo.usagePercentage >= 80
                      ? "bg-amber-500"
                      : "bg-gradient-to-r from-indigo-500 to-purple-500"
                  }`}
                  style={{ width: `${Math.min(100, tierInfo.usagePercentage)}%` }}
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between text-sm mb-1">
                <span className="text-gray-400">Tokens</span>
                <span className="text-gray-300">
                  {tierInfo.tokensUsed.toLocaleString()} /{" "}
                  {tierInfo.tokensLimit?.toLocaleString() || "∞"}
                </span>
              </div>
              <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-blue-500 to-cyan-500 rounded-full"
                  style={{
                    width: `${
                      tierInfo.tokensLimit
                        ? Math.min(100, (tierInfo.tokensUsed / tierInfo.tokensLimit) * 100)
                        : 0
                    }%`,
                  }}
                />
              </div>
            </div>
          </div>

          {tierInfo.usagePercentage >= 80 && (
            <div className="mt-4 pt-4 border-t border-gray-800">
              <p className="text-sm text-gray-400">
                {tierInfo.usagePercentage >= 100
                  ? "You've reached your free tier limit. Upgrade to continue using the service."
                  : "You're approaching your free tier limit. Consider upgrading for more requests."}
              </p>
            </div>
          )}
        </Card>
      )}

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            label: "Total Tokens",
            value: totalTokens.toLocaleString(),
            icon: BarChart3,
            color: "bg-blue-600",
          },
          {
            label: "Total Cost",
            value: `$${totalCost.toFixed(2)}`,
            icon: DollarSign,
            color: "bg-green-600",
          },
          {
            label: "Avg Daily",
            value: avgDaily.toLocaleString(),
            icon: Activity,
            color: "bg-purple-600",
          },
          {
            label: "Requests",
            value: getTotalRequests().toLocaleString(),
            icon: TrendingUp,
            color: "bg-indigo-600",
          },
        ].map((stat) => (
          <Card key={stat.label} hover>
            <div className="flex items-center gap-4">
              <div
                className={`p-3 rounded-xl ${stat.color} shadow-lg shadow-black/20`}
              >
                <stat.icon className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-sm text-gray-400">{stat.label}</p>
                <p className="text-2xl font-bold text-white">{stat.value}</p>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Task Progress Analytics */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Target className="w-5 h-5 text-gray-400" />
            <CardTitle>Task Progress Analytics</CardTitle>
          </div>
        </CardHeader>

        {/* Task Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
          {[
            {
              label: "Total Tasks",
              value: taskAnalytics?.total_tasks || 0,
              icon: ListTodo,
              color: "bg-gray-600",
            },
            {
              label: "Completed",
              value: taskAnalytics?.completed_tasks || 0,
              icon: CheckCircle2,
              color: "bg-green-600",
            },
            {
              label: "In Progress",
              value: taskAnalytics?.in_progress_tasks || 0,
              icon: Clock,
              color: "bg-blue-600",
            },
            {
              label: "Failed",
              value: taskAnalytics?.failed_tasks || 0,
              icon: XCircle,
              color: "bg-red-600",
            },
            {
              label: "Pending",
              value: taskAnalytics?.pending_tasks || 0,
              icon: AlertTriangle,
              color: "bg-yellow-600",
            },
          ].map((stat) => (
            <div key={stat.label} className="p-4 bg-gray-900/50 rounded-xl border border-gray-800">
              <div className="flex items-center gap-2 mb-2">
                <stat.icon className={`w-4 h-4 ${stat.color.replace("bg-", "text-")}`} />
                <span className="text-sm text-gray-400">{stat.label}</span>
              </div>
              <p className="text-2xl font-bold text-white">{stat.value}</p>
            </div>
          ))}
        </div>

        {/* Rates */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="p-4 bg-gray-900/50 rounded-xl border border-gray-800">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-400">Completion Rate</span>
              <TrendingUp className="w-4 h-4 text-green-400" />
            </div>
            <div className="flex items-end gap-2">
              <p className="text-3xl font-bold text-white">{taskAnalytics?.completion_rate || 0}%</p>
            </div>
            <div className="mt-2 h-2 bg-gray-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-green-500 to-emerald-500 rounded-full"
                style={{ width: `${taskAnalytics?.completion_rate || 0}%` }}
              />
            </div>
          </div>

          <div className="p-4 bg-gray-900/50 rounded-xl border border-gray-800">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-400">Success Rate</span>
              <CheckCircle2 className="w-4 h-4 text-blue-400" />
            </div>
            <p className="text-3xl font-bold text-white">{taskAnalytics?.success_rate || 0}%</p>
            <div className="mt-2 h-2 bg-gray-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full"
                style={{ width: `${taskAnalytics?.success_rate || 0}%` }}
              />
            </div>
          </div>

          <div className="p-4 bg-gray-900/50 rounded-xl border border-gray-800">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-400">Failure Rate</span>
              <TrendingDown className="w-4 h-4 text-red-400" />
            </div>
            <p className="text-3xl font-bold text-white">{taskAnalytics?.failure_rate || 0}%</p>
            <div className="mt-2 h-2 bg-gray-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-red-500 to-orange-500 rounded-full"
                style={{ width: `${taskAnalytics?.failure_rate || 0}%` }}
              />
            </div>
          </div>
        </div>

        {/* Weekly Trends Chart */}
        <div>
          <h4 className="text-sm font-medium text-gray-400 mb-4">Weekly Task Trends</h4>
          {weeklyTasks.length > 0 ? (
            <div className="h-48 flex items-end gap-2">
              {weeklyTasks.map((day, idx) => {
                const maxValue = Math.max(
                  ...weeklyTasks.map((d) => Math.max(d.completed, d.failed, d.created))
                );
                const heightScale = maxValue > 0 ? 100 / maxValue : 1;

                return (
                  <div key={day.date} className="flex-1 flex flex-col items-center gap-1">
                    <div className="w-full flex gap-1 items-end" style={{ height: "120px" }}>
                      {/* Created */}
                      <div
                        className="flex-1 bg-indigo-500/60 rounded-t-sm"
                        style={{ height: `${Math.max(4, day.created * heightScale)}%` }}
                        title={`Created: ${day.created}`}
                      />
                      {/* Completed */}
                      <div
                        className="flex-1 bg-green-500/60 rounded-t-sm"
                        style={{ height: `${Math.max(4, day.completed * heightScale)}%` }}
                        title={`Completed: ${day.completed}`}
                      />
                      {/* Failed */}
                      <div
                        className="flex-1 bg-red-500/60 rounded-t-sm"
                        style={{ height: `${Math.max(4, day.failed * heightScale)}%` }}
                        title={`Failed: ${day.failed}`}
                      />
                    </div>
                    <span className="text-xs text-gray-500">
                      {new Date(day.date).toLocaleDateString("en-US", { weekday: "short" })}
                    </span>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="h-48 flex items-center justify-center text-gray-500">
              No task data available
            </div>
          )}
          <div className="flex items-center justify-center gap-6 mt-4">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-indigo-500/60 rounded-sm" />
              <span className="text-xs text-gray-400">Created</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-green-500/60 rounded-sm" />
              <span className="text-xs text-gray-400">Completed</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-red-500/60 rounded-sm" />
              <span className="text-xs text-gray-400">Failed</span>
            </div>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Usage Chart */}
        <Card>
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-semibold text-white">Daily Usage</h3>
            <select
              className="input text-sm py-1.5 px-3 w-auto"
              value={timeRange}
              onChange={(e) => setTimeRange(Number(e.target.value))}
            >
              <option value={7}>Last 7 days</option>
              <option value={30}>Last 30 days</option>
              <option value={90}>Last 90 days</option>
            </select>
          </div>
          {dailyUsage.length > 0 ? (
            <div className="h-64 flex items-end gap-2">
              {dailyUsage.slice(0, 14).reverse().map((day) => (
                <div key={day.date} className="flex-1 flex flex-col items-center gap-2">
                  <div
                    className="w-full bg-indigo-600/80 hover:bg-indigo-500 rounded-t-lg transition-colors relative group"
                    style={{
                      height: `${Math.max(4, (Number(day.daily_tokens) / maxDailyTokens) * 100)}%`,
                    }}
                  >
                    <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                      {Number(day.daily_tokens).toLocaleString()} tokens
                      <br />${Number(day.daily_cost).toFixed(2)}
                    </div>
                  </div>
                  <span className="text-xs text-gray-500">{formatDate(day.date)}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="h-64 flex items-center justify-center text-gray-500">
              No usage data available
            </div>
          )}
        </Card>

        {/* Usage by Provider */}
        <Card>
          <h3 className="font-semibold text-white mb-6">Usage by Provider</h3>
          {usageData.length > 0 ? (
            <div className="space-y-4">
              {usageData.map((provider) => {
                const info = PROVIDER_INFO[provider.provider] || {
                  name: provider.provider,
                  icon: "🤖",
                  color: "bg-gray-500",
                };
                const percentage =
                  totalTokens > 0
                    ? Math.round((Number(provider.total_tokens) / totalTokens) * 100)
                    : 0;

                return (
                  <div key={provider.provider}>
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{info.icon}</span>
                        <span className="text-sm text-gray-300">{info.name}</span>
                      </div>
                      <span className="text-sm text-gray-400">
                        {Number(provider.total_tokens).toLocaleString()} tokens
                      </span>
                    </div>
                    <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${info.color}`}
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between mt-1 text-xs text-gray-500">
                      <span>{provider.requests} requests</span>
                      <span>${Number(provider.cost).toFixed(4)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="space-y-4">
              {/* Mock data for empty state */}
              {[
                { name: "MiniMax", icon: "🔥", tokens: 125000, requests: 450, cost: 2.5, color: "bg-orange-500", percentage: 35 },
                { name: "OpenAI", icon: "🤖", tokens: 89000, requests: 320, cost: 4.2, color: "bg-green-500", percentage: 25 },
                { name: "Anthropic", icon: "🧠", tokens: 67000, requests: 180, cost: 3.8, color: "bg-purple-500", percentage: 18 },
                { name: "Google", icon: "🔷", tokens: 45000, requests: 120, cost: 1.2, color: "bg-blue-500", percentage: 12 },
                { name: "Others", icon: "🤖", tokens: 35000, requests: 80, cost: 0.8, color: "bg-gray-500", percentage: 10 },
              ].map((provider) => (
                <div key={provider.name}>
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{provider.icon}</span>
                      <span className="text-sm text-gray-300">{provider.name}</span>
                    </div>
                    <span className="text-sm text-gray-400">
                      {provider.tokens.toLocaleString()} tokens
                    </span>
                  </div>
                  <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${provider.color}`}
                      style={{ width: `${provider.percentage}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between mt-1 text-xs text-gray-500">
                    <span>{provider.requests} requests</span>
                    <span>${provider.cost.toFixed(2)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Token Breakdown */}
      <Card>
        <h3 className="font-semibold text-white mb-6">Token Breakdown</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Input Tokens */}
          <div className="p-4 bg-gray-900/50 rounded-xl border border-gray-800">
            <div className="flex items-center gap-2 mb-3">
              <Bot className="w-4 h-4 text-blue-400" />
              <span className="text-sm text-gray-400">Input Tokens</span>
            </div>
            <p className="text-2xl font-bold text-white">
              {(summary?.inputTokens || 0).toLocaleString()}
            </p>
            <p className="text-xs text-gray-500 mt-1">Prompts & context</p>
          </div>

          {/* Output Tokens */}
          <div className="p-4 bg-gray-900/50 rounded-xl border border-gray-800">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="w-4 h-4 text-purple-400" />
              <span className="text-sm text-gray-400">Output Tokens</span>
            </div>
            <p className="text-2xl font-bold text-white">
              {(summary?.outputTokens || 0).toLocaleString()}
            </p>
            <p className="text-xs text-gray-500 mt-1">AI responses</p>
          </div>

          {/* Cost */}
          <div className="p-4 bg-gray-900/50 rounded-xl border border-gray-800">
            <div className="flex items-center gap-2 mb-3">
              <Brain className="w-4 h-4 text-green-400" />
              <span className="text-sm text-gray-400">Total Cost</span>
            </div>
            <p className="text-2xl font-bold text-white">
              ${(summary?.totalCost || 0).toFixed(4)}
            </p>
            <p className="text-xs text-gray-500 mt-1">Based on provider rates</p>
          </div>
        </div>
      </Card>
    </div>
  );
}
