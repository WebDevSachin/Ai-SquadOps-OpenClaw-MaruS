"use client";

import { LogOut, Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useState } from "react";

interface LogoutButtonProps {
  collapsed?: boolean;
  className?: string;
}

export function LogoutButton({ collapsed = false, className = "" }: LogoutButtonProps) {
  const { logout } = useAuth();
  const [isLoading, setIsLoading] = useState(false);

  const handleLogout = async () => {
    setIsLoading(true);
    try {
      await logout();
    } catch {
      setIsLoading(false);
    }
  };

  return (
    <button
      onClick={handleLogout}
      disabled={isLoading}
      className={`
        group flex items-center gap-3 rounded-xl text-sm font-medium
        text-gray-400 hover:text-red-400 hover:bg-red-900/20
        transition-all duration-200
        ${collapsed ? "justify-center p-2.5 w-10 h-10" : "px-3 py-2.5 w-full"}
        ${className}
      `}
      title={collapsed ? "Sign out" : undefined}
    >
      {isLoading ? (
        <Loader2 className="w-5 h-5 animate-spin" />
      ) : (
        <LogOut className="w-5 h-5 flex-shrink-0 transition-transform group-hover:scale-110" />
      )}
      {!collapsed && (
        <span>{isLoading ? "Signing out..." : "Sign out"}</span>
      )}
      
      {/* Tooltip for collapsed state */}
      {collapsed && (
        <span className="absolute left-full ml-2 px-2 py-1 bg-gray-800 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50">
          Sign out
        </span>
      )}
    </button>
  );
}
