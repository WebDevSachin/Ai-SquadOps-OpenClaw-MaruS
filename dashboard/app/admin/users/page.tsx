"use client";

import { useState, useEffect, useCallback } from "react";
import { Users, Plus, X, Loader2, RefreshCw, Search, Filter, ArrowUpDown } from "lucide-react";
import UserTable, { User } from "@/components/admin/UserTable";
import { Card, Button, Badge, Input, Select, SkeletonCard } from "@/components/ui";
import { Breadcrumb, useBreadcrumbs } from "@/components/Breadcrumb";
import api from "@/lib/api";

interface UserData {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
  created_at: string;
  updated_at: string;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  total_pages: number;
}

interface FilterState {
  search: string;
  role: string;
  status: string;
}

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: 20,
    total: 0,
    total_pages: 0,
  });
  const [filters, setFilters] = useState<FilterState>({
    search: "",
    role: "",
    status: "",
  });
  const [sortBy, setSortBy] = useState<string>("created_at");
  const [sortOrder, setSortOrder] = useState<string>("desc");
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCreateMode, setIsCreateMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [newUserPassword, setNewUserPassword] = useState("");
  const breadcrumbs = useBreadcrumbs();

  const fetchUsers = useCallback(async (page = 1) => {
    setLoading(true);
    setError(null);
    try {
      // Build query params
      const params = new URLSearchParams();
      params.set("page", page.toString());
      params.set("limit", "20");
      
      if (filters.search.trim()) {
        params.set("search", filters.search.trim());
      }
      if (filters.role) {
        params.set("role", filters.role);
      }
      if (filters.status) {
        params.set("status", filters.status);
      }
      if (sortBy) {
        params.set("sort_by", sortBy);
      }
      if (sortOrder) {
        params.set("sort_order", sortOrder);
      }

      const response = await api.get(`/users?${params.toString()}`);
      const data = response.data;
      
      // Transform API response to User format
      const transformedUsers: User[] = data.users.map((u: UserData) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        role: u.role,
        status: u.status as "active" | "inactive" | "suspended",
        createdAt: u.created_at,
        lastLogin: undefined,
      }));
      
      setUsers(transformedUsers);
      setPagination(data.pagination);
    } catch (err: any) {
      console.error("Failed to fetch users:", err);
      if (err.response?.status === 403) {
        setError("Access denied. Admin privileges required.");
      } else {
        setError(err.response?.data?.error || "Failed to fetch users");
      }
    } finally {
      setLoading(false);
    }
  }, [filters, sortBy, sortOrder]);

  // Initial load
  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchUsers(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [filters.search]);

  const handleFilterChange = (key: keyof FilterState, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const handleSortChange = (field: string) => {
    if (sortBy === field) {
      setSortOrder(prev => prev === "asc" ? "desc" : "asc");
    } else {
      setSortBy(field);
      setSortOrder("desc");
    }
  };

  const handleEdit = (user: User) => {
    setEditingUser({ ...user });
    setIsCreateMode(false);
    setIsModalOpen(true);
  };

  const handleCreate = () => {
    setEditingUser({
      id: "",
      name: "",
      email: "",
      role: "user",
      status: "active",
      createdAt: new Date().toISOString(),
    });
    setNewUserPassword("");
    setIsCreateMode(true);
    setIsModalOpen(true);
  };

  const handleDelete = async (userId: string) => {
    if (!confirm("Are you sure you want to deactivate this user?")) {
      return;
    }
    
    try {
      await api.delete(`/users/${userId}`);
      fetchUsers(pagination.page);
    } catch (err: any) {
      alert(err.response?.data?.error || "Failed to deactivate user");
    }
  };

  const handleDeactivate = async (userId: string) => {
    try {
      await api.delete(`/users/${userId}`);
      fetchUsers(pagination.page);
    } catch (err: any) {
      alert(err.response?.data?.error || "Failed to deactivate user");
    }
  };

  const handleActivate = async (userId: string) => {
    try {
      await api.post(`/users/${userId}/activate`);
      fetchUsers(pagination.page);
    } catch (err: any) {
      alert(err.response?.data?.error || "Failed to activate user");
    }
  };

  const handleSaveUser = async () => {
    if (!editingUser) return;
    
    setSaving(true);
    try {
      if (isCreateMode) {
        // Create new user
        if (!editingUser.email || !newUserPassword) {
          alert("Email and password are required");
          setSaving(false);
          return;
        }
        await api.post("/users", {
          name: editingUser.name,
          email: editingUser.email,
          role: editingUser.role,
          password: newUserPassword,
        });
      } else {
        // Update existing user
        await api.put(`/users/${editingUser.id}`, {
          name: editingUser.name,
          role: editingUser.role,
          status: editingUser.status,
        });
      }
      
      await fetchUsers(pagination.page);
      setIsModalOpen(false);
      setEditingUser(null);
    } catch (err: any) {
      alert(err.response?.data?.error || `Failed to ${isCreateMode ? "create" : "update"} user`);
    } finally {
      setSaving(false);
    }
  };

  const handleExport = () => {
    const csvContent = [
      ["Name", "Email", "Role", "Status", "Created"],
      ...users.map((u) => [
        u.name,
        u.email,
        u.role,
        u.status,
        new Date(u.createdAt).toLocaleDateString(),
      ]),
    ]
      .map((row) => row.join(","))
      .join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `users_${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  if (error) {
    return (
      <div className="space-y-6 fade-in">
        {/* Breadcrumb */}
        <Breadcrumb items={breadcrumbs} />
        
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="page-title flex items-center gap-3">
              <Users className="w-8 h-8 text-blue-500" />
              User Management
            </h1>
            <p className="page-subtitle">
              Manage user accounts, roles, and permissions
            </p>
          </div>
        </div>

        <Card className="p-8 text-center">
          <div className="w-16 h-16 bg-red-900/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <X className="w-8 h-8 text-red-500" />
          </div>
          <h3 className="text-xl font-semibold text-white mb-2">Error</h3>
          <p className="text-gray-400 mb-6">{error}</p>
          <Button onClick={() => fetchUsers()} leftIcon={<RefreshCw className="w-4 h-4" />}>
            Retry
          </Button>
        </Card>
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
          <h1 className="page-title flex items-center gap-3">
            <Users className="w-8 h-8 text-blue-500" />
            User Management
          </h1>
          <p className="page-subtitle">
            Manage user accounts, roles, and permissions
          </p>
        </div>
        <Button onClick={handleCreate} leftIcon={<Plus className="w-4 h-4" />}>
          Add User
        </Button>
      </div>

      {/* Stats */}
      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <SkeletonCard key={i} icon={false} />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            {
              label: "Total Users",
              value: pagination.total,
              color: "text-white",
            },
            {
              label: "Active",
              value: users.filter((u) => u.status === "active").length,
              color: "text-green-400",
            },
            {
              label: "Admins",
              value: users.filter((u) => u.role === "admin").length,
              color: "text-purple-400",
            },
            {
              label: "Inactive",
              value: users.filter((u) => u.status === "inactive").length,
              color: "text-red-400",
            },
          ].map((stat) => (
            <Card key={stat.label} className="text-center py-4">
              <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
              <p className="text-sm text-gray-500">{stat.label}</p>
            </Card>
          ))}
        </div>
      )}

      {/* Server-side Filters */}
      <Card className="p-4">
        <div className="flex flex-col lg:flex-row gap-4">
          {/* Search */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
              type="text"
              placeholder="Search by name or email..."
              value={filters.search}
              onChange={(e) => handleFilterChange("search", e.target.value)}
              className="input pl-10 w-full"
            />
          </div>
          
          {/* Role Filter */}
          <select
            value={filters.role}
            onChange={(e) => handleFilterChange("role", e.target.value)}
            className="input w-full lg:w-40"
          >
            <option value="">All Roles</option>
            <option value="admin">Admin</option>
            <option value="member">Member</option>
            <option value="viewer">Viewer</option>
          </select>
          
          {/* Status Filter */}
          <select
            value={filters.status}
            onChange={(e) => handleFilterChange("status", e.target.value)}
            className="input w-full lg:w-40"
          >
            <option value="">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>

          {/* Sort */}
          <div className="flex gap-2">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="input w-full lg:w-40"
            >
              <option value="created_at">Created Date</option>
              <option value="name">Name</option>
            </select>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setSortOrder(prev => prev === "asc" ? "desc" : "asc")}
              className="px-3"
            >
              {sortOrder === "asc" ? "↑" : "↓"}
            </Button>
          </div>

          {/* Refresh */}
          <Button 
            variant="secondary" 
            size="sm"
            onClick={() => fetchUsers(pagination.page)}
            leftIcon={<RefreshCw className="w-4 h-4" />}
          >
            Refresh
          </Button>
        </div>
      </Card>

      {/* Pagination Info */}
      {!loading && pagination.total_pages > 0 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-400">
            Showing {((pagination.page - 1) * pagination.limit) + 1} - {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} users
          </p>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              size="sm"
              disabled={pagination.page === 1}
              onClick={() => fetchUsers(pagination.page - 1)}
            >
              Previous
            </Button>
            <span className="px-3 py-2 text-sm text-gray-400">
              Page {pagination.page} of {pagination.total_pages}
            </span>
            <Button
              variant="secondary"
              size="sm"
              disabled={pagination.page === pagination.total_pages}
              onClick={() => fetchUsers(pagination.page + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}

      {/* User Table */}
      {loading ? (
        <Card>
          <div className="animate-pulse space-y-4">
            <div className="h-10 bg-gray-800 rounded w-full" />
            <div className="h-64 bg-gray-800 rounded w-full" />
          </div>
        </Card>
      ) : (
        <UserTable
          users={users}
          onEdit={handleEdit}
          onDelete={handleDelete}
          onDeactivate={handleDeactivate}
          onActivate={handleActivate}
          onExport={handleExport}
        />
      )}

      {/* Create/Edit User Modal */}
      {isModalOpen && editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="w-full max-w-md scale-in">
            <Card className="relative">
              {/* Close Button */}
              <button
                onClick={() => setIsModalOpen(false)}
                className="absolute top-4 right-4 p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="mb-6">
                <h2 className="text-xl font-semibold text-white">
                  {isCreateMode ? "Create New User" : "Edit User"}
                </h2>
                <p className="text-sm text-gray-400">
                  {isCreateMode 
                    ? "Add a new user account to the system" 
                    : "Update user information and permissions"}
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1.5">
                    Name *
                  </label>
                  <input
                    type="text"
                    value={editingUser.name}
                    onChange={(e) =>
                      setEditingUser({ ...editingUser, name: e.target.value })
                    }
                    className="input"
                    placeholder="Full name"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1.5">
                    Email {isCreateMode && "*"}
                  </label>
                  <input
                    type="email"
                    value={editingUser.email}
                    onChange={(e) =>
                      setEditingUser({ ...editingUser, email: e.target.value })
                    }
                    disabled={!isCreateMode}
                    className={`input ${!isCreateMode ? "opacity-50 cursor-not-allowed" : ""}`}
                    placeholder="email@example.com"
                  />
                </div>

                {isCreateMode && (
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1.5">
                      Password *
                    </label>
                    <input
                      type="password"
                      value={newUserPassword}
                      onChange={(e) => setNewUserPassword(e.target.value)}
                      className="input"
                      placeholder="Minimum 8 characters"
                      minLength={8}
                    />
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1.5">
                    Role
                  </label>
                  <select
                    value={editingUser.role}
                    onChange={(e) =>
                      setEditingUser({
                        ...editingUser,
                        role: e.target.value as User["role"],
                      })
                    }
                    className="input"
                  >
                    <option value="viewer">Viewer</option>
                    <option value="member">Member</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>

                {!isCreateMode && (
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1.5">
                      Status
                    </label>
                    <select
                      value={editingUser.status}
                      onChange={(e) =>
                        setEditingUser({
                          ...editingUser,
                          status: e.target.value as User["status"],
                        })
                      }
                      className="input"
                    >
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                    </select>
                  </div>
                )}
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
                  disabled={saving || (isCreateMode && (!editingUser.email || !newUserPassword))}
                  leftIcon={saving ? <Loader2 className="w-4 h-4 animate-spin" /> : undefined}
                >
                  {saving ? "Saving..." : isCreateMode ? "Create User" : "Save Changes"}
                </Button>
              </div>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
