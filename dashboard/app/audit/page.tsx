"use client";

import { useState } from "react";
import { ScrollText, Download, Filter, Calendar } from "lucide-react";
import { Card, Button, Badge } from "@/components/ui";

const auditEntries = [
  {
    id: "1",
    action: "Created task",
    agent: "Engineering Lead",
    details: "Task: Implement user authentication",
    timestamp: "2024-01-15 14:30:22",
    type: "create",
  },
  {
    id: "2",
    action: "Approved deployment",
    agent: "DevOps Agent",
    details: "Deployment v2.4.0 to production",
    timestamp: "2024-01-15 14:25:10",
    type: "approve",
  },
  {
    id: "3",
    action: "Updated configuration",
    agent: "Business Analyst",
    details: "Changed API rate limits",
    timestamp: "2024-01-15 13:45:33",
    type: "update",
  },
  {
    id: "4",
    action: "Failed task",
    agent: "Engineering Lead",
    details: "Database migration failed: Connection timeout",
    timestamp: "2024-01-15 12:20:15",
    type: "error",
  },
  {
    id: "5",
    action: "Deleted agent",
    agent: "Admin",
    details: "Removed unused testing agent",
    timestamp: "2024-01-15 11:10:00",
    type: "delete",
  },
];

const typeColors: Record<string, { variant: "default" | "primary" | "success" | "warning" | "error"; label: string }> = {
  create: { variant: "success", label: "Create" },
  update: { variant: "primary", label: "Update" },
  delete: { variant: "error", label: "Delete" },
  approve: { variant: "success", label: "Approve" },
  error: { variant: "error", label: "Error" },
};

export default function AuditPage() {
  const [filter, setFilter] = useState("all");

  const filteredEntries =
    filter === "all"
      ? auditEntries
      : auditEntries.filter((e) => e.type === filter);

  return (
    <div className="space-y-8 fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="page-title">Audit Log</h1>
          <p className="page-subtitle">
            Track all agent activities and system events
          </p>
        </div>
        <Button variant="secondary" leftIcon={<Download className="w-4 h-4" />}>
          Export CSV
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="tabs">
          {["all", "create", "update", "delete", "error"].map((type) => (
            <button
              key={type}
              onClick={() => setFilter(type)}
              className={`tab ${filter === type ? "tab-active" : ""}`}
            >
              {type.charAt(0).toUpperCase() + type.slice(1)}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" leftIcon={<Calendar className="w-4 h-4" />}>
            Date Range
          </Button>
          <Button variant="ghost" size="sm" leftIcon={<Filter className="w-4 h-4" />}>
            Filter
          </Button>
        </div>
      </div>

      {/* Audit Table */}
      <Card className="overflow-hidden !p-0">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-800 bg-gray-900/50">
                <th className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wider px-6 py-4">
                  Action
                </th>
                <th className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wider px-6 py-4">
                  Agent
                </th>
                <th className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wider px-6 py-4">
                  Details
                </th>
                <th className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wider px-6 py-4">
                  Timestamp
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/50">
              {filteredEntries.map((entry) => {
                const type = typeColors[entry.type] || typeColors.update;
                return (
                  <tr
                    key={entry.id}
                    className="hover:bg-gray-800/30 transition-colors"
                  >
                    <td className="px-6 py-4">
                      <Badge variant={type.variant} size="sm">
                        {type.label}
                      </Badge>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-gray-700 to-gray-600 flex items-center justify-center text-xs font-medium text-white">
                          {entry.agent
                            .split(" ")
                            .map((n) => n[0])
                            .join("")}
                        </div>
                        <span className="text-sm text-gray-200">
                          {entry.agent}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div>
                        <p className="text-sm font-medium text-gray-200">
                          {entry.action}
                        </p>
                        <p className="text-xs text-gray-500">{entry.details}</p>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm text-gray-400 font-mono">
                        {entry.timestamp}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">
          Showing {filteredEntries.length} of {auditEntries.length} entries
        </p>
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" disabled>
            Previous
          </Button>
          <Button variant="secondary" size="sm" disabled>
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}
