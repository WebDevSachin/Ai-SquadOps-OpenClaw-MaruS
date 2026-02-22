"use client";

import { useState } from "react";
import { ShieldCheck, Check, X, Clock, AlertCircle } from "lucide-react";
import { Card, Button, Badge } from "@/components/ui";

const approvals = [
  {
    id: "1",
    title: "Deploy to production",
    description: "Request to deploy version 2.4.0 to production environment",
    agent: "DevOps Agent",
    requestedAt: "5 minutes ago",
    priority: "high",
    type: "deployment",
  },
  {
    id: "2",
    title: "Access sensitive data",
    description: "Request to access customer database for analysis",
    agent: "Business Analyst",
    requestedAt: "1 hour ago",
    priority: "medium",
    type: "data_access",
  },
  {
    id: "3",
    title: "Execute financial transaction",
    description: "Request to process vendor payment of $5,000",
    agent: "Finance Agent",
    requestedAt: "2 hours ago",
    priority: "high",
    type: "financial",
  },
];

const history = [
  {
    id: "4",
    title: "Create new database",
    description: "Request to create staging database",
    agent: "DevOps Agent",
    status: "approved",
    processedAt: "Yesterday",
  },
  {
    id: "5",
    title: "Delete old logs",
    description: "Request to clean up logs older than 30 days",
    agent: "DevOps Agent",
    status: "rejected",
    processedAt: "2 days ago",
  },
];

export default function ApprovalsPage() {
  const [activeTab, setActiveTab] = useState<"pending" | "history">("pending");

  return (
    <div className="space-y-8 fade-in">
      {/* Header */}
      <div>
        <h1 className="page-title">Approvals</h1>
        <p className="page-subtitle">
          Review and approve agent actions
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "Pending", value: 3, color: "text-yellow-400", icon: Clock },
          { label: "Approved Today", value: 12, color: "text-green-400", icon: Check },
          { label: "Rejected Today", value: 2, color: "text-red-400", icon: X },
          { label: "Avg Response", value: "5m", color: "text-blue-400", icon: Clock },
        ].map((stat) => (
          <Card key={stat.label} className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gray-800 flex items-center justify-center">
              <stat.icon className={`w-5 h-5 ${stat.color}`} />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{stat.value}</p>
              <p className="text-xs text-gray-500">{stat.label}</p>
            </div>
          </Card>
        ))}
      </div>

      {/* Tabs */}
      <div className="tabs">
        <button
          onClick={() => setActiveTab("pending")}
          className={`tab ${activeTab === "pending" ? "tab-active" : ""}`}
        >
          Pending
          <Badge variant="warning" size="sm" className="ml-2">
            {approvals.length}
          </Badge>
        </button>
        <button
          onClick={() => setActiveTab("history")}
          className={`tab ${activeTab === "history" ? "tab-active" : ""}`}
        >
          History
        </button>
      </div>

      {/* Approval List */}
      <div className="space-y-4">
        {activeTab === "pending" ? (
          approvals.map((approval) => (
            <Card key={approval.id} className="flex flex-col sm:flex-row sm:items-center gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-semibold text-white">{approval.title}</h3>
                  <Badge
                    variant={
                      approval.priority === "high" ? "error" : "warning"
                    }
                    size="sm"
                  >
                    {approval.priority}
                  </Badge>
                </div>
                <p className="text-sm text-gray-400 mb-2">
                  {approval.description}
                </p>
                <div className="flex items-center gap-4 text-xs text-gray-500">
                  <span>Agent: {approval.agent}</span>
                  <span>Requested: {approval.requestedAt}</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="ghost" leftIcon={<X className="w-4 h-4" />}>
                  Reject
                </Button>
                <Button leftIcon={<Check className="w-4 h-4" />}>
                  Approve
                </Button>
              </div>
            </Card>
          ))
        ) : (
          history.map((item) => (
            <Card
              key={item.id}
              className="flex flex-col sm:flex-row sm:items-center gap-4 opacity-75"
            >
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-semibold text-gray-300">{item.title}</h3>
                  <Badge
                    variant={
                      item.status === "approved" ? "success" : "default"
                    }
                    size="sm"
                  >
                    {item.status}
                  </Badge>
                </div>
                <p className="text-sm text-gray-500 mb-2">
                  {item.description}
                </p>
                <div className="flex items-center gap-4 text-xs text-gray-600">
                  <span>Agent: {item.agent}</span>
                  <span>Processed: {item.processedAt}</span>
                </div>
              </div>
            </Card>
          ))
        )}

        {activeTab === "pending" && approvals.length === 0 && (
          <div className="card py-16 text-center">
            <ShieldCheck className="w-16 h-16 text-gray-700 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-300 mb-1">
              No pending approvals
            </h3>
            <p className="text-sm text-gray-500">
              All caught up! Check back later for new requests.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
