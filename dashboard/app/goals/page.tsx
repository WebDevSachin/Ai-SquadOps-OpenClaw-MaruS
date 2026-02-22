"use client";

import { useEffect, useState } from "react";
import { Target, Plus, TrendingUp, CheckCircle2, Circle, X, Calendar, Link2, Clock } from "lucide-react";
import { Card, Button, Badge, Input, Textarea, Select, useToastHelpers } from "@/components/ui";
import { Breadcrumb, useBreadcrumbs } from "@/components/Breadcrumb";
import api from "@/lib/api";

interface Workflow {
  id: string;
  name: string;
  workflow_type: string;
}

interface Goal {
  id: string;
  title: string;
  description: string;
  target_value: number;
  current_value: number;
  unit: string;
  deadline: string;
  status: string;
  workflow_id?: string;
  created_at: string;
}

const statusOptions = [
  { value: "active", label: "Active" },
  { value: "completed", label: "Completed" },
  { value: "paused", label: "Paused" },
  { value: "cancelled", label: "Cancelled" },
];

const unitOptions = [
  { value: "%", label: "Percentage (%)" },
  { value: "tasks", label: "Tasks" },
  { value: "hours", label: "Hours" },
  { value: "items", label: "Items" },
  { value: "USD", label: "USD" },
];

export default function GoalsPage() {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null);
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [linkingGoal, setLinkingGoal] = useState<Goal | null>(null);
  const { success, error } = useToastHelpers();
  const breadcrumbs = useBreadcrumbs();

  // Form state
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    target_value: 100,
    unit: "%",
    deadline: "",
    status: "active",
    workflow_id: "",
  });

  useEffect(() => {
    fetchGoals();
    fetchWorkflows();
  }, []);

  const fetchGoals = async () => {
    try {
      const res = await api.get("/goals");
      setGoals(res.data.goals || []);
    } catch (err) {
      console.error("Failed to fetch goals:", err);
      error("Failed to load goals");
    } finally {
      setLoading(false);
    }
  };

  const fetchWorkflows = async () => {
    try {
      const res = await api.get("/workflows");
      setWorkflows(res.data.workflows || []);
    } catch (err) {
      console.error("Failed to fetch workflows:", err);
    }
  };

  const handleCreateGoal = async () => {
    try {
      const payload = {
        ...formData,
        target_value: Number(formData.target_value),
      };

      if (editingGoal) {
        await api.patch(`/goals/${editingGoal.id}`, payload);
        success("Goal updated successfully");
      } else {
        await api.post("/goals", payload);
        success("Goal created successfully");
      }

      setShowCreateModal(false);
      resetForm();
      fetchGoals();
    } catch (err: any) {
      error(err.response?.data?.error || "Failed to save goal");
    }
  };

  const handleUpdateProgress = async (goal: Goal, newValue: number) => {
    try {
      const newStatus = newValue >= Number(goal.target_value) ? "completed" : "active";
      await api.patch(`/goals/${goal.id}`, {
        current_value: newValue,
        status: newStatus,
      });
      success("Progress updated");
      fetchGoals();
    } catch (err) {
      error("Failed to update progress");
    }
  };

  const handleLinkWorkflow = async () => {
    if (!linkingGoal || !formData.workflow_id) return;

    try {
      await api.patch(`/goals/${linkingGoal.id}`, {
        workflow_id: formData.workflow_id,
      });
      success("Goal linked to workflow");
      setShowLinkModal(false);
      setLinkingGoal(null);
      setFormData((prev) => ({ ...prev, workflow_id: "" }));
      fetchGoals();
    } catch (err) {
      error("Failed to link workflow");
    }
  };

  const openLinkModal = (goal: Goal) => {
    setLinkingGoal(goal);
    setFormData((prev) => ({ ...prev, workflow_id: goal.workflow_id || "" }));
    setShowLinkModal(true);
  };

  const resetForm = () => {
    setFormData({
      title: "",
      description: "",
      target_value: 100,
      unit: "%",
      deadline: "",
      status: "active",
      workflow_id: "",
    });
    setEditingGoal(null);
  };

  const handleEditGoal = (goal: Goal) => {
    setEditingGoal(goal);
    setFormData({
      title: goal.title,
      description: goal.description || "",
      target_value: goal.target_value,
      unit: goal.unit || "%",
      deadline: goal.deadline ? goal.deadline.split("T")[0] : "",
      status: goal.status,
      workflow_id: goal.workflow_id || "",
    });
    setShowCreateModal(true);
  };

  const filteredGoals =
    filter === "all"
      ? goals
      : goals.filter((g) => g.status === filter);

  const getProgressPercentage = (goal: Goal) => {
    if (!goal.target_value) return 0;
    return Math.min(100, Math.round((Number(goal.current_value) / Number(goal.target_value)) * 100));
  };

  const isOverdue = (deadline: string) => {
    if (!deadline) return false;
    return new Date(deadline) < new Date();
  };

  const stats = {
    total: goals.length,
    completed: goals.filter((g) => g.status === "completed").length,
    inProgress: goals.filter((g) => g.status === "active").length,
    overdue: goals.filter((g) => isOverdue(g.deadline) && g.status !== "completed").length,
  };

  return (
    <div className="space-y-8 fade-in">
      {/* Breadcrumb */}
      <Breadcrumb items={breadcrumbs} />
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="page-title">Goals</h1>
          <p className="page-subtitle">
            Track team objectives and link to workflows
          </p>
        </div>
        <Button
          leftIcon={<Plus className="w-4 h-4" />}
          onClick={() => {
            resetForm();
            setShowCreateModal(true);
          }}
        >
          New Goal
        </Button>
      </div>

      {/* Stats */}
      {!loading && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: "Total Goals", value: stats.total, color: "text-white" },
            { label: "Completed", value: stats.completed, color: "text-green-400" },
            { label: "In Progress", value: stats.inProgress, color: "text-indigo-400" },
            { label: "Overdue", value: stats.overdue, color: stats.overdue > 0 ? "text-red-400" : "text-gray-400" },
          ].map((stat) => (
            <Card key={stat.label} className="text-center py-4">
              <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
              <p className="text-xs text-gray-500 mt-1">{stat.label}</p>
            </Card>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="tabs">
        {["all", "active", "completed"].map((status) => (
          <button
            key={status}
            onClick={() => setFilter(status)}
            className={`tab ${filter === status ? "tab-active" : ""}`}
          >
            {status === "all"
              ? "All Goals"
              : status === "active"
              ? "In Progress"
              : "Completed"}
            <span className="ml-1.5 text-xs opacity-60">
              (
              {status === "all"
                ? goals.length
                : goals.filter((g) => g.status === status).length}
              )
            </span>
          </button>
        ))}
      </div>

      {/* Goals Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <div className="h-4 bg-gray-800 rounded w-3/4 mb-4" />
              <div className="h-3 bg-gray-800 rounded w-1/2" />
            </Card>
          ))}
        </div>
      ) : filteredGoals.length === 0 ? (
        <Card className="text-center py-12">
          <Target className="w-12 h-12 mx-auto mb-4 text-gray-700" />
          <h3 className="text-lg font-medium text-gray-300 mb-2">
            No goals found
          </h3>
          <p className="text-gray-500 mb-4">
            Create your first goal to start tracking progress
          </p>
          <Button
            leftIcon={<Plus className="w-4 h-4" />}
            onClick={() => setShowCreateModal(true)}
          >
            Create Goal
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredGoals.map((goal) => {
            const progress = getProgressPercentage(goal);
            const linkedWorkflow = workflows.find((w) => w.id === goal.workflow_id);

            return (
              <Card key={goal.id} hover className="relative">
                {goal.status === "completed" && (
                  <div className="absolute top-4 right-4">
                    <CheckCircle2 className="w-5 h-5 text-green-400" />
                  </div>
                )}

                <div className="flex items-start gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-indigo-500/20 flex items-center justify-center">
                    <Target className="w-5 h-5 text-indigo-400" />
                  </div>
                  <div className="flex-1 min-w-0 pr-6">
                    <h3 className="font-semibold text-white truncate">
                      {goal.title}
                    </h3>
                    {goal.deadline && (
                      <p className={`text-xs mt-0.5 flex items-center gap-1 ${
                        isOverdue(goal.deadline) && goal.status !== "completed"
                          ? "text-red-400"
                          : "text-gray-500"
                      }`}>
                        <Clock className="w-3 h-3" />
                        Due: {new Date(goal.deadline).toLocaleDateString()}
                        {isOverdue(goal.deadline) && goal.status !== "completed" && (
                          <Badge variant="error" size="sm" className="ml-1">Overdue</Badge>
                        )}
                      </p>
                    )}
                  </div>
                </div>

                <p className="text-sm text-gray-400 mb-4 line-clamp-2">
                  {goal.description || "No description"}
                </p>

                {/* Workflow Link */}
                <div className="mb-4">
                  {linkedWorkflow ? (
                    <div className="flex items-center gap-2 text-xs text-indigo-400 bg-indigo-500/10 rounded-lg p-2">
                      <Link2 className="w-3.5 h-3.5" />
                      <span className="truncate">{linkedWorkflow.name}</span>
                      <button
                        onClick={() => openLinkModal(goal)}
                        className="ml-auto text-gray-400 hover:text-white"
                      >
                        Change
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => openLinkModal(goal)}
                      className="flex items-center gap-2 text-xs text-gray-500 hover:text-gray-300 transition-colors"
                    >
                      <Link2 className="w-3.5 h-3.5" />
                      Link to workflow
                    </button>
                  )}
                </div>

                {/* Progress */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-400">Progress</span>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        value={goal.current_value}
                        onChange={(e) => handleUpdateProgress(goal, Number(e.target.value))}
                        className="w-16 bg-gray-800 border border-gray-700 rounded px-2 py-1 text-right text-sm text-white"
                        min={0}
                        max={goal.target_value}
                      />
                      <span className="text-gray-400">/</span>
                      <span className="font-medium text-white">
                        {goal.target_value}
                        {goal.unit}
                      </span>
                    </div>
                  </div>
                  <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        goal.status === "completed"
                          ? "bg-green-500"
                          : progress >= 75
                          ? "bg-indigo-500"
                          : progress >= 50
                          ? "bg-blue-500"
                          : "bg-yellow-500"
                      }`}
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-500">{progress}% complete</span>
                    <button
                      onClick={() => handleEditGoal(goal)}
                      className="text-gray-500 hover:text-white transition-colors"
                    >
                      Edit
                    </button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Create/Edit Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-lg">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-white">
                {editingGoal ? "Edit Goal" : "Create Goal"}
              </h2>
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  resetForm();
                }}
                className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            <div className="space-y-4">
              <Input
                label="Goal Title"
                placeholder="Enter goal title"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              />

              <Textarea
                label="Description"
                placeholder="Describe this goal"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
              />

              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="Target Value"
                  type="number"
                  value={formData.target_value}
                  onChange={(e) => setFormData({ ...formData, target_value: Number(e.target.value) })}
                />
                <Select
                  label="Unit"
                  options={unitOptions}
                  value={formData.unit}
                  onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                />
              </div>

              <Input
                label="Deadline"
                type="date"
                value={formData.deadline}
                onChange={(e) => setFormData({ ...formData, deadline: e.target.value })}
              />

              <Select
                label="Status"
                options={statusOptions}
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
              />

              {workflows.length > 0 && (
                <Select
                  label="Link to Workflow (Optional)"
                  options={[
                    { value: "", label: "No workflow linked" },
                    ...workflows.map((w) => ({
                      value: w.id,
                      label: `${w.name} (${w.workflow_type})`,
                    })),
                  ]}
                  value={formData.workflow_id}
                  onChange={(e) => setFormData({ ...formData, workflow_id: e.target.value })}
                />
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-3 mt-6 pt-4 border-t border-gray-800">
              <Button
                variant="ghost"
                onClick={() => {
                  setShowCreateModal(false);
                  resetForm();
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={handleCreateGoal}
                disabled={!formData.title}
              >
                {editingGoal ? "Update Goal" : "Create Goal"}
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* Link Workflow Modal */}
      {showLinkModal && linkingGoal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-md">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-white">
                Link Workflow
              </h2>
              <button
                onClick={() => {
                  setShowLinkModal(false);
                  setLinkingGoal(null);
                }}
                className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            <p className="text-sm text-gray-400 mb-4">
              Link "{linkingGoal.title}" to a workflow to track progress automatically.
            </p>

            <Select
              label="Select Workflow"
              options={[
                { value: "", label: "No workflow linked" },
                ...workflows.map((w) => ({
                  value: w.id,
                  label: `${w.name} (${w.workflow_type})`,
                })),
              ]}
              value={formData.workflow_id}
              onChange={(e) => setFormData({ ...formData, workflow_id: e.target.value })}
            />

            <div className="flex items-center justify-end gap-3 mt-6 pt-4 border-t border-gray-800">
              <Button
                variant="ghost"
                onClick={() => {
                  setShowLinkModal(false);
                  setLinkingGoal(null);
                }}
              >
                Cancel
              </Button>
              <Button onClick={handleLinkWorkflow}>
                Link Workflow
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
