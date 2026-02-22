"use client";

import { useState, useEffect, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { 
  ArrowLeft, 
  User, 
  Mail, 
  Calendar, 
  Shield, 
  Activity, 
  Key, 
  Clock,
  Edit2,
  Loader2,
  X,
  AlertCircle,
  CheckCircle,
  XCircle,
  Settings,
  LogIn
} from "lucide-react";
import { Card, Button, Badge, SkeletonCard } from "@/components/ui";
import api from "@/lib/api";

interface UserDetail {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
  created_at: string;
  updated_at: string;
  api_keys_count: number;
  recent_activity: ActivityItem[];
}

interface ActivityItem {
  action: string;
  target_type: string;
  details: Record<string, any>;
  created_at: string;
}

const roleColors: Record<string, string> = {
  admin: "bg-purple-900/50 text-purple-300 border-purple-800",
  member: "bg-blue-900/50 text-blue-300 border-blue-800",
  viewer: "bg-gray-800 text-gray-400 border-gray-700",
};

const statusConfig: Record<string, { color: string; bg: string; icon: any }> = {
  active: { color: "text-green-400", bg: "bg-green-900/20", icon: CheckCircle },
  inactive: { color: "text-red-400", bg: "bg-red-900/20", icon: XCircle },
};

const activityIcons: Record<string, any> = {
  "user.created": User,
  "user.updated": Edit2,
  "user.role_changed": Shield,
  "user.activated": CheckCircle,
  "user.deactivated": XCircle,
  "user.login": LogIn,
  "api_key.created": Key,
  "api_key.deleted": Key,
  default: Activity,
};

function formatActivityAction(action: string): string {
  const actionMap: Record<string, string> = {
    "user.created": "User account created",
    "user.updated": "User profile updated",
    "user.role_changed": "User role changed",
    "user.activated": "User account activated",
    "user.deactivated": "User account deactivated",
    "user.login": "User logged in",
    "api_key.created": "API key created",
    "api_key.deleted": "API key deleted",
  };
  return actionMap[action] || action.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatTimeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  return date.toLocaleDateString();
}

export default function UserDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const router = useRouter();
  const [user, setUser] = useState<UserDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingUser, setEditingUser] = useState<UserDetail | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const fetchUser = async () => {
      if (!resolvedParams.id) return;
      
      setLoading(true);
      setError(null);
      try {
        const response = await api.get(`/users/${resolvedParams.id}`);
        setUser(response.data);
      } catch (err: any) {
        console.error("Failed to fetch user:", err);
        if (err.response?.status === 404) {
          setError("User not found");
        } else if (err.response?.status === 403) {
          setError("Access denied. Admin privileges required.");
        } else {
          setError(err.response?.data?.error || "Failed to fetch user details");
        }
      } finally {
        setLoading(false);
      }
    };

    fetchUser();
  }, [resolvedParams.id]);

  const handleEdit = () => {
    if (!user) return;
    setEditingUser({ ...user });
    setIsModalOpen(true);
  };

  const handleSaveUser = async () => {
    if (!editingUser) return;
    
    setSaving(true);
    try {
      await api.put(`/users/${editingUser.id}`, {
        name: editingUser.name,
        role: editingUser.role,
        status: editingUser.status,
      });
      
      // Refresh user data
      const response = await api.get(`/users/${resolvedParams.id}`);
      setUser(response.data);
      setIsModalOpen(false);
      setEditingUser(null);
    } catch (err: any) {
      alert(err.response?.data?.error || "Failed to update user");
    } finally {
      setSaving(false);
    }
  };

  const handleActivate = async () => {
    if (!user) return;
    try {
      await api.post(`/users/${user.id}/activate`);
      const response = await api.get(`/users/${resolvedParams.id}`);
      setUser(response.data);
    } catch (err: any) {
      alert(err.response?.data?.error || "Failed to activate user");
    }
  };

  const handleDeactivate = async () => {
    if (!user) return;
    if (!confirm("Are you sure you want to deactivate this user?")) return;
    
    try {
      await api.delete(`/users/${user.id}`);
      const response = await api.get(`/users/${resolvedParams.id}`);
      setUser(response.data);
    } catch (err: any) {
      alert(err.response?.data?.error || "Failed to deactivate user");
    }
  };

  if (loading) {
    return (
      <div className="space-y-6 fade-in">
        <div className="flex items-center gap-4">
          <Link href="/admin/users">
            <Button variant="secondary" size="sm" leftIcon={<ArrowLeft className="w-4 h-4" />}>
              Back
            </Button>
          </Link>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <SkeletonCard />
            <Card>
              <div className="animate-pulse space-y-4">
                <div className="h-6 bg-gray-800 rounded w-1/3" />
                <div className="h-32 bg-gray-800 rounded" />
              </div>
            </Card>
          </div>
          <div>
            <SkeletonCard />
          </div>
        </div>
      </div>
    );
  }

  if (error || !user) {
    return (
      <div className="space-y-6 fade-in">
        <Link href="/admin/users">
          <Button variant="secondary" size="sm" leftIcon={<ArrowLeft className="w-4 h-4" />}>
            Back to Users
          </Button>
        </Link>
        
        <Card className="p-8 text-center">
          <div className="w-16 h-16 bg-red-900/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-8 h-8 text-red-500" />
          </div>
          <h3 className="text-xl font-semibold text-white mb-2">Error</h3>
          <p className="text-gray-400 mb-6">{error || "User not found"}</p>
          <Link href="/admin/users">
            <Button>Return to Users</Button>
          </Link>
        </Card>
      </div>
    );
  }

  const StatusIcon = statusConfig[user.status]?.icon || AlertCircle;

  return (
    <div className="space-y-6 fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link href="/admin/users">
            <Button variant="secondary" size="sm" leftIcon={<ArrowLeft className="w-4 h-4" />}>
              Back
            </Button>
          </Link>
          <div>
            <h1 className="page-title flex items-center gap-3">
              <User className="w-6 h-6 text-blue-500" />
              {user.name}
            </h1>
            <p className="page-subtitle">
              User details and activity
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={handleEdit} leftIcon={<Edit2 className="w-4 h-4" />}>
            Edit User
          </Button>
          {user.status === "active" ? (
            <Button variant="danger" onClick={handleDeactivate}>
              Deactivate
            </Button>
          ) : (
            <Button onClick={handleActivate}>
              Activate
            </Button>
          )}
        </div>
      </div>

      {/* User Info Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Info */}
        <div className="lg:col-span-2 space-y-6">
          {/* Profile Card */}
          <Card>
            <div className="flex items-start justify-between mb-6">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-2xl font-bold text-white">
                  {user.name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)}
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-white">{user.name}</h2>
                  <p className="text-gray-400">{user.email}</p>
                  <div className="flex items-center gap-2 mt-2">
                    <span className={`badge border ${roleColors[user.role] || roleColors.member}`}>
                      {user.role}
                    </span>
                    <span className={`badge border flex items-center gap-1 ${statusConfig[user.status]?.bg || "bg-gray-800"} ${statusConfig[user.status]?.color || "text-gray-400"}`}>
                      <StatusIcon className="w-3 h-3" />
                      {user.status}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 pt-6 border-t border-gray-800">
              <div className="flex items-center gap-3">
                <Calendar className="w-5 h-5 text-gray-500" />
                <div>
                  <p className="text-xs text-gray-500">Created</p>
                  <p className="text-sm text-white">
                    {new Date(user.created_at).toLocaleDateString("en-US", {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Clock className="w-5 h-5 text-gray-500" />
                <div>
                  <p className="text-xs text-gray-500">Last Updated</p>
                  <p className="text-sm text-white">
                    {new Date(user.updated_at).toLocaleDateString("en-US", {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })}
                  </p>
                </div>
              </div>
            </div>
          </Card>

          {/* Activity Timeline */}
          <Card>
            <div className="flex items-center gap-2 mb-6">
              <Activity className="w-5 h-5 text-gray-400" />
              <h3 className="text-lg font-semibold text-white">Activity Timeline</h3>
            </div>

            {user.recent_activity && user.recent_activity.length > 0 ? (
              <div className="relative">
                {/* Timeline line */}
                <div className="absolute left-4 top-0 bottom-0 w-px bg-gray-800" />

                <div className="space-y-6">
                  {user.recent_activity.map((activity, index) => {
                    const ActivityIcon = activityIcons[activity.action] || activityIcons.default;
                    return (
                      <div key={index} className="relative flex gap-4 pl-8">
                        {/* Timeline dot */}
                        <div className="absolute left-2 w-4 h-4 rounded-full bg-gray-900 border-2 border-indigo-500" />
                        
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <ActivityIcon className="w-4 h-4 text-indigo-400" />
                            <span className="text-sm font-medium text-white">
                              {formatActivityAction(activity.action)}
                            </span>
                          </div>
                          {activity.details && Object.keys(activity.details).length > 0 && (
                            <div className="text-xs text-gray-500 bg-gray-800/50 rounded p-2 mt-2 font-mono">
                              {JSON.stringify(activity.details, null, 2)}
                            </div>
                          )}
                          <p className="text-xs text-gray-500 mt-2">
                            {formatTimeAgo(activity.created_at)}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="text-center py-8">
                <Activity className="w-12 h-12 text-gray-700 mx-auto mb-3" />
                <p className="text-gray-500">No recent activity</p>
              </div>
            )}
          </Card>
        </div>

        {/* Sidebar Stats */}
        <div className="space-y-6">
          {/* Quick Stats */}
          <Card>
            <h3 className="text-sm font-medium text-gray-400 mb-4">Quick Stats</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-gray-400">
                  <Key className="w-4 h-4" />
                  <span className="text-sm">API Keys</span>
                </div>
                <span className="text-lg font-semibold text-white">{user.api_keys_count || 0}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-gray-400">
                  <Activity className="w-4 h-4" />
                  <span className="text-sm">Activities</span>
                </div>
                <span className="text-lg font-semibold text-white">{user.recent_activity?.length || 0}</span>
              </div>
            </div>
          </Card>

          {/* Account Actions */}
          <Card>
            <h3 className="text-sm font-medium text-gray-400 mb-4">Account Actions</h3>
            <div className="space-y-2">
              <Button 
                variant="secondary" 
                className="w-full justify-start" 
                leftIcon={<Edit2 className="w-4 h-4" />}
                onClick={handleEdit}
              >
                Edit Profile
              </Button>
              {user.status === "active" ? (
                <Button 
                  variant="danger" 
                  className="w-full justify-start" 
                  leftIcon={<XCircle className="w-4 h-4" />}
                  onClick={handleDeactivate}
                >
                  Deactivate Account
                </Button>
              ) : (
                <Button 
                  className="w-full justify-start" 
                  leftIcon={<CheckCircle className="w-4 h-4" />}
                  onClick={handleActivate}
                >
                  Activate Account
                </Button>
              )}
            </div>
          </Card>
        </div>
      </div>

      {/* Edit User Modal */}
      {isModalOpen && editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="w-full max-w-md scale-in">
            <Card className="relative">
              <button
                onClick={() => setIsModalOpen(false)}
                className="absolute top-4 right-4 p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="mb-6">
                <h2 className="text-xl font-semibold text-white">Edit User</h2>
                <p className="text-sm text-gray-400">
                  Update user information and permissions
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1.5">
                    Name
                  </label>
                  <input
                    type="text"
                    value={editingUser.name}
                    onChange={(e) =>
                      setEditingUser({ ...editingUser, name: e.target.value })
                    }
                    className="input"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1.5">
                    Email
                  </label>
                  <input
                    type="email"
                    value={editingUser.email}
                    disabled
                    className="input opacity-50 cursor-not-allowed"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1.5">
                    Role
                  </label>
                  <select
                    value={editingUser.role}
                    onChange={(e) =>
                      setEditingUser({
                        ...editingUser,
                        role: e.target.value,
                      })
                    }
                    className="input"
                  >
                    <option value="viewer">Viewer</option>
                    <option value="member">Member</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1.5">
                    Status
                  </label>
                  <select
                    value={editingUser.status}
                    onChange={(e) =>
                      setEditingUser({
                        ...editingUser,
                        status: e.target.value,
                      })
                    }
                    className="input"
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
              </div>

              <div className="flex gap-3 mt-6 pt-6 border-t border-gray-800">
                <Button
                  variant="secondary"
                  className="flex-1"
                  onClick={() => setIsModalOpen(false)}
                  disabled={saving}
                >
                  Cancel
                </Button>
                <Button 
                  className="flex-1" 
                  onClick={handleSaveUser}
                  disabled={saving}
                  leftIcon={saving ? <Loader2 className="w-4 h-4 animate-spin" /> : undefined}
                >
                  {saving ? "Saving..." : "Save Changes"}
                </Button>
              </div>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
