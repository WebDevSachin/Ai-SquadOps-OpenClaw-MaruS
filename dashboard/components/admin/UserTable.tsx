"use client";

import { useState } from "react";
import Link from "next/link";
import {
  MoreHorizontal,
  Edit2,
  Trash2,
  Ban,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  Download,
  Eye,
} from "lucide-react";

export interface User {
  id: string;
  name: string;
  email: string;
  role: "admin" | "user" | "manager";
  status: "active" | "inactive" | "suspended";
  createdAt: string;
  lastLogin?: string;
}

interface UserTableProps {
  users: User[];
  onEdit: (user: User) => void;
  onDelete: (userId: string) => void;
  onDeactivate: (userId: string) => void;
  onActivate: (userId: string) => void;
  onExport: () => void;
}

const roleColors: Record<string, string> = {
  admin: "bg-purple-900/50 text-purple-300 border-purple-800",
  manager: "bg-blue-900/50 text-blue-300 border-blue-800",
  user: "bg-gray-800 text-gray-400 border-gray-700",
};

const statusColors: Record<string, string> = {
  active: "bg-green-900/50 text-green-300 border-green-800",
  inactive: "bg-gray-800 text-gray-400 border-gray-700",
  suspended: "bg-red-900/50 text-red-300 border-red-800",
};

export default function UserTable({
  users,
  onEdit,
  onDelete,
  onDeactivate,
  onActivate,
  onExport,
}: UserTableProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  // Filter users
  const filteredUsers = users.filter((user) => {
    const matchesSearch =
      user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = roleFilter === "all" || user.role === roleFilter;
    const matchesStatus = statusFilter === "all" || user.status === statusFilter;
    return matchesSearch && matchesRole && matchesStatus;
  });

  // Pagination
  const totalPages = Math.ceil(filteredUsers.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedUsers = filteredUsers.slice(startIndex, startIndex + itemsPerPage);

  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
        <div className="flex flex-col sm:flex-row gap-3 flex-1">
          <input
            type="text"
            placeholder="Search users..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1);
            }}
            className="px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 w-full sm:w-64"
          />
          <select
            value={roleFilter}
            onChange={(e) => {
              setRoleFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="all">All Roles</option>
            <option value="admin">Admin</option>
            <option value="manager">Manager</option>
            <option value="user">User</option>
          </select>
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="suspended">Suspended</option>
          </select>
        </div>
        <button
          onClick={onExport}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition-colors"
        >
          <Download className="w-4 h-4" />
          Export CSV
        </button>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-gray-800">
        <table className="w-full">
          <thead className="bg-gray-800/50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                User
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                Role
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                Status
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                Created
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                Last Login
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800">
            {paginatedUsers.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                  No users found
                </td>
              </tr>
            ) : (
              paginatedUsers.map((user) => (
                <tr key={user.id} className="hover:bg-gray-800/30 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-sm font-medium text-white">
                        {user.name.split(" ").map((n) => n[0]).join("").toUpperCase()}
                      </div>
                      <div>
                        <Link 
                          href={`/admin/users/${user.id}`}
                          className="text-sm font-medium text-white hover:text-indigo-400 transition-colors"
                        >
                          {user.name}
                        </Link>
                        <p className="text-xs text-gray-500">{user.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`badge border ${roleColors[user.role]} text-[10px] uppercase tracking-wider`}
                    >
                      {user.role}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`badge border ${statusColors[user.status]} text-[10px] uppercase tracking-wider`}
                    >
                      {user.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-400">
                    {new Date(user.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-400">
                    {user.lastLogin
                      ? new Date(user.lastLogin).toLocaleDateString()
                      : "Never"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="relative">
                      <button
                        onClick={() =>
                          setOpenMenuId(openMenuId === user.id ? null : user.id)
                        }
                        className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
                      >
                        <MoreHorizontal className="w-4 h-4 text-gray-400" />
                      </button>
                      {openMenuId === user.id && (
                        <>
                          <div
                            className="fixed inset-0 z-10"
                            onClick={() => setOpenMenuId(null)}
                          />
                          <div className="absolute right-0 mt-1 w-48 bg-gray-900 border border-gray-800 rounded-lg shadow-xl z-20 py-1">
                            <button
                              onClick={() => {
                                onEdit(user);
                                setOpenMenuId(null);
                              }}
                              className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-300 hover:bg-gray-800 transition-colors"
                            >
                              <Edit2 className="w-4 h-4" />
                              Edit User
                            </button>
                            {user.status === "active" ? (
                              <button
                                onClick={() => {
                                  onDeactivate(user.id);
                                  setOpenMenuId(null);
                                }}
                                className="w-full flex items-center gap-2 px-4 py-2 text-sm text-amber-400 hover:bg-gray-800 transition-colors"
                              >
                                <Ban className="w-4 h-4" />
                                Deactivate
                              </button>
                            ) : (
                              <button
                                onClick={() => {
                                  onActivate(user.id);
                                  setOpenMenuId(null);
                                }}
                                className="w-full flex items-center gap-2 px-4 py-2 text-sm text-green-400 hover:bg-gray-800 transition-colors"
                              >
                                <CheckCircle className="w-4 h-4" />
                                Activate
                              </button>
                            )}
                            <hr className="my-1 border-gray-800" />
                            <button
                              onClick={() => {
                                onDelete(user.id);
                                setOpenMenuId(null);
                              }}
                              className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-400 hover:bg-gray-800 transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                              Delete User
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">
          Showing {startIndex + 1} to{" "}
          {Math.min(startIndex + itemsPerPage, filteredUsers.length)} of{" "}
          {filteredUsers.length} users
        </p>
        <div className="flex items-center gap-2">
          <button
            onClick={() => handlePageChange(currentPage - 1)}
            disabled={currentPage === 1}
            className="p-2 rounded-lg bg-gray-800 text-gray-400 hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
            <button
              key={page}
              onClick={() => handlePageChange(page)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                currentPage === page
                  ? "bg-indigo-600 text-white"
                  : "bg-gray-800 text-gray-400 hover:bg-gray-700"
              }`}
            >
              {page}
            </button>
          ))}
          <button
            onClick={() => handlePageChange(currentPage + 1)}
            disabled={currentPage === totalPages}
            className="p-2 rounded-lg bg-gray-800 text-gray-400 hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
