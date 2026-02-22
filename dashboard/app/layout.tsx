"use client";

import "./globals.css";
import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Bot,
  ListTodo,
  MessageSquare,
  ShieldCheck,
  ScrollText,
  Target,
  BarChart3,
  RefreshCw,
  Rocket,
  Menu,
  X,
  ChevronLeft,
  ChevronRight,
  User,
  Settings,
  Shield,
} from "lucide-react";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { LogoutButton } from "@/components/LogoutButton";
import { ToastProvider, KeyboardHints } from "@/components/ui";
import { useKeyboardShortcuts, DEFAULT_SHORTCUTS } from "@/hooks/useKeyboardShortcuts";

// Base nav items (always shown)
const baseNavItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/agents", label: "Agents", icon: Bot },
  { href: "/tasks", label: "Tasks", icon: ListTodo },
  { href: "/messages", label: "Messages", icon: MessageSquare },
  { href: "/approvals", label: "Approvals", icon: ShieldCheck },
  { href: "/audit", label: "Audit Log", icon: ScrollText },
  { href: "/goals", label: "Goals", icon: Target },
  { href: "/usage", label: "Usage", icon: BarChart3 },
  { href: "/recurring", label: "Recurring", icon: RefreshCw },
];

// Get nav items based on user state
function getNavItems(showOnboarding: boolean) {
  if (showOnboarding) {
    // Insert Onboarding as second item
    return [
      baseNavItems[0],
      { href: "/onboarding", label: "Onboarding", icon: Rocket },
      ...baseNavItems.slice(1),
    ];
  }
  return baseNavItems;
}

// Routes that don't show the sidebar (truly public routes for unauthenticated users)
const PUBLIC_ROUTES = ["/landing", "/auth/login", "/auth/signup", "/auth/forgot-password"];

function SidebarNav({
  collapsed,
  setCollapsed,
  mobileOpen,
  setMobileOpen,
  showOnboarding = false,
}: {
  collapsed: boolean;
  setCollapsed: (v: boolean) => void;
  mobileOpen: boolean;
  setMobileOpen: (v: boolean) => void;
  showOnboarding?: boolean;
}) {
  const pathname = usePathname();
  const { user, isAdmin } = useAuth();
  
  const navItems = getNavItems(showOnboarding);

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
          fixed lg:static inset-y-0 left-0 z-50
          bg-gray-900 border-r border-gray-800 flex flex-col shrink-0
          transition-all duration-300 ease-out
          ${collapsed ? "w-20" : "w-64"}
          ${mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
        `}
      >
        {/* Logo */}
        <div
          className={`p-4 border-b border-gray-800 flex items-center ${
            collapsed ? "justify-center" : "justify-between"
          }`}
        >
          <Link
            href="/"
            className={`flex items-center gap-3 ${collapsed ? "justify-center" : ""}`}
          >
            <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <Bot className="w-5 h-5 text-white" />
            </div>
            {!collapsed && (
              <div className="overflow-hidden">
                <h1 className="text-lg font-bold text-white tracking-tight whitespace-nowrap">
                  SquadOps
                </h1>
                <p className="text-xs text-gray-500 whitespace-nowrap">AI Operations Hub</p>
              </div>
            )}
          </Link>
          
          {/* Collapse Button (Desktop only) */}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="hidden lg:flex p-1.5 text-gray-500 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? (
              <ChevronRight className="w-4 h-4" />
            ) : (
              <ChevronLeft className="w-4 h-4" />
            )}
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto scrollbar-hide">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            
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
                      ? "bg-indigo-600 text-white shadow-lg shadow-indigo-500/20"
                      : "text-gray-400 hover:text-white hover:bg-gray-800/80"
                  }
                  ${collapsed ? "justify-center" : ""}
                `}
                title={collapsed ? item.label : undefined}
              >
                <Icon
                  className={`
                    w-5 h-5 flex-shrink-0 transition-transform duration-200
                    ${isActive ? "text-white" : "text-gray-400 group-hover:text-white"}
                    ${collapsed ? "" : "group-hover:scale-110"}
                  `}
                />
                {!collapsed && (
                  <span className="truncate whitespace-nowrap">{item.label}</span>
                )}
                
                {/* Active indicator */}
                {isActive && !collapsed && (
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-white/30 rounded-r-full" />
                )}
                
                {/* Tooltip for collapsed state */}
                {collapsed && (
                  <span className="absolute left-full ml-2 px-2 py-1 bg-gray-800 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50">
                    {item.label}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="p-3 border-t border-gray-800 space-y-2">
          {/* Admin Link - Only for admins */}
          {isAdmin && (
            <Link
              href="/admin"
              className={`
                flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium
                text-gray-400 hover:text-white hover:bg-gray-800/80
                transition-all duration-200
                ${collapsed ? "justify-center" : ""}
              `}
              title={collapsed ? "Admin" : undefined}
            >
              <Shield className="w-5 h-5 flex-shrink-0" />
              {!collapsed && <span>Admin</span>}
              {collapsed && (
                <span className="absolute left-full ml-2 px-2 py-1 bg-gray-800 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50">
                  Admin
                </span>
              )}
            </Link>
          )}

          {/* Settings Link */}
          <Link
            href={isAdmin ? "/admin/settings" : "/settings"}
            className={`
              flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium
              text-gray-400 hover:text-white hover:bg-gray-800/80
              transition-all duration-200
              ${collapsed ? "justify-center" : ""}
            `}
            title={collapsed ? "Settings" : undefined}
          >
            <Settings className="w-5 h-5 flex-shrink-0" />
            {!collapsed && <span>Settings</span>}
            {collapsed && (
              <span className="absolute left-full ml-2 px-2 py-1 bg-gray-800 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50">
                Settings
              </span>
            )}
          </Link>

          {/* User Profile */}
          <div
            className={`
              flex items-center gap-3 px-3 py-2.5 rounded-xl
              ${collapsed ? "justify-center" : ""}
            `}
          >
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-gray-700 to-gray-600 flex items-center justify-center text-sm font-semibold text-gray-300 flex-shrink-0">
              <User className="w-4 h-4" />
            </div>
            {!collapsed && (
              <div className="flex-1 min-w-0 overflow-hidden">
                <p className="text-sm font-medium text-gray-300 truncate">{user?.name || "User"}</p>
                <p className="text-xs text-gray-500 truncate">{user?.email || "squadops.ai"}</p>
              </div>
            )}
          </div>

          {/* Logout Button */}
          <div className={collapsed ? "flex justify-center" : ""}>
            <LogoutButton collapsed={collapsed} />
          </div>
        </div>
      </aside>
    </>
  );
}

// Mobile Header
function MobileHeader({ onMenuClick }: { onMenuClick: () => void }) {
  return (
    <div className="lg:hidden flex items-center justify-between p-4 bg-gray-900 border-b border-gray-800 sticky top-0 z-30">
      <Link href="/" className="flex items-center gap-3">
        <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg flex items-center justify-center">
          <Bot className="w-4 h-4 text-white" />
        </div>
        <span className="text-lg font-bold text-white">SquadOps</span>
      </Link>
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

// Inner layout that has access to auth context
function LayoutContent({ children }: { children: React.ReactNode }) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const pathname = usePathname();
  const { isAuthenticated, isLoading, onboarding, onboardingLoading } = useAuth();

  // Register keyboard shortcuts
  useKeyboardShortcuts({ shortcuts: DEFAULT_SHORTCUTS, enabled: isAuthenticated });

  // Check if current route is public (no sidebar)
  const isPublicRoute = PUBLIC_ROUTES.some(route => pathname.startsWith(route));
  
  // Show sidebar only for authenticated users on non-public routes
  const showSidebar = isAuthenticated && !isPublicRoute;
  
  // Determine if onboarding nav item should be shown
  // Show if onboarding is not completed or still loading
  const showOnboardingNav = !onboardingLoading && (!onboarding?.completed);

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 1024) {
        setMobileMenuOpen(false);
      }
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Handle sidebar collapsed state from localStorage
  useEffect(() => {
    const saved = localStorage.getItem("sidebar-collapsed");
    if (saved) {
      setSidebarCollapsed(saved === "true");
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("sidebar-collapsed", String(sidebarCollapsed));
  }, [sidebarCollapsed]);

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-2 border-gray-800 border-t-indigo-500 rounded-full animate-spin" />
          <p className="text-sm text-gray-500">Loading...</p>
        </div>
      </div>
    );
  }

  // Public routes (landing, auth) - no sidebar, full width
  if (isPublicRoute) {
    return <>{children}</>;
  }

  // Authenticated routes with sidebar
  return (
    <div className="flex h-screen overflow-hidden bg-gray-950">
      {showSidebar && (
        <SidebarNav
          collapsed={sidebarCollapsed}
          setCollapsed={setSidebarCollapsed}
          mobileOpen={mobileMenuOpen}
          setMobileOpen={setMobileMenuOpen}
          showOnboarding={showOnboardingNav}
        />
      )}

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <MobileHeader onMenuClick={() => setMobileMenuOpen(true)} />
        <div
          className="flex-1 overflow-y-auto scrollbar-thin"
          style={{
            scrollbarWidth: "thin",
            scrollbarColor: "#374151 #111827",
          }}
        >
          <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <head>
        <title>SquadOps - AI Agent Operations Hub</title>
        <meta name="description" content="Deploy AI Agent Swarms at Scale" />
      </head>
      <body className="bg-gray-950">
        <AuthProvider>
          <ToastProvider>
            <LayoutContent>{children}</LayoutContent>
            <KeyboardHints />
          </ToastProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
