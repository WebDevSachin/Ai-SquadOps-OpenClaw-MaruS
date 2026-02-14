"use client";

import { useEffect, useState } from "react";
import {
  RefreshCw,
  Plus,
  X,
  Trash2,
  ToggleLeft,
  ToggleRight,
  Clock,
  Calendar,
  AlertCircle,
} from "lucide-react";
import { toString as cronToString } from "cronstrue";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

interface RecurringTask {
  id: string;
  title: string;
  description?: string;
  cron_expression: string;
  assigned_agent?: string;
  agent_name?: string;
  enabled: boolean;
  last_run_at?: string;
  next_run_at?: string;
  created_at?: string;
}

interface Agent {
  id: string;
  name: string;
}

function cronToHuman(cron: string): string {
  try {
    return cronToString(cron);
  } catch {
    return cron;
  }
}

function SkeletonRow() {
  return (
    <div className="flex items-center gap-4 p-4 border-b border-gray-800 animate-pulse">
      <div className="h-5 w-48 bg-gray-800 rounded" />
      <div className="h-5 w-32 bg-gray-800 rounded" />
      <div className="h-5 w-24 bg-gray-800 rounded" />
      <div className="h-6 w-12 bg-gray-800 rounded-full" />
    </div>
  );
}

export default function RecurringPage() {
  const [tasks, setTasks] = useState<RecurringTask[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [toggling, setToggling] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [form, setForm] = useState({
    title: "",
    description: "",
    cron_expression: "",
    assigned_agent: "",
  });

  async function fetchData() {
    setLoading(true);
    setError(null);
    try {
      const [tasksRes, agentsRes] = await Promise.all([
        fetch(`${API}/api/recurring`),
        fetch(`${API}/api/agents`),
      ]);

      if (!tasksRes.ok) {
        const errData = await tasksRes.json().catch(() => ({}));
        throw new Error(errData.error || "Failed to fetch recurring tasks");
      }
      const tasksData = await tasksRes.json();
      setTasks(tasksData.recurring || []);

      if (agentsRes.ok) {
        const agentsData = await agentsRes.json();
        setAgents(Array.isArray(agentsData) ? agentsData : agentsData.agents || []);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load recurring tasks");
      setTasks([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchData();
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`${API}/api/recurring`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.title,
          description: form.description || undefined,
          cron_expression: form.cron_expression,
          assigned_agent: form.assigned_agent || undefined,
        }),
      });
      if (res.ok) {
        const created = await res.json();
        setTasks((prev) => [created, ...prev]);
        setForm({ title: "", description: "", cron_expression: "", assigned_agent: "" });
        setShowForm(false);
      } else {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "Failed to create recurring task");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create recurring task");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleToggle(id: string, enabled: boolean) {
    setToggling(id);
    try {
      const res = await fetch(`${API}/api/recurring/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled }),
      });
      if (res.ok) {
        const updated = await res.json();
        setTasks((prev) =>
          prev.map((t) => (t.id === id ? updated : t))
        );
      }
    } catch (err) {
      console.error("Failed to toggle task:", err);
    } finally {
      setToggling(null);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this recurring task?")) return;
    setDeleting(id);
    try {
      const res = await fetch(`${API}/api/recurring/${id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setTasks((prev) => prev.filter((t) => t.id !== id));
      } else {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "Failed to delete");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete task");
    } finally {
      setDeleting(null);
    }
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Recurring Tasks</h1>
          <p className="text-gray-400 mt-1">
            Schedule automated agent tasks
          </p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-indigo-600 text-white hover:bg-indigo-500 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Recurring Task
        </button>
      </div>

      {error && (
        <div className="card border-red-900/50 bg-red-950/20 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
          <p className="text-sm text-red-300">{error}</p>
        </div>
      )}

      {/* Add Task Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="card w-full max-w-md mx-4 relative">
            <button
              onClick={() => setShowForm(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
            <h2 className="text-lg font-semibold text-white mb-4">
              Add Recurring Task
            </h2>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1.5">
                  Title
                </label>
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  required
                  className="w-full px-3 py-2 rounded-lg text-sm bg-gray-800 text-gray-200 border border-gray-700 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  placeholder="e.g. Daily standup report"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1.5">
                  Description
                </label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  rows={2}
                  className="w-full px-3 py-2 rounded-lg text-sm bg-gray-800 text-gray-200 border border-gray-700 focus:outline-none focus:ring-1 focus:ring-indigo-500 resize-none"
                  placeholder="Optional description"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1.5">
                  Cron Expression
                </label>
                <input
                  type="text"
                  value={form.cron_expression}
                  onChange={(e) => setForm((f) => ({ ...f, cron_expression: e.target.value }))}
                  required
                  className="w-full px-3 py-2 rounded-lg text-sm bg-gray-800 text-gray-200 border border-gray-700 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono"
                  placeholder="e.g. 0 9 * * * (daily 9am)"
                />
                {form.cron_expression && (
                  <p className="text-xs text-gray-500 mt-1">
                    {cronToHuman(form.cron_expression)}
                  </p>
                )}
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1.5">
                  Assigned Agent
                </label>
                <select
                  value={form.assigned_agent}
                  onChange={(e) => setForm((f) => ({ ...f, assigned_agent: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg text-sm bg-gray-800 text-gray-200 border border-gray-700 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  <option value="">Select agent</option>
                  {agents.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="flex-1 px-4 py-2 rounded-lg text-sm font-medium bg-gray-800 text-gray-300 hover:bg-gray-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 px-4 py-2 rounded-lg text-sm font-medium bg-indigo-600 text-white hover:bg-indigo-500 transition-colors disabled:opacity-50"
                >
                  {submitting ? "Creating..." : "Create Task"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Task List */}
      <div className="card !p-0 overflow-hidden">
        <div className="flex items-center gap-2 px-6 py-4 border-b border-gray-800">
          <RefreshCw className="w-5 h-5 text-gray-400" />
          <h2 className="text-lg font-semibold text-white">Scheduled Tasks</h2>
        </div>
        <div className="divide-y divide-gray-800/50">
          {loading ? (
            [...Array(5)].map((_, i) => <SkeletonRow key={i} />)
          ) : tasks.length === 0 ? (
            <div className="p-12 text-center">
              <RefreshCw className="w-12 h-12 text-gray-700 mx-auto mb-3" />
              <p className="text-gray-500 mb-4">No recurring tasks</p>
              <button
                onClick={() => setShowForm(true)}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-indigo-600 text-white hover:bg-indigo-500 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Add your first task
              </button>
            </div>
          ) : (
            tasks.map((task) => (
              <div
                key={task.id}
                className="flex items-center gap-4 p-4 hover:bg-gray-800/30 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-semibold text-white truncate">
                    {task.title}
                  </h3>
                  <div className="flex items-center gap-4 mt-1.5 flex-wrap">
                    <span className="flex items-center gap-1.5 text-xs text-gray-500">
                      <Clock className="w-3.5 h-3.5" />
                      {cronToHuman(task.cron_expression)}
                    </span>
                    <span className="text-xs text-gray-500">
                      Agent: {task.agent_name || task.assigned_agent || "—"}
                    </span>
                    {task.last_run_at && (
                      <span className="flex items-center gap-1.5 text-xs text-gray-500">
                        <Calendar className="w-3.5 h-3.5" />
                        Last: {new Date(task.last_run_at).toLocaleString()}
                      </span>
                    )}
                    {task.next_run_at && (
                      <span className="text-xs text-gray-500">
                        Next: {new Date(task.next_run_at).toLocaleString()}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => handleToggle(task.id, !task.enabled)}
                    disabled={toggling === task.id}
                    className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition-colors disabled:opacity-50"
                    title={task.enabled ? "Disable" : "Enable"}
                  >
                    {task.enabled ? (
                      <ToggleRight className="w-6 h-6 text-green-500" />
                    ) : (
                      <ToggleLeft className="w-6 h-6" />
                    )}
                  </button>
                  <button
                    onClick={() => handleDelete(task.id)}
                    disabled={deleting === task.id}
                    className="p-1.5 rounded-lg text-gray-400 hover:text-red-400 hover:bg-red-950/30 transition-colors disabled:opacity-50"
                    title="Delete"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
