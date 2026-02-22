"use client";

import { useEffect, useState, useCallback } from "react";
import {
  ListTodo,
  Clock,
  ArrowUpDown,
  Search,
  Plus,
  Filter,
  MoreHorizontal,
  Calendar,
  User,
  AlertCircle,
  CheckCircle2,
  PlayCircle,
  XCircle,
  GripVertical,
  ChevronDown,
} from "lucide-react";
import {
  Card,
  Badge,
  Button,
  SkeletonCard,
  useToastHelpers,
} from "@/components/ui";
import { Breadcrumb, useBreadcrumbs } from "@/components/Breadcrumb";
import api from "@/lib/api";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

interface Task {
  id: string;
  title: string;
  description?: string;
  agent_name?: string;
  agentName?: string;
  assigned_to?: string;
  assignedTo?: string;
  status: string;
  priority?: string;
  created_at?: string;
  createdAt?: string;
  due_date?: string;
  dueDate?: string;
  completed_at?: string;
  completedAt?: string;
}

interface Agent {
  id: string;
  name: string;
}

const COLUMNS = [
  { key: "pending", label: "Pending", icon: Clock, color: "yellow" },
  { key: "in_progress", label: "In Progress", icon: PlayCircle, color: "blue" },
  { key: "completed", label: "Completed", icon: CheckCircle2, color: "green" },
  { key: "failed", label: "Failed", icon: XCircle, color: "red" },
];

const PRIORITIES = ["high", "medium", "low"];

const columnColors: Record<string, { bg: string; border: string; badge: string; card: string }> = {
  pending: {
    bg: "bg-yellow-500/10",
    border: "border-yellow-500/30",
    badge: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
    card: "hover:border-yellow-500/40",
  },
  in_progress: {
    bg: "bg-blue-500/10",
    border: "border-blue-500/30",
    badge: "bg-blue-500/20 text-blue-400 border-blue-500/30",
    card: "hover:border-blue-500/40",
  },
  completed: {
    bg: "bg-green-500/10",
    border: "border-green-500/30",
    badge: "bg-green-500/20 text-green-400 border-green-500/30",
    card: "hover:border-green-500/40",
  },
  failed: {
    bg: "bg-red-500/10",
    border: "border-red-500/30",
    badge: "bg-red-500/20 text-red-400 border-red-500/30",
    card: "hover:border-red-500/40",
  },
};

const priorityColors: Record<string, string> = {
  high: "text-red-400 bg-red-500/20",
  medium: "text-yellow-400 bg-yellow-500/20",
  low: "text-green-400 bg-green-500/20",
};

// Task Card Component
function TaskCard({
  task,
  onDragStart,
  onDragEnd,
}: {
  task: Task;
  onDragStart: (e: React.DragEvent, task: Task) => void;
  onDragEnd: (e: React.DragEvent) => void;
}) {
  const [isDragging, setIsDragging] = useState(false);

  const handleDragStart = (e: React.DragEvent) => {
    setIsDragging(true);
    onDragStart(e, task);
  };

  const handleDragEnd = (e: React.DragEvent) => {
    setIsDragging(false);
    onDragEnd(e);
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return null;
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  const isOverdue = (dueDate?: string) => {
    if (!dueDate) return false;
    return new Date(dueDate) < new Date();
  };

  const dueDate = task.due_date || task.dueDate;
  const createdDate = task.created_at || task.createdAt;

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      className={`
        group bg-gray-900/80 border border-gray-800 rounded-xl p-4 cursor-grab
        transition-all duration-200 shadow-sm
        ${columnColors[task.status]?.card || ""}
        ${isDragging ? "opacity-50 scale-95 rotate-2" : "hover:shadow-lg hover:scale-[1.02]"}
      `}
    >
      {/* Drag Handle */}
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-1 text-gray-600 opacity-0 group-hover:opacity-100 transition-opacity">
          <GripVertical className="w-4 h-4" />
        </div>
        {task.priority && (
          <span
            className={`text-xs px-2 py-0.5 rounded-full capitalize ${
              priorityColors[task.priority] || "bg-gray-700 text-gray-400"
            }`}
          >
            {task.priority}
          </span>
        )}
      </div>

      {/* Title */}
      <h4 className="text-sm font-medium text-gray-200 mb-2 line-clamp-2">
        {task.title}
      </h4>

      {/* Description */}
      {task.description && (
        <p className="text-xs text-gray-500 mb-3 line-clamp-2">
          {task.description}
        </p>
      )}

      {/* Meta */}
      <div className="flex items-center justify-between text-xs text-gray-500 mt-3 pt-3 border-t border-gray-800">
        <div className="flex items-center gap-2">
          <User className="w-3 h-3" />
          <span className="truncate max-w-[80px]">
            {task.agent_name || task.agentName || task.assigned_to || task.assignedTo || "Unassigned"}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <Calendar className="w-3 h-3" />
          <span className={isOverdue(dueDate) ? "text-red-400" : ""}>
            {formatDate(dueDate) || formatDate(createdDate) || "—"}
          </span>
        </div>
      </div>
    </div>
  );
}

// Column Component
function KanbanColumn({
  column,
  tasks,
  onDragStart,
  onDragEnd,
  onTaskClick,
}: {
  column: (typeof COLUMNS)[0];
  tasks: Task[];
  onDragStart: (e: React.DragEvent, task: Task) => void;
  onDragEnd: (e: React.DragEvent) => void;
  onTaskClick: (task: Task) => void;
}) {
  const colors = columnColors[column.key];
  const Icon = column.icon;

  return (
    <div className="flex-shrink-0 w-80">
      {/* Column Header */}
      <div className={`flex items-center justify-between mb-4 p-3 rounded-xl ${colors.bg} border ${colors.border}`}>
        <div className="flex items-center gap-2">
          <Icon className={`w-4 h-4 text-${column.color}-400`} />
          <span className="font-medium text-white">{column.label}</span>
          <span className={`text-xs px-2 py-0.5 rounded-full bg-gray-800 text-gray-400`}>
            {tasks.length}
          </span>
        </div>
      </div>

      {/* Tasks Container */}
      <div
        className="space-y-3 min-h-[200px] max-h-[calc(100vh-300px)] overflow-y-auto p-2 scrollbar-thin"
        style={{
          scrollbarWidth: "thin",
          scrollbarColor: "#374151 #111827",
        }}
      >
        {tasks.length === 0 ? (
          <div className="flex items-center justify-center h-32 border-2 border-dashed border-gray-800 rounded-xl">
            <p className="text-sm text-gray-500">No tasks</p>
          </div>
        ) : (
          tasks.map((task) => (
            <div
              key={task.id}
              onClick={() => onTaskClick(task)}
              className="cursor-pointer"
            >
              <TaskCard task={task} onDragStart={onDragStart} onDragEnd={onDragEnd} />
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// Filter Dropdown Component
function FilterDropdown({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 text-sm bg-gray-900 border border-gray-800 rounded-lg hover:border-gray-700 transition-colors"
      >
        <Filter className="w-4 h-4 text-gray-400" />
        <span className="text-gray-300">
          {label}: {value === "all" ? "All" : options.find((o) => o.value === value)?.label || value}
        </span>
        <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)} />
          <div className="absolute top-full mt-1 left-0 z-20 bg-gray-900 border border-gray-800 rounded-lg shadow-xl py-1 min-w-[150px]">
            {options.map((option) => (
              <button
                key={option.value}
                onClick={() => {
                  onChange(option.value);
                  setIsOpen(false);
                }}
                className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-800 transition-colors ${
                  value === option.value ? "text-indigo-400 bg-indigo-500/10" : "text-gray-300"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterPriority, setFilterPriority] = useState("all");
  const [filterAssignee, setFilterAssignee] = useState("all");
  const [filterDate, setFilterDate] = useState("all");
  const [draggedTask, setDraggedTask] = useState<Task | null>(null);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const { success, error } = useToastHelpers();
  const breadcrumbs = useBreadcrumbs();

  const fetchTasks = useCallback(async () => {
    try {
      const res = await api.get("/tasks?limit=100");
      const data = res.data;
      setTasks(Array.isArray(data) ? data : data.tasks || []);
    } catch (err) {
      console.error("Failed to fetch tasks:", err);
      error("Failed to load tasks");
    }
  }, [error]);

  const fetchAgents = useCallback(async () => {
    try {
      const res = await api.get("/agents");
      const data = res.data;
      setAgents(Array.isArray(data) ? data : data.agents || []);
    } catch (err) {
      console.error("Failed to fetch agents:", err);
    }
  }, []);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      await Promise.all([fetchTasks(), fetchAgents()]);
      setLoading(false);
    }
    fetchData();
  }, [fetchTasks, fetchAgents]);

  // Filter tasks
  const filteredTasks = tasks.filter((task) => {
    const matchesSearch =
      searchQuery === "" ||
      task.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (task.agent_name || task.agentName || "").toLowerCase().includes(searchQuery.toLowerCase());

    const matchesPriority = filterPriority === "all" || task.priority === filterPriority;

    const matchesAssignee =
      filterAssignee === "all" ||
      task.assigned_to === filterAssignee ||
      task.assignedTo === filterAssignee ||
      task.agent_name === filterAssignee ||
      task.agentName === filterAssignee;

    let matchesDate = true;
    if (filterDate !== "all") {
      const taskDate = new Date(task.created_at || task.createdAt || "");
      const now = new Date();
      const daysDiff = Math.floor((now.getTime() - taskDate.getTime()) / (1000 * 60 * 60 * 24));

      if (filterDate === "today") matchesDate = daysDiff === 0;
      else if (filterDate === "week") matchesDate = daysDiff <= 7;
      else if (filterDate === "month") matchesDate = daysDiff <= 30;
    }

    return matchesSearch && matchesPriority && matchesAssignee && matchesDate;
  });

  // Group tasks by status
  const tasksByStatus = COLUMNS.reduce((acc, column) => {
    acc[column.key] = filteredTasks.filter((task) => task.status === column.key);
    return acc;
  }, {} as Record<string, Task[]>);

  // Drag and drop handlers
  const handleDragStart = (e: React.DragEvent, task: Task) => {
    setDraggedTask(task);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", task.id);
  };

  const handleDragEnd = () => {
    setDraggedTask(null);
  };

  const handleDrop = async (e: React.DragEvent, newStatus: string) => {
    e.preventDefault();
    if (!draggedTask || draggedTask.status === newStatus) return;

    // Optimistically update the UI
    const updatedTasks = tasks.map((task) =>
      task.id === draggedTask.id ? { ...task, status: newStatus } : task
    );
    setTasks(updatedTasks);

    // Update on the server
    try {
      await api.patch(`/tasks/${draggedTask.id}`, { status: newStatus });
      success(`Task moved to ${COLUMNS.find((c) => c.key === newStatus)?.label}`);
    } catch (err) {
      console.error("Failed to update task status:", err);
      // Revert on error
      setTasks(tasks);
      error("Failed to update task");
    }

    setDraggedTask(null);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const priorityOptions = [
    { value: "all", label: "All Priorities" },
    ...PRIORITIES.map((p) => ({ value: p, label: p.charAt(0).toUpperCase() + p.slice(1) })),
  ];

  const assigneeOptions = [
    { value: "all", label: "All Assignees" },
    ...agents.map((a) => ({ value: a.name, label: a.name })),
  ];

  const dateOptions = [
    { value: "all", label: "All Time" },
    { value: "today", label: "Today" },
    { value: "week", label: "This Week" },
    { value: "month", label: "This Month" },
  ];

  const stats = {
    total: tasks.length,
    pending: tasks.filter((t) => t.status === "pending").length,
    inProgress: tasks.filter((t) => t.status === "in_progress").length,
    completed: tasks.filter((t) => t.status === "completed").length,
    failed: tasks.filter((t) => t.status === "failed").length,
  };

  if (loading) {
    return (
      <div className="space-y-8 fade-in">
        {/* Breadcrumb */}
        <Breadcrumb items={breadcrumbs} />
        
        <div className="flex justify-between items-center">
          <div>
            <h1 className="page-title">Tasks</h1>
            <p className="page-subtitle">Track and manage agent tasks</p>
          </div>
        </div>
        <div className="grid grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
        <div className="flex gap-4 overflow-x-auto pb-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="w-80 flex-shrink-0">
              <div className="h-12 bg-gray-800 rounded-xl mb-4 animate-pulse" />
              <div className="space-y-3">
                {[...Array(3)].map((_, j) => (
                  <div key={j} className="h-32 bg-gray-900 rounded-xl animate-pulse" />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 fade-in">
      {/* Breadcrumb */}
      <Breadcrumb items={breadcrumbs} />
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="page-title">Tasks</h1>
          <p className="page-subtitle">Track and manage agent tasks with Kanban board</p>
        </div>
        <Button leftIcon={<Plus className="w-4 h-4" />}>
          New Task
        </Button>
      </div>

      {/* Stats Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
        {[
          { label: "Total", value: stats.total, color: "text-white" },
          { label: "Pending", value: stats.pending, color: "text-yellow-400" },
          { label: "In Progress", value: stats.inProgress, color: "text-blue-400" },
          { label: "Completed", value: stats.completed, color: "text-green-400" },
          { label: "Failed", value: stats.failed, color: "text-red-400" },
        ].map((stat) => (
          <div
            key={stat.label}
            className="card p-3 flex items-center justify-between"
          >
            <span className="text-sm text-gray-400">{stat.label}</span>
            <span className={`text-xl font-bold ${stat.color}`}>
              {stat.value}
            </span>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
        {/* Search */}
        <div className="relative w-full lg:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text"
            placeholder="Search tasks..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="input-with-icon text-sm w-full"
          />
        </div>

        {/* Filter Dropdowns */}
        <div className="flex flex-wrap gap-2">
          <FilterDropdown
            label="Priority"
            value={filterPriority}
            options={priorityOptions}
            onChange={setFilterPriority}
          />
          <FilterDropdown
            label="Assignee"
            value={filterAssignee}
            options={assigneeOptions}
            onChange={setFilterAssignee}
          />
          <FilterDropdown
            label="Date"
            value={filterDate}
            options={dateOptions}
            onChange={setFilterDate}
          />
          {(filterPriority !== "all" || filterAssignee !== "all" || filterDate !== "all") && (
            <button
              onClick={() => {
                setFilterPriority("all");
                setFilterAssignee("all");
                setFilterDate("all");
              }}
              className="px-3 py-2 text-sm text-gray-400 hover:text-white transition-colors"
            >
              Clear filters
            </button>
          )}
        </div>
      </div>

      {/* Kanban Board */}
      <div className="flex gap-4 overflow-x-auto pb-4 -mx-4 px-4">
        {COLUMNS.map((column) => (
          <div
            key={column.key}
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, column.key)}
            className={`flex-shrink-0 transition-colors ${
              draggedTask && draggedTask.status !== column.key
                ? "bg-gray-900/30 rounded-xl"
                : ""
            }`}
          >
            <KanbanColumn
              column={column}
              tasks={tasksByStatus[column.key] || []}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
              onTaskClick={setSelectedTask}
            />
          </div>
        ))}
      </div>

      {/* Task Detail Modal */}
      {selectedTask && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <span
                    className={`px-3 py-1 rounded-full text-sm capitalize ${
                      columnColors[selectedTask.status]?.badge || ""
                    }`}
                  >
                    {selectedTask.status.replace("_", " ")}
                  </span>
                  {selectedTask.priority && (
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs capitalize ${
                        priorityColors[selectedTask.priority] || "bg-gray-700 text-gray-400"
                      }`}
                    >
                      {selectedTask.priority}
                    </span>
                  )}
                </div>
                <button
                  onClick={() => setSelectedTask(null)}
                  className="p-1 text-gray-400 hover:text-white transition-colors"
                >
                  <XCircle className="w-5 h-5" />
                </button>
              </div>

              <h2 className="text-xl font-semibold text-white mb-2">
                {selectedTask.title}
              </h2>

              {selectedTask.description && (
                <p className="text-gray-400 text-sm mb-6">
                  {selectedTask.description}
                </p>
              )}

              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <User className="w-4 h-4 text-gray-500" />
                  <span className="text-sm text-gray-400">Assignee:</span>
                  <span className="text-sm text-white">
                    {selectedTask.agent_name ||
                      selectedTask.agentName ||
                      selectedTask.assigned_to ||
                      selectedTask.assignedTo ||
                      "Unassigned"}
                  </span>
                </div>

                <div className="flex items-center gap-3">
                  <Calendar className="w-4 h-4 text-gray-500" />
                  <span className="text-sm text-gray-400">Due Date:</span>
                  <span className="text-sm text-white">
                    {selectedTask.due_date || selectedTask.dueDate
                      ? new Date(selectedTask.due_date || selectedTask.dueDate || "").toLocaleDateString()
                      : "Not set"}
                  </span>
                </div>

                <div className="flex items-center gap-3">
                  <Clock className="w-4 h-4 text-gray-500" />
                  <span className="text-sm text-gray-400">Created:</span>
                  <span className="text-sm text-white">
                    {selectedTask.created_at || selectedTask.createdAt
                      ? new Date(selectedTask.created_at || selectedTask.createdAt || "").toLocaleDateString()
                      : "Unknown"}
                  </span>
                </div>

                {selectedTask.completed_at || selectedTask.completedAt ? (
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="w-4 h-4 text-green-500" />
                    <span className="text-sm text-gray-400">Completed:</span>
                    <span className="text-sm text-white">
                      {new Date(selectedTask.completed_at || selectedTask.completedAt || "").toLocaleDateString()}
                    </span>
                  </div>
                ) : null}
              </div>

              {/* Quick Actions */}
              <div className="mt-6 pt-6 border-t border-gray-800">
                <p className="text-sm text-gray-400 mb-3">Move to:</p>
                <div className="flex flex-wrap gap-2">
                  {COLUMNS.map((col) => (
                    <Button
                      key={col.key}
                      variant={selectedTask.status === col.key ? "primary" : "secondary"}
                      size="sm"
                      onClick={async () => {
                        if (col.key === selectedTask.status) return;
                        try {
                          await api.patch(`/tasks/${selectedTask.id}`, { status: col.key });
                          setTasks(
                            tasks.map((t) =>
                              t.id === selectedTask.id ? { ...t, status: col.key } : t
                            )
                          );
                          setSelectedTask(null);
                          success(`Task moved to ${col.label}`);
                        } catch (err) {
                          error("Failed to update task");
                        }
                      }}
                    >
                      {col.label}
                    </Button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
