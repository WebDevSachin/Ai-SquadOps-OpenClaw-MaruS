"use client";

import { useState } from "react";
import { RefreshCw, Plus, Play, Pause, MoreVertical, Clock } from "lucide-react";
import { Card, Button, Badge } from "@/components/ui";

const schedules = [
  {
    id: "1",
    name: "Daily Report Generation",
    description: "Generate daily analytics report and send to team",
    frequency: "0 9 * * *",
    nextRun: "Tomorrow at 9:00 AM",
    status: "active",
    agent: "Business Analyst",
  },
  {
    id: "2",
    name: "Database Backup",
    description: "Create automated backup of production database",
    frequency: "0 2 * * *",
    nextRun: "Today at 2:00 AM",
    status: "active",
    agent: "DevOps Agent",
  },
  {
    id: "3",
    name: "Code Review Reminder",
    description: "Send reminders for pending code reviews",
    frequency: "0 10 * * 1-5",
    nextRun: "Monday at 10:00 AM",
    status: "paused",
    agent: "Engineering Lead",
  },
  {
    id: "4",
    name: "Weekly Summary",
    description: "Generate and send weekly team summary",
    frequency: "0 17 * * 5",
    nextRun: "Friday at 5:00 PM",
    status: "active",
    agent: "Business Analyst",
  },
];

export default function RecurringPage() {
  return (
    <div className="space-y-8 fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="page-title">Recurring Tasks</h1>
          <p className="page-subtitle">
            Manage scheduled and automated tasks
          </p>
        </div>
        <Button leftIcon={<Plus className="w-4 h-4" />}>
          New Schedule
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "Total", value: schedules.length },
          { label: "Active", value: schedules.filter((s) => s.status === "active").length },
          { label: "Paused", value: schedules.filter((s) => s.status === "paused").length },
          { label: "Runs Today", value: 2 },
        ].map((stat) => (
          <Card key={stat.label} className="text-center py-4">
            <p className="text-2xl font-bold text-white">{stat.value}</p>
            <p className="text-xs text-gray-500 mt-1">{stat.label}</p>
          </Card>
        ))}
      </div>

      {/* Schedules List */}
      <div className="space-y-4">
        {schedules.map((schedule) => (
          <Card key={schedule.id} hover className="flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="font-semibold text-white">{schedule.name}</h3>
                <Badge
                  variant={schedule.status === "active" ? "success" : "default"}
                  size="sm"
                >
                  {schedule.status}
                </Badge>
              </div>
              <p className="text-sm text-gray-400 mb-2">
                {schedule.description}
              </p>
              <div className="flex flex-wrap items-center gap-4 text-xs text-gray-500">
                <span className="flex items-center gap-1">
                  <RefreshCw className="w-3 h-3" />
                  {schedule.frequency}
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  Next: {schedule.nextRun}
                </span>
                <span>Agent: {schedule.agent}</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                className={`p-2 rounded-lg transition-colors ${
                  schedule.status === "active"
                    ? "text-yellow-400 hover:bg-yellow-400/10"
                    : "text-green-400 hover:bg-green-400/10"
                }`}
                title={schedule.status === "active" ? "Pause" : "Resume"}
              >
                {schedule.status === "active" ? (
                  <Pause className="w-5 h-5" />
                ) : (
                  <Play className="w-5 h-5" />
                )}
              </button>
              <button
                className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
                title="More options"
              >
                <MoreVertical className="w-5 h-5" />
              </button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
