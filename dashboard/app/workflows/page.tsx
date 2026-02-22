"use client";

import { useEffect, useState } from "react";
import {
  Workflow,
  Plus,
  Play,
  Settings,
  Trash2,
  ArrowRight,
  GitBranch,
  Layers,
  X,
  Check,
  Clock,
  AlertCircle,
} from "lucide-react";
import { Card, Button, Badge, Input, Textarea, Select, useToastHelpers } from "@/components/ui";
import api from "@/lib/api";

interface Agent {
  id: string;
  name: string;
  specialty: string;
  squad: string;
  status: string;
}

interface WorkflowStep {
  id?: string;
  step_order: number;
  agent_id: string;
  name: string;
  step_type: string;
  config: Record<string, any>;
  condition_expression?: string;
  true_step_id?: string;
  false_step_id?: string;
}

interface Workflow {
  id: string;
  name: string;
  description: string;
  workflow_type: string;
  status: string;
  steps: WorkflowStep[];
  created_at: string;
}

const workflowTypeOptions = [
  { value: "sequential", label: "Sequential" },
  { value: "parallel", label: "Parallel" },
  { value: "conditional", label: "Conditional" },
];

const statusOptions = [
  { value: "active", label: "Active" },
  { value: "paused", label: "Paused" },
  { value: "archived", label: "Archived" },
];

export default function WorkflowsPage() {
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingWorkflow, setEditingWorkflow] = useState<Workflow | null>(null);
  const [executingWorkflowId, setExecutingWorkflowId] = useState<string | null>(null);
  const { success, error } = useToastHelpers();

  // Form state
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    workflow_type: "sequential",
    status: "active",
  });
  const [steps, setSteps] = useState<WorkflowStep[]>([]);

  useEffect(() => {
    fetchWorkflows();
    fetchAgents();
  }, []);

  const fetchWorkflows = async () => {
    try {
      const res = await api.get("/workflows");
      setWorkflows(res.data.workflows || []);
    } catch (err) {
      console.error("Failed to fetch workflows:", err);
      error("Failed to load workflows");
    } finally {
      setLoading(false);
    }
  };

  const fetchAgents = async () => {
    try {
      const res = await api.get("/agents");
      setAgents(res.data.agents || []);
    } catch (err) {
      console.error("Failed to fetch agents:", err);
    }
  };

  const handleCreateWorkflow = async () => {
    try {
      const payload = {
        ...formData,
        steps,
      };
      
      if (editingWorkflow) {
        await api.patch(`/workflows/${editingWorkflow.id}`, payload);
        success("Workflow updated successfully");
      } else {
        await api.post("/workflows", payload);
        success("Workflow created successfully");
      }
      
      setShowCreateModal(false);
      resetForm();
      fetchWorkflows();
    } catch (err: any) {
      error(err.response?.data?.error || "Failed to save workflow");
    }
  };

  const handleDeleteWorkflow = async (id: string) => {
    if (!confirm("Are you sure you want to delete this workflow?")) return;
    
    try {
      await api.delete(`/workflows/${id}`);
      success("Workflow deleted successfully");
      fetchWorkflows();
    } catch (err) {
      error("Failed to delete workflow");
    }
  };

  const handleExecuteWorkflow = async (id: string) => {
    setExecutingWorkflowId(id);
    try {
      const res = await api.post(`/workflows/${id}/execute`, {});
      success("Workflow executed successfully");
      console.log("Execution result:", res.data);
    } catch (err: any) {
      error(err.response?.data?.error || "Workflow execution failed");
    } finally {
      setExecutingWorkflowId(null);
    }
  };

  const handleEditWorkflow = (workflow: Workflow) => {
    setEditingWorkflow(workflow);
    setFormData({
      name: workflow.name,
      description: workflow.description || "",
      workflow_type: workflow.workflow_type,
      status: workflow.status,
    });
    setSteps(workflow.steps || []);
    setShowCreateModal(true);
  };

  const resetForm = () => {
    setFormData({
      name: "",
      description: "",
      workflow_type: "sequential",
      status: "active",
    });
    setSteps([]);
    setEditingWorkflow(null);
  };

  const addStep = () => {
    setSteps([
      ...steps,
      {
        step_order: steps.length + 1,
        agent_id: "",
        name: `Step ${steps.length + 1}`,
        step_type: "agent",
        config: {},
      },
    ]);
  };

  const removeStep = (index: number) => {
    const newSteps = [...steps];
    newSteps.splice(index, 1);
    // Update order
    newSteps.forEach((step, i) => {
      step.step_order = i + 1;
    });
    setSteps(newSteps);
  };

  const updateStep = (index: number, field: keyof WorkflowStep, value: any) => {
    const newSteps = [...steps];
    (newSteps[index] as any)[field] = value;
    setSteps(newSteps);
  };

  const getWorkflowTypeIcon = (type: string) => {
    switch (type) {
      case "sequential":
        return <ArrowRight className="w-4 h-4" />;
      case "parallel":
        return <Layers className="w-4 h-4" />;
      case "conditional":
        return <GitBranch className="w-4 h-4" />;
      default:
        return <Workflow className="w-4 h-4" />;
    }
  };

  const stats = {
    total: workflows.length,
    active: workflows.filter((w) => w.status === "active").length,
    sequential: workflows.filter((w) => w.workflow_type === "sequential").length,
    parallel: workflows.filter((w) => w.workflow_type === "parallel").length,
  };

  return (
    <div className="space-y-8 fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="page-title">Workflows</h1>
          <p className="page-subtitle">
            Create and manage multi-agent workflows
          </p>
        </div>
        <Button
          leftIcon={<Plus className="w-4 h-4" />}
          onClick={() => {
            resetForm();
            setShowCreateModal(true);
          }}
        >
          New Workflow
        </Button>
      </div>

      {/* Stats */}
      {!loading && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: "Total Workflows", value: stats.total, color: "text-white" },
            { label: "Active", value: stats.active, color: "text-green-400" },
            { label: "Sequential", value: stats.sequential, color: "text-blue-400" },
            { label: "Parallel", value: stats.parallel, color: "text-purple-400" },
          ].map((stat) => (
            <Card key={stat.label} className="text-center py-4">
              <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
              <p className="text-xs text-gray-500 mt-1">{stat.label}</p>
            </Card>
          ))}
        </div>
      )}

      {/* Workflows Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <div className="h-4 bg-gray-800 rounded w-3/4 mb-4" />
              <div className="h-3 bg-gray-800 rounded w-1/2" />
            </Card>
          ))}
        </div>
      ) : workflows.length === 0 ? (
        <Card className="text-center py-12">
          <Workflow className="w-12 h-12 mx-auto mb-4 text-gray-700" />
          <h3 className="text-lg font-medium text-gray-300 mb-2">
            No workflows yet
          </h3>
          <p className="text-gray-500 mb-4">
            Create your first multi-agent workflow to get started
          </p>
          <Button
            leftIcon={<Plus className="w-4 h-4" />}
            onClick={() => setShowCreateModal(true)}
          >
            Create Workflow
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {workflows.map((workflow) => (
            <Card key={workflow.id} hover className="relative">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-indigo-500/20 flex items-center justify-center">
                    {getWorkflowTypeIcon(workflow.workflow_type)}
                  </div>
                  <div>
                    <h3 className="font-semibold text-white">{workflow.name}</h3>
                    <p className="text-xs text-gray-500 capitalize">
                      {workflow.workflow_type}
                    </p>
                  </div>
                </div>
                <Badge
                  variant={workflow.status === "active" ? "success" : "default"}
                  size="sm"
                >
                  {workflow.status}
                </Badge>
              </div>

              <p className="text-sm text-gray-400 mb-4 line-clamp-2">
                {workflow.description || "No description"}
              </p>

              {/* Steps Preview */}
              <div className="flex items-center gap-2 mb-4 text-xs text-gray-500">
                <Layers className="w-3.5 h-3.5" />
                <span>{workflow.steps?.length || 0} steps</span>
                {workflow.steps && workflow.steps.length > 0 && (
                  <>
                    <span>•</span>
                    <span className="truncate">
                      {workflow.steps
                        .slice(0, 3)
                        .map((s) => s.name)
                        .join(", ")}
                      {workflow.steps.length > 3 && ` +${workflow.steps.length - 3}`}
                    </span>
                  </>
                )}
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 pt-4 border-t border-gray-800">
                <Button
                  size="sm"
                  variant="primary"
                  leftIcon={<Play className="w-3.5 h-3.5" />}
                  onClick={() => handleExecuteWorkflow(workflow.id)}
                  loading={executingWorkflowId === workflow.id}
                  className="flex-1"
                >
                  Run
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  leftIcon={<Settings className="w-3.5 h-3.5" />}
                  onClick={() => handleEditWorkflow(workflow)}
                >
                  Edit
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleDeleteWorkflow(workflow.id)}
                  className="!p-2"
                >
                  <Trash2 className="w-3.5 h-3.5 text-red-400" />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Create/Edit Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-white">
                {editingWorkflow ? "Edit Workflow" : "Create Workflow"}
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

            <div className="space-y-6">
              {/* Basic Info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  label="Workflow Name"
                  placeholder="Enter workflow name"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                />
                <Select
                  label="Workflow Type"
                  options={workflowTypeOptions}
                  value={formData.workflow_type}
                  onChange={(e) =>
                    setFormData({ ...formData, workflow_type: e.target.value })
                  }
                />
              </div>

              <Textarea
                label="Description"
                placeholder="Describe what this workflow does"
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                rows={2}
              />

              <Select
                label="Status"
                options={statusOptions}
                value={formData.status}
                onChange={(e) =>
                  setFormData({ ...formData, status: e.target.value })
                }
              />

              {/* Workflow Type Info */}
              <div className="bg-gray-800/50 rounded-lg p-4">
                <h3 className="text-sm font-medium text-gray-300 mb-2">
                  Workflow Type
                </h3>
                <div className="grid grid-cols-3 gap-3 text-xs text-gray-400">
                  <div className={`p-2 rounded ${formData.workflow_type === 'sequential' ? 'bg-indigo-500/20 text-indigo-400' : 'bg-gray-800'}`}>
                    <ArrowRight className="w-4 h-4 mb-1 mx-auto" />
                    Sequential
                    <p className="mt-1 opacity-60">Agent A → Agent B → Agent C</p>
                  </div>
                  <div className={`p-2 rounded ${formData.workflow_type === 'parallel' ? 'bg-purple-500/20 text-purple-400' : 'bg-gray-800'}`}>
                    <Layers className="w-4 h-4 mb-1 mx-auto" />
                    Parallel
                    <p className="mt-1 opacity-60">Agent A, B, C run simultaneously</p>
                  </div>
                  <div className={`p-2 rounded ${formData.workflow_type === 'conditional' ? 'bg-green-500/20 text-green-400' : 'bg-gray-800'}`}>
                    <GitBranch className="w-4 h-4 mb-1 mx-auto" />
                    Conditional
                    <p className="mt-1 opacity-60">If X then A else B</p>
                  </div>
                </div>
              </div>

              {/* Steps */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-medium text-gray-300">Workflow Steps</h3>
                  <Button size="sm" variant="ghost" leftIcon={<Plus className="w-3.5 h-3.5" />} onClick={addStep}>
                    Add Step
                  </Button>
                </div>

                {steps.length === 0 ? (
                  <div className="text-center py-8 border-2 border-dashed border-gray-800 rounded-lg">
                    <Workflow className="w-8 h-8 mx-auto mb-2 text-gray-700" />
                    <p className="text-sm text-gray-500">No steps added yet</p>
                    <p className="text-xs text-gray-600 mt-1">Add agents to build your workflow</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {steps.map((step, index) => (
                      <div
                        key={index}
                        className="flex items-center gap-3 p-3 bg-gray-800/50 rounded-lg"
                      >
                        <div className="w-8 h-8 rounded-full bg-indigo-500/20 flex items-center justify-center text-indigo-400 text-sm font-medium">
                          {index + 1}
                        </div>
                        
                        {formData.workflow_type === "sequential" && index < steps.length - 1 && (
                          <ArrowRight className="w-4 h-4 text-gray-600" />
                        )}
                        
                        {formData.workflow_type === "parallel" && index < steps.length - 1 && (
                          <Layers className="w-4 h-4 text-gray-600" />
                        )}
                        
                        {formData.workflow_type === "conditional" && index < steps.length - 1 && (
                          <GitBranch className="w-4 h-4 text-gray-600" />
                        )}

                        <div className="flex-1 grid grid-cols-2 gap-3">
                          <Input
                            placeholder="Step name"
                            value={step.name}
                            onChange={(e) => updateStep(index, "name", e.target.value)}
                            className="!py-2"
                          />
                          <Select
                            options={[
                              { value: "", label: "Select agent" },
                              ...agents.map((a) => ({
                                value: a.id,
                                label: `${a.name} (${a.specialty})`,
                              })),
                            ]}
                            value={step.agent_id}
                            onChange={(e) => updateStep(index, "agent_id", e.target.value)}
                            className="!py-2"
                          />
                        </div>

                        {formData.workflow_type === "conditional" && step.step_type === "condition" && (
                          <div className="flex items-center gap-2">
                            <Input
                              placeholder="Condition (e.g., input.value > 10)"
                              value={step.condition_expression || ""}
                              onChange={(e) => updateStep(index, "condition_expression", e.target.value)}
                              className="!py-2 w-48"
                            />
                          </div>
                        )}

                        <button
                          onClick={() => removeStep(index)}
                          className="p-2 hover:bg-red-500/20 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-4 h-4 text-red-400" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
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
                onClick={handleCreateWorkflow}
                disabled={!formData.name || steps.length === 0}
                leftIcon={editingWorkflow ? <Check className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
              >
                {editingWorkflow ? "Update Workflow" : "Create Workflow"}
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
