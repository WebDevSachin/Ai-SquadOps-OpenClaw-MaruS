"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import {
  Users,
  Bot,
  Settings,
  Activity,
  TrendingUp,
  AlertCircle,
  ArrowRight,
  Shield,
  Server,
  Database,
  UserPlus,
  UserCheck,
  UserX,
  BarChart3,
} from "lucide-react";
import { Card, CardHeader, CardTitle, Badge, Button, SkeletonCard } from "@/components/ui";
import api from "@/lib/api";

interface UserStats {
  total_users: number;
  active_users: number;
  inactive_users: number;
  by_role: Record<string, number>;
  new_this_week: number;
  new_this_month: number;
  recent_registrations: { date: string; count: number }[];
}

const adminCards = [
  {
    title: "User Management",
    description: "Manage users, roles, and permissions",
    icon: Users,
    href: "/admin/users",
    color: "bg-blue-600",
  },
  {
    title: "Agent Swarm",
    description: "Monitor and control agent operations",
    icon: Bot,
    href: "/admin/swarm",
    color: "bg-purple-600",
  },
  {
    title: "System Settings",
    description: "Configure system-wide settings",
    icon: Settings,
    href: "/admin/settings",
    color: "bg-emerald-600",
  },
];

interface SystemHealth {
  cpu_usage: number;
  memory_usage: number;
  active_sessions: number;
  security_alerts: number;
}

interface Alert {
  id: string;
  type: 'error' | 'warning' | 'info' | 'success';
  message: string;
  time: string;
}

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<UserStats | null>(null);
  const [systemHealth, setSystemHealth] = useState<SystemHealth | null>(null);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch user stats
        const statsRes = await api.get("/users/stats");
        setStats(statsRes.data);

        // Fetch system health
        const healthRes = await api.get("/system/health");
        setSystemHealth(healthRes.data);

        // Fetch recent alerts from audit log
        const alertsRes = await api.get("/audit?limit=5");
        const formattedAlerts = alertsRes.data.logs?.map((log: any) => ({
          id: log.id,
          type: log.status === 'error' ? 'error' : 
                log.status === 'warning' ? 'warning' : 
                log.action?.includes('CREATE') ? 'success' : 'info',
          message: `${log.action} - ${log.entity_type}`,
          time: new Date(log.created_at).toLocaleString()
        })) || [];
        setAlerts(formattedAlerts);
      } catch (err: any) {
        console.error("Failed to fetch admin data:", err);
        setError("Failed to load dashboard data");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // Calculate chart height based on max value
  const maxRegistrations = stats 
    ? Math.max(...stats.recent_registrations.map(r => r.count), 1)
    : 1;

  return (
    <div className="space-y-8 fade-in">
      {/* Header */}
      <div>
        <h1 className="page-title">Admin Dashboard</h1>
        <p className="page-subtitle">
          Manage your SquadOps deployment and monitor system health
        </p>
      </div>

      {/* Quick Access Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {adminCards.map((card) => (
          <Link key={card.title} href={card.href}>
            <Card hover className="h-full group">
              <div className="flex items-start justify-between">
                <div
                  className={`p-3 rounded-xl ${card.color} shadow-lg shadow-black/20 transition-transform duration-200 group-hover:scale-110`}
                >
                  <card.icon className="w-6 h-6 text-white" />
                </div>
                <ArrowRight className="w-5 h-5 text-gray-600 group-hover:text-gray-400 transition-all duration-200 group-hover:translate-x-1" />
              </div>
              <div className="mt-4">
                <h3 className="text-lg font-semibold text-white group-hover:text-indigo-300 transition-colors">
                  {card.title}
                </h3>
                <p className="text-sm text-gray-400 mt-1">{card.description}</p>
              </div>
            </Card>
          </Link>
        ))}
      </div>

      {/* User Analytics */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-gray-400" />
            <CardTitle>User Analytics</CardTitle>
          </div>
          <Link
            href="/admin/users"
            className="text-sm text-indigo-400 hover:text-indigo-300 transition-colors"
          >
            View all users
          </Link>
        </CardHeader>
        
        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="animate-pulse">
                <div className="h-20 bg-gray-800 rounded-xl" />
              </div>
            ))}
          </div>
        ) : (
          <>
            {/* Stats Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
              <div className="bg-gray-800/50 rounded-xl p-4 text-center">
                <div className="inline-flex p-2 rounded-lg bg-blue-900/30 mb-2">
                  <Users className="w-5 h-5 text-blue-400" />
                </div>
                <p className="text-2xl font-bold text-white">{stats?.total_users.toLocaleString()}</p>
                <p className="text-sm text-gray-400">Total Users</p>
              </div>
              <div className="bg-gray-800/50 rounded-xl p-4 text-center">
                <div className="inline-flex p-2 rounded-lg bg-green-900/30 mb-2">
                  <UserCheck className="w-5 h-5 text-green-400" />
                </div>
                <p className="text-2xl font-bold text-green-400">{stats?.active_users.toLocaleString()}</p>
                <p className="text-sm text-gray-400">Active Users</p>
              </div>
              <div className="bg-gray-800/50 rounded-xl p-4 text-center">
                <div className="inline-flex p-2 rounded-lg bg-purple-900/30 mb-2">
                  <UserPlus className="w-5 h-5 text-purple-400" />
                </div>
                <p className="text-2xl font-bold text-purple-400">+{stats?.new_this_week}</p>
                <p className="text-sm text-gray-400">New This Week</p>
              </div>
              <div className="bg-gray-800/50 rounded-xl p-4 text-center">
                <div className="inline-flex p-2 rounded-lg bg-red-900/30 mb-2">
                  <UserX className="w-5 h-5 text-red-400" />
                </div>
                <p className="text-2xl font-bold text-red-400">{stats?.inactive_users.toLocaleString()}</p>
                <p className="text-sm text-gray-400">Inactive Users</p>
              </div>
            </div>

            {/* Registration Trends Chart */}
            <div className="mt-6 pt-6 border-t border-gray-800">
              <h4 className="text-sm font-medium text-gray-400 mb-4">User Registration Trends (Last 7 Days)</h4>
              <div className="flex items-end justify-between gap-2 h-32">
                {stats?.recent_registrations.map((item, index) => {
                  const height = (item.count / maxRegistrations) * 100;
                  return (
                    <div key={index} className="flex-1 flex flex-col items-center gap-2">
                      <div className="w-full flex items-end justify-center">
                        <div
                          className="w-full max-w-8 bg-gradient-to-t from-indigo-600 to-purple-500 rounded-t-md transition-all duration-300 hover:from-indigo-500 hover:to-purple-400"
                          style={{ height: `${Math.max(height, 4)}%` }}
                          title={`${item.count} registrations`}
                        />
                      </div>
                      <span className="text-xs text-gray-500">
                        {new Date(item.date).toLocaleDateString("en-US", { weekday: "short" })}
                      </span>
                    </div>
                  );
                })}
              </div>
              <div className="flex items-center justify-between mt-2 text-xs text-gray-500">
                <span>Total: {stats?.recent_registrations.reduce((acc, r) => acc + r.count, 0)} new users</span>
                <span>Avg: {stats ? Math.round(stats.recent_registrations.reduce((acc, r) => acc + r.count, 0) / stats.recent_registrations.length) : 0}/day</span>
              </div>
            </div>

            {/* User Roles Breakdown */}
            <div className="mt-6 pt-6 border-t border-gray-800">
              <h4 className="text-sm font-medium text-gray-400 mb-4">Users by Role</h4>
              <div className="flex flex-wrap gap-3">
                {stats?.by_role && Object.entries(stats.by_role).map(([role, count]) => (
                  <div
                    key={role}
                    className="flex items-center gap-2 px-3 py-2 bg-gray-800/50 rounded-lg"
                  >
                    <span className={`badge border ${
                      role === "admin" ? "bg-purple-900/50 text-purple-300 border-purple-800" :
                      role === "member" ? "bg-blue-900/50 text-blue-300 border-blue-800" :
                      "bg-gray-800 text-gray-400 border-gray-700"
                    }`}>
                      {role}
                    </span>
                    <span className="text-sm font-medium text-white">{count}</span>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </Card>

      {/* System Stats */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Activity className="w-5 h-5 text-gray-400" />
            <CardTitle>System Health</CardTitle>
          </div>
        </CardHeader>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
          {[
            { label: "CPU Usage", value: `${systemHealth?.cpu_usage || 0}%`, icon: Server, color: "text-blue-400", bgColor: "bg-blue-900/20" },
            { label: "Memory", value: `${systemHealth?.memory_usage || 0}%`, icon: Database, color: "text-purple-400", bgColor: "bg-purple-900/20" },
            { label: "Active Sessions", value: systemHealth?.active_sessions?.toString() || "0", icon: Activity, color: "text-green-400", bgColor: "bg-green-900/20" },
            { label: "Security Alerts", value: systemHealth?.security_alerts?.toString() || "0", icon: Shield, color: "text-amber-400", bgColor: "bg-amber-900/20" },
          ].map((stat) => (
            <div key={stat.label} className="text-center">
              <div className={`inline-flex p-3 rounded-xl ${stat.bgColor} mb-3`}>
                <stat.icon className={`w-5 h-5 ${stat.color}`} />
              </div>
              <p className="text-2xl font-bold text-white">{stat.value}</p>
              <p className="text-sm text-gray-400">{stat.label}</p>
            </div>
          ))}
        </div>
      </Card>

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Recent Alerts */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-gray-400" />
              <CardTitle>Recent Activity</CardTitle>
            </div>
            <Link
              href="/audit"
              className="text-sm text-indigo-400 hover:text-indigo-300 transition-colors"
            >
              View all
            </Link>
          </CardHeader>
          <div className="space-y-2">
            {alerts.length > 0 ? alerts.map((alert, index) => (
              <div
                key={alert.id}
                className="flex items-start gap-3 p-3 rounded-xl hover:bg-gray-800/50 transition-colors cursor-pointer"
                style={{ animationDelay: `${index * 50}ms` }}
              >
                <div
                  className={`w-2 h-2 rounded-full mt-2 shrink-0 ${
                    alert.type === "error"
                      ? "bg-red-500"
                      : alert.type === "warning"
                      ? "bg-amber-500"
                      : alert.type === "success"
                      ? "bg-green-500"
                      : "bg-blue-500"
                  }`}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-300">{alert.message}</p>
                  <p className="text-xs text-gray-500 mt-1">{alert.time}</p>
                </div>
              </div>
            )) : (
              <p className="text-sm text-gray-500 text-center py-4">No recent activity</p>
            )}
          </div>
        </Card>

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-gray-400" />
              <CardTitle>Quick Actions</CardTitle>
            </div>
          </CardHeader>
          <div className="space-y-2">
            {[
              {
                href: "/admin/users",
                icon: Users,
                iconColor: "text-blue-400",
                iconBg: "bg-blue-900/20",
                title: "Add New User",
                description: "Create a new user account",
              },
              {
                href: "/admin/swarm",
                icon: Bot,
                iconColor: "text-purple-400",
                iconBg: "bg-purple-900/20",
                title: "Start Agent Swarm",
                description: "Launch a new swarm operation",
              },
              {
                href: "/admin/settings",
                icon: Settings,
                iconColor: "text-emerald-400",
                iconBg: "bg-emerald-900/20",
                title: "System Settings",
                description: "Configure system parameters",
              },
            ].map((action) => (
              <Link
                key={action.title}
                href={action.href}
                className="flex items-center gap-3 p-3 rounded-xl bg-gray-800/30 hover:bg-gray-800/60 transition-all duration-200 group"
              >
                <div className={`p-2 rounded-lg ${action.iconBg}`}>
                  <action.icon className={`w-4 h-4 ${action.iconColor}`} />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-white group-hover:text-indigo-300 transition-colors">
                    {action.title}
                  </p>
                  <p className="text-xs text-gray-500">{action.description}</p>
                </div>
                <ArrowRight className="w-4 h-4 text-gray-500 group-hover:text-gray-300 group-hover:translate-x-0.5 transition-all" />
              </Link>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
