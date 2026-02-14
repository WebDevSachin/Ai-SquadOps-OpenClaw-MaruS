"use client";

import { useEffect, useState } from "react";
import { Target, Plus, X, Calendar, AlertCircle } from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

interface Goal {
  id: string;
  title: string;
  description?: string;
  target_value: number;
  current_value: number;
  unit?: string;
  deadline?: string;
  status: string;
  created_at?: string;
}

function getProgressColor(percent: number): string {
  if (percent >= 60) return "bg-green-500";
  if (percent >= 30) return "bg-yellow-500";
  return "bg-red-500";
}

function GoalCard({
  goal,
  onUpdateProgress,
}: {
  goal: Goal;
  onUpdateProgress: (id: string, value: number) => void;
}) {
  const target = Number(goal.target_value) || 1;
  const current = Number(goal.current_value) || 0;
  const percent = Math.min(100, Math.round((current / target) * 100));
  const color = getProgressColor(percent);

  return (
    <div className="card hover:border-gray-700 transition-colors">
      <div className="flex items-start justify-between mb-4">
        <h3 className="text-sm font-semibold text-white">{goal.title}</h3>
        <span
          className={`badge border ${
            goal.status === "achieved"
              ? "bg-green-900/40 text-green-300 border-green-800"
              : goal.status === "missed"
              ? "bg-red-900/40 text-red-300 border-red-800"
              : "bg-blue-900/40 text-blue-300 border-blue-800"
          }`}
        >
          {goal.status}
        </span>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-400">
            {current} / {target} {goal.unit || ""}
          </span>
          <span className="text-gray-300 font-medium">{percent}%</span>
        </div>
        <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
          <div
            className={`h-full ${color} rounded-full transition-all duration-300`}
            style={{ width: `${percent}%` }}
          />
        </div>

        {goal.deadline && (
          <div className="flex items-center gap-1.5 text-xs text-gray-500">
            <Calendar className="w-3.5 h-3.5" />
            Due {new Date(goal.deadline).toLocaleDateString()}
          </div>
        )}

        {goal.status === "active" && (
          <div className="flex items-center gap-2 pt-2">
            <input
              type="number"
              placeholder="Update progress"
              className="flex-1 px-3 py-1.5 rounded-lg text-sm bg-gray-800 text-gray-200 border border-gray-700 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  const val = parseFloat((e.target as HTMLInputElement).value);
                  if (!isNaN(val)) {
                    onUpdateProgress(goal.id, val);
                    (e.target as HTMLInputElement).value = "";
                  }
                }
              }}
            />
            <button
              onClick={(e) => {
                const input = (e.currentTarget.previousElementSibling as HTMLInputElement);
                const val = parseFloat(input.value);
                if (!isNaN(val)) {
                  onUpdateProgress(goal.id, val);
                  input.value = "";
                }
              }}
              className="px-3 py-1.5 rounded-lg text-sm font-medium bg-indigo-600 text-white hover:bg-indigo-500 transition-colors"
            >
              Update
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="card animate-pulse">
      <div className="h-4 w-3/4 bg-gray-800 rounded mb-4" />
      <div className="h-2 bg-gray-800 rounded-full mb-3" />
      <div className="h-3 w-1/2 bg-gray-800 rounded" />
    </div>
  );
}

export default function GoalsPage() {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    title: "",
    target_value: "",
    unit: "",
    deadline: "",
  });

  async function fetchGoals() {
    try {
      const res = await fetch(`${API}/api/goals`);
      if (res.ok) {
        const data = await res.json();
        setGoals(data.goals || []);
      } else {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "Failed to fetch goals");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load goals");
      setGoals([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchGoals();
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`${API}/api/goals`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.title,
          target_value: parseFloat(form.target_value) || 0,
          unit: form.unit || undefined,
          deadline: form.deadline || undefined,
        }),
      });
      if (res.ok) {
        const created = await res.json();
        setGoals((prev) => [created, ...prev]);
        setForm({ title: "", target_value: "", unit: "", deadline: "" });
        setShowForm(false);
      } else {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "Failed to create goal");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create goal");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleUpdateProgress(id: string, current_value: number) {
    try {
      const res = await fetch(`${API}/api/goals/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ current_value }),
      });
      if (res.ok) {
        const updated = await res.json();
        setGoals((prev) =>
          prev.map((g) => (g.id === id ? updated : g))
        );
      }
    } catch (err) {
      console.error("Failed to update goal:", err);
    }
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Goals</h1>
          <p className="text-gray-400 mt-1">
            Track OKRs and goal progress
          </p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-indigo-600 text-white hover:bg-indigo-500 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Goal
        </button>
      </div>

      {error && (
        <div className="card border-red-900/50 bg-red-950/20 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
          <p className="text-sm text-red-300">{error}</p>
        </div>
      )}

      {/* Add Goal Modal */}
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
              Add Goal
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
                  placeholder="e.g. Increase ARR by 20%"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1.5">
                  Target Value
                </label>
                <input
                  type="number"
                  value={form.target_value}
                  onChange={(e) => setForm((f) => ({ ...f, target_value: e.target.value }))}
                  required
                  min="0"
                  step="any"
                  className="w-full px-3 py-2 rounded-lg text-sm bg-gray-800 text-gray-200 border border-gray-700 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  placeholder="100"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1.5">
                  Unit
                </label>
                <input
                  type="text"
                  value={form.unit}
                  onChange={(e) => setForm((f) => ({ ...f, unit: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg text-sm bg-gray-800 text-gray-200 border border-gray-700 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  placeholder="e.g. %, ARR, users"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1.5">
                  Deadline
                </label>
                <input
                  type="datetime-local"
                  value={form.deadline}
                  onChange={(e) => setForm((f) => ({ ...f, deadline: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg text-sm bg-gray-800 text-gray-200 border border-gray-700 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
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
                  {submitting ? "Creating..." : "Create Goal"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Goals Grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : goals.length === 0 ? (
        <div className="card text-center py-12">
          <Target className="w-12 h-12 text-gray-700 mx-auto mb-3" />
          <p className="text-gray-500 mb-4">No goals yet</p>
          <button
            onClick={() => setShowForm(true)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-indigo-600 text-white hover:bg-indigo-500 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add your first goal
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {goals.map((goal) => (
            <GoalCard
              key={goal.id}
              goal={goal}
              onUpdateProgress={handleUpdateProgress}
            />
          ))}
        </div>
      )}
    </div>
  );
}
