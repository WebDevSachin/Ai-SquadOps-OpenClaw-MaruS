"use client";

import { useEffect, useState } from "react";
import { ShieldCheck, Check, X, Clock, AlertCircle } from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

interface Approval {
  id: string;
  agent_name?: string;
  agentName?: string;
  action_type?: string;
  actionType?: string;
  title: string;
  description?: string;
  status: string;
  created_at?: string;
  createdAt?: string;
}

const tabs = [
  { key: "pending", label: "Pending", icon: Clock },
  { key: "approved", label: "Approved", icon: Check },
  { key: "rejected", label: "Rejected", icon: X },
];

const statusIcons: Record<string, React.ElementType> = {
  pending: Clock,
  approved: Check,
  rejected: X,
};

const statusStyles: Record<string, string> = {
  pending: "bg-yellow-900/40 text-yellow-300 border-yellow-800",
  approved: "bg-green-900/40 text-green-300 border-green-800",
  rejected: "bg-red-900/40 text-red-300 border-red-800",
};

export default function ApprovalsPage() {
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("pending");
  const [processing, setProcessing] = useState<string | null>(null);

  useEffect(() => {
    fetchApprovals();
  }, []);

  async function fetchApprovals() {
    try {
      const res = await fetch(`${API}/api/approvals`);
      if (res.ok) {
        const data = await res.json();
        setApprovals(Array.isArray(data) ? data : data.approvals || []);
      }
    } catch (err) {
      console.error("Failed to fetch approvals:", err);
    } finally {
      setLoading(false);
    }
  }

  async function handleAction(id: string, action: "approved" | "rejected") {
    setProcessing(id);
    try {
      const res = await fetch(`${API}/api/approvals/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: action }),
      });
      if (res.ok) {
        setApprovals((prev) =>
          prev.map((a) => (a.id === id ? { ...a, status: action } : a))
        );
      }
    } catch (err) {
      console.error(`Failed to ${action} approval:`, err);
    } finally {
      setProcessing(null);
    }
  }

  const filtered = approvals.filter((a) => a.status === activeTab);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-white">Approvals</h1>
        <p className="text-gray-400 mt-1">
          Review and approve agent actions requiring human oversight
        </p>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 bg-gray-900 p-1 rounded-lg w-fit border border-gray-800">
        {tabs.map((tab) => {
          const count = approvals.filter((a) => a.status === tab.key).length;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === tab.key
                  ? "bg-gray-800 text-white shadow"
                  : "text-gray-400 hover:text-gray-200"
              }`}
            >
              <tab.icon className="w-3.5 h-3.5" />
              {tab.label}
              <span className="text-xs opacity-60">({count})</span>
            </button>
          );
        })}
      </div>

      {/* Approvals List */}
      <div className="space-y-4">
        {loading ? (
          [...Array(5)].map((_, i) => (
            <div key={i} className="card animate-pulse">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 bg-gray-800 rounded-lg" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-1/3 bg-gray-800 rounded" />
                  <div className="h-3 w-2/3 bg-gray-800 rounded" />
                  <div className="h-3 w-1/2 bg-gray-800 rounded" />
                </div>
              </div>
            </div>
          ))
        ) : filtered.length === 0 ? (
          <div className="card text-center py-12">
            <ShieldCheck className="w-12 h-12 text-gray-700 mx-auto mb-3" />
            <p className="text-gray-500">
              No {activeTab} approvals
            </p>
          </div>
        ) : (
          filtered.map((approval, i) => {
            const name = approval.agent_name || approval.agentName || "Unknown Agent";
            const actionType = approval.action_type || approval.actionType || "action";
            const time = approval.created_at || approval.createdAt;
            const StatusIcon = statusIcons[approval.status] || AlertCircle;

            return (
              <div
                key={approval.id || i}
                className="card hover:border-gray-700 transition-colors"
              >
                <div className="flex items-start gap-4">
                  {/* Status Icon */}
                  <div
                    className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
                      approval.status === "pending"
                        ? "bg-yellow-900/30"
                        : approval.status === "approved"
                        ? "bg-green-900/30"
                        : "bg-red-900/30"
                    }`}
                  >
                    <StatusIcon
                      className={`w-5 h-5 ${
                        approval.status === "pending"
                          ? "text-yellow-400"
                          : approval.status === "approved"
                          ? "text-green-400"
                          : "text-red-400"
                      }`}
                    />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-1">
                      <h3 className="text-sm font-semibold text-white truncate">
                        {approval.title}
                      </h3>
                      <span
                        className={`badge border ${
                          statusStyles[approval.status] ||
                          "bg-gray-800 text-gray-400 border-gray-700"
                        }`}
                      >
                        {approval.status}
                      </span>
                    </div>
                    <p className="text-sm text-gray-400 mb-2">
                      <span className="font-medium text-gray-300">{name}</span>
                      {" — "}
                      <span className="text-gray-500 capitalize">
                        {actionType.replace("_", " ")}
                      </span>
                    </p>
                    {approval.description && (
                      <p className="text-sm text-gray-500 mb-3">
                        {approval.description}
                      </p>
                    )}
                    <div className="flex items-center justify-between">
                      {time && (
                        <p className="text-xs text-gray-600">
                          {new Date(time).toLocaleString("en-US", {
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </p>
                      )}

                      {/* Action Buttons */}
                      {approval.status === "pending" && (
                        <div className="flex items-center gap-2 ml-auto">
                          <button
                            onClick={() => handleAction(approval.id, "rejected")}
                            disabled={processing === approval.id}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-red-400 bg-red-900/20 border border-red-900/40 hover:bg-red-900/40 transition-colors disabled:opacity-50"
                          >
                            <X className="w-3.5 h-3.5" />
                            Reject
                          </button>
                          <button
                            onClick={() => handleAction(approval.id, "approved")}
                            disabled={processing === approval.id}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-green-400 bg-green-900/20 border border-green-900/40 hover:bg-green-900/40 transition-colors disabled:opacity-50"
                          >
                            <Check className="w-3.5 h-3.5" />
                            Approve
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
