"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  Users,
  Bot,
  Settings,
  Shield,
  ChevronLeft,
  LogOut,
  LayoutDashboard,
  Menu,
  X,
} from "lucide-react";
import { Button } from "@/components/ui";
import { useAuth } from "@/hooks/useAuth";

const adminNavItems = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/users", label: "Users", icon: Users },
  { href: "/admin/swarm", label: "Agent Swarm", icon: Bot },
  { href: "/admin/settings", label: "Settings", icon: Settings },
];

// Use actual auth hook for admin check
function useAdminCheck() {
  const { isAdmin, isLoading } = useAuth();
  return { isAdmin, isLoading };
}

function AdminSidebar({
  mobileOpen,
  setMobileOpen,
}: {
  mobileOpen: boolean;
  setMobileOpen: (v: boolean) => void;
}) {
  const pathname = usePathname();

  return (
    <>
      {/* Mobile Overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed lg:static inset-y-0 left-0 z-50 w-64
          bg-gray-900 border-r border-gray-800 flex flex-col shrink-0
          transition-transform duration-300 ease-out
          ${mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
        `}
      >
        {/* Logo */}
        <div className="p-4 border-b border-gray-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-red-500 to-orange-600 rounded-xl flex items-center justify-center shadow-lg shadow-red-500/20">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white tracking-tight">
                Admin
              </h1>
              <p className="text-xs text-gray-500">SquadOps</p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto scrollbar-hide">
          {adminNavItems.map((item) => {
            const Icon = item.icon;
            const isActive =
              pathname === item.href || pathname.startsWith(`${item.href}/`);

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className={`
                  flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium
                  transition-all duration-200 ease-out group relative
                  ${
                    isActive
                      ? "bg-red-600 text-white shadow-lg shadow-red-500/20"
                      : "text-gray-400 hover:text-white hover:bg-gray-800/80"
                  }
                `}
              >
                <Icon
                  className={`
                    w-5 h-5 flex-shrink-0 transition-transform duration-200
                    ${isActive ? "text-white" : "text-gray-400 group-hover:text-white"}
                    group-hover:scale-110
                  `}
                />
                <span className="truncate">{item.label}</span>
                
                {/* Active indicator */}
                {isActive && (
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-white/30 rounded-r-full" />
                )}
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="p-3 border-t border-gray-800 space-y-2">
          <Link
            href="/"
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-gray-400 hover:text-white hover:bg-gray-800/80 transition-all duration-200 group"
          >
            <ChevronLeft className="w-5 h-5 flex-shrink-0 transition-transform group-hover:-translate-x-0.5" />
            Back to App
          </Link>
          <button className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-gray-400 hover:text-red-400 hover:bg-red-900/20 transition-all duration-200 group">
            <LogOut className="w-5 h-5 flex-shrink-0 transition-transform group-hover:scale-110" />
            Logout
          </button>
        </div>
      </aside>
    </>
  );
}

// Mobile Header
function MobileHeader({ onMenuClick }: { onMenuClick: () => void }) {
  return (
    <div className="lg:hidden flex items-center justify-between p-4 bg-gray-900 border-b border-gray-800 sticky top-0 z-30">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 bg-gradient-to-br from-red-500 to-orange-600 rounded-lg flex items-center justify-center">
          <Shield className="w-4 h-4 text-white" />
        </div>
        <span className="text-lg font-bold text-white">Admin</span>
      </div>
      <button
        onClick={onMenuClick}
        className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
        aria-label="Open menu"
      >
        <Menu className="w-6 h-6" />
      </button>
    </div>
  );
}

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isAdmin, isLoading } = useAdminCheck();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-950">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-2 border-gray-800 border-t-red-500 rounded-full animate-spin" />
          <p className="text-sm text-gray-500">Loading...</p>
        </div>
      </div>
    );
  }

  // Admin access guard
  if (!isAdmin) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-950 p-4">
        <div className="text-center max-w-md">
          <div className="w-20 h-20 bg-red-900/20 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <Shield className="w-10 h-10 text-red-500" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">Access Denied</h1>
          <p className="text-gray-400 mb-6">
            You don&apos;t have permission to access the admin dashboard.
          </p>
          <Link href="/">
            <Button leftIcon={<ChevronLeft className="w-4 h-4" />}>
              Back to Dashboard
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-gray-950">
      <AdminSidebar
        mobileOpen={mobileMenuOpen}
        setMobileOpen={setMobileMenuOpen}
      />

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <MobileHeader onMenuClick={() => setMobileMenuOpen(true)} />
        <div
          className="flex-1 overflow-y-auto"
          style={{
            scrollbarWidth: "thin",
            scrollbarColor: "#374151 #111827",
          }}
        >
          <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">{children}</div>
        </div>
      </main>
    </div>
  );
}
