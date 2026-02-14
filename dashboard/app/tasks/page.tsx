"use client";

import { useEffect, useState } from "react";
import { ListTodo, Clock, ArrowUpDown } from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

interface Task {
  id: string;
  title: string;
  agent_name?: string;
  agentName?: string;
  assigned_to?: string;
  status: string;
  priority?: string;
  created_at?: string;
  createdAt?: string;
}

const statusStyles: Record<string, string> = {
  pending: "bg-yellow-900/40 text-yellow-300 border-yellow-800",
  in_progress: "bg-blue-900/40 text-blue-300 border-blue-800",
  completed: "bg-green-900/40 text-green-300 border-green-800",
  failed: "bg-red-900/40 text-red-300 border-red-800",
};

const priorityStyles: Record<string, string> = {
  high: "text-red-400",
  medium: "text-yellow-400",
  low: "text-green-400",
};

const tabs = [
  { key: "all", label: "All" },
  { key: "pending", label: "Pending" },
  { key: "in_progress", label: "In Progress" },
  { key: "completed", label: "Completed" },
];

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    async function fetchTasks() {
      try {
        const res = await fetch(`${API}/api/tasks`);
        if (res.ok) {
          const data = await res.json();
          setTasks(Array.isArray(data) ? data : data.tasks || []);
        }
      } catch (err) {
        console.error("Failed to fetch tasks:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchTasks();
  }, []);

  const filtered =
    filter === "all" ? tasks : tasks.filter((t) => t.status === filter);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-white">Tasks</h1>
        <p className="text-gray-400 mt-1">Track and manage agent tasks</p>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 bg-gray-900 p-1 rounded-lg w-fit border border-gray-800">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              filter === tab.key
                ? "bg-gray-800 text-white shadow"
                : "text-gray-400 hover:text-gray-200"
            }`}
          >
            {tab.label}
            <span className="ml-1.5 text-xs opacity-60">
              (
              {tab.key === "all"
                ? tasks.length
                : tasks.filter((t) => t.status === tab.key).length}
              )
            </span>
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="card overflow-hidden !p-0">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-800">
              <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-4">
                <div className="flex items-center gap-1.5">
                  <ListTodo className="w-3.5 h-3.5" />
                  Title
                </div>
              </th>
              <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-4">
                Agent
              </th>
              <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-4">
                <div className="flex items-center gap-1.5">
                  Status
                  <ArrowUpDown className="w-3 h-3" />
                </div>
              </th>
              <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-4">
                Priority
              </th>
              <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-4">
                <div className="flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5" />
                  Created
                </div>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800/50">
            {loading ? (
              [...Array(8)].map((_, i) => (
                <tr key={i} className="animate-pulse">
                  <td className="px-6 py-4">
                    <div className="h-4 w-48 bg-gray-800 rounded" />
                  </td>
                  <td className="px-6 py-4">
                    <div className="h-4 w-24 bg-gray-800 rounded" />
                  </td>
                  <td className="px-6 py-4">
                    <div className="h-5 w-20 bg-gray-800 rounded-full" />
                  </td>
                  <td className="px-6 py-4">
                    <div className="h-4 w-16 bg-gray-800 rounded" />
                  </td>
                  <td className="px-6 py-4">
                    <div className="h-4 w-28 bg-gray-800 rounded" />
                  </td>
                </tr>
              ))
            ) : filtered.length === 0 ? (
              <tr>
                <td
                  colSpan={5}
                  className="px-6 py-12 text-center text-gray-500"
                >
                  No tasks found.
                </td>
              </tr>
            ) : (
              filtered.map((task, i) => (
                <tr
                  key={task.id || i}
                  className="hover:bg-gray-800/30 transition-colors"
                >
                  <td className="px-6 py-4">
                    <p className="text-sm font-medium text-gray-200">
                      {task.title}
                    </p>
                  </td>
                  <td className="px-6 py-4">
                    <p className="text-sm text-gray-400">
                      {task.agent_name || task.agentName || task.assigned_to || "—"}
                    </p>
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`badge border ${
                        statusStyles[task.status] ||
                        "bg-gray-800 text-gray-400 border-gray-700"
                      }`}
                    >
                      {task.status.replace("_", " ")}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`text-sm font-medium capitalize ${
                        priorityStyles[task.priority || ""] || "text-gray-400"
                      }`}
                    >
                      {task.priority || "—"}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <p className="text-sm text-gray-500">
                      {task.created_at || task.createdAt
                        ? new Date(
                            task.created_at || task.createdAt || ""
                          ).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : "—"}
                    </p>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
