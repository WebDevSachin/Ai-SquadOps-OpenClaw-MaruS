"use client";

import { useEffect, useState } from "react";
import {
  BarChart3,
  DollarSign,
  Coins,
  Hash,
  AlertCircle,
  Calendar,
} from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

interface UsageRow {
  agent_id?: string;
  agent_name?: string;
  total_input_tokens: number;
  total_output_tokens: number;
  total_cost: number;
  total_requests: number;
}

interface DailyUsage {
  date: string;
  daily_cost: number;
  daily_tokens: number;
  requests: number;
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

export default function UsagePage() {
  const [usage, setUsage] = useState<UsageRow[]>([]);
  const [daily, setDaily] = useState<DailyUsage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      setError(null);
      try {
        const [usageRes, dailyRes] = await Promise.all([
          fetch(`${API}/api/usage?days=30`),
          fetch(`${API}/api/usage/daily?days=30`),
        ]);

        if (!usageRes.ok) {
          const errData = await usageRes.json().catch(() => ({}));
          throw new Error(errData.error || "Failed to fetch usage");
        }
        const usageData = await usageRes.json();
        setUsage(usageData.usage || []);

        if (dailyRes.ok) {
          const dailyData = await dailyRes.json();
          setDaily(dailyData.daily || []);
        } else {
          setDaily([]);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load usage");
        setUsage([]);
        setDaily([]);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  const totalCost = usage.reduce((sum, r) => sum + Number(r.total_cost || 0), 0);
  const totalTokens = usage.reduce(
    (sum, r) => sum + Number(r.total_input_tokens || 0) + Number(r.total_output_tokens || 0),
    0
  );
  const totalRequests = usage.reduce((sum, r) => sum + Number(r.total_requests || 0), 0);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-white">Usage</h1>
        <p className="text-gray-400 mt-1">
          Track token consumption and costs across agents
        </p>
      </div>

      {error && (
        <div className="card border-red-900/50 bg-red-950/20 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
          <p className="text-sm text-red-300">{error}</p>
        </div>
      )}

      {/* Summary Cards */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          {[...Array(3)].map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          <StatCard
            label="Total Cost"
            value={`$${totalCost.toFixed(2)}`}
            icon={DollarSign}
            color="bg-emerald-600"
          />
          <StatCard
            label="Total Tokens"
            value={totalTokens.toLocaleString()}
            icon={Coins}
            color="bg-blue-600"
          />
          <StatCard
            label="Total Requests"
            value={totalRequests.toLocaleString()}
            icon={Hash}
            color="bg-purple-600"
          />
        </div>
      )}

      {/* Agent Usage Table */}
      <div className="card !p-0 overflow-hidden">
        <div className="flex items-center gap-2 px-6 py-4 border-b border-gray-800">
          <BarChart3 className="w-5 h-5 text-gray-400" />
          <h2 className="text-lg font-semibold text-white">Usage by Agent</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-800">
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-4">
                  Agent
                </th>
                <th className="text-right text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-4">
                  Input Tokens
                </th>
                <th className="text-right text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-4">
                  Output Tokens
                </th>
                <th className="text-right text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-4">
                  Total Cost
                </th>
                <th className="text-right text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-4">
                  Requests
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/50">
              {loading ? (
                [...Array(5)].map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td className="px-6 py-4">
                      <div className="h-4 w-32 bg-gray-800 rounded" />
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="h-4 w-20 bg-gray-800 rounded ml-auto" />
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="h-4 w-20 bg-gray-800 rounded ml-auto" />
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="h-4 w-16 bg-gray-800 rounded ml-auto" />
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="h-4 w-12 bg-gray-800 rounded ml-auto" />
                    </td>
                  </tr>
                ))
              ) : usage.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-6 py-12 text-center text-gray-500"
                  >
                    No usage data
                  </td>
                </tr>
              ) : (
                usage.map((row, i) => (
                  <tr
                    key={row.agent_id || row.agent_name || i}
                    className="hover:bg-gray-800/30 transition-colors"
                  >
                    <td className="px-6 py-4">
                      <p className="text-sm font-medium text-gray-200">
                        {row.agent_name || row.agent_id || "Unknown"}
                      </p>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <p className="text-sm text-gray-400">
                        {Number(row.total_input_tokens || 0).toLocaleString()}
                      </p>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <p className="text-sm text-gray-400">
                        {Number(row.total_output_tokens || 0).toLocaleString()}
                      </p>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <p className="text-sm font-medium text-gray-200">
                        ${Number(row.total_cost || 0).toFixed(2)}
                      </p>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <p className="text-sm text-gray-400">
                        {Number(row.total_requests || 0).toLocaleString()}
                      </p>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Daily Breakdown */}
      <div className="card !p-0 overflow-hidden">
        <div className="flex items-center gap-2 px-6 py-4 border-b border-gray-800">
          <Calendar className="w-5 h-5 text-gray-400" />
          <h2 className="text-lg font-semibold text-white">Daily Breakdown</h2>
        </div>
        <div className="max-h-[400px] overflow-y-auto">
          {loading ? (
            <div className="p-6 space-y-4">
              {[...Array(7)].map((_, i) => (
                <div key={i} className="flex items-center gap-4 animate-pulse">
                  <div className="h-4 w-24 bg-gray-800 rounded" />
                  <div className="h-4 w-20 bg-gray-800 rounded" />
                  <div className="h-4 w-16 bg-gray-800 rounded" />
                  <div className="h-4 w-12 bg-gray-800 rounded" />
                </div>
              ))}
            </div>
          ) : daily.length === 0 ? (
            <div className="p-12 text-center text-gray-500">
              No daily breakdown available
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-800">
                  <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-3">
                    Date
                  </th>
                  <th className="text-right text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-3">
                    Cost
                  </th>
                  <th className="text-right text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-3">
                    Tokens
                  </th>
                  <th className="text-right text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-3">
                    Requests
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/50">
                {daily.map((d, i) => (
                  <tr
                    key={d.date || i}
                    className="hover:bg-gray-800/30 transition-colors"
                  >
                    <td className="px-6 py-3">
                      <p className="text-sm text-gray-300">
                        {new Date(d.date).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </p>
                    </td>
                    <td className="px-6 py-3 text-right">
                      <p className="text-sm font-medium text-gray-200">
                        ${Number(d.daily_cost || 0).toFixed(2)}
                      </p>
                    </td>
                    <td className="px-6 py-3 text-right">
                      <p className="text-sm text-gray-400">
                        {Number(d.daily_tokens || 0).toLocaleString()}
                      </p>
                    </td>
                    <td className="px-6 py-3 text-right">
                      <p className="text-sm text-gray-400">
                        {Number(d.requests || 0).toLocaleString()}
                      </p>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
