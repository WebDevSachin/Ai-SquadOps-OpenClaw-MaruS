"use client";

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
} from "lucide-react";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { LogoutButton } from "@/components/LogoutButton";

const navItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/onboarding", label: "Onboarding", icon: Rocket },
  { href: "/agents", label: "Agents", icon: Bot },
  { href: "/tasks", label: "Tasks", icon: ListTodo },
  { href: "/messages", label: "Messages", icon: MessageSquare },
  { href: "/approvals", label: "Approvals", icon: ShieldCheck },
  { href: "/audit", label: "Audit Log", icon: ScrollText },
  { href: "/goals", label: "Goals", icon: Target },
  { href: "/usage", label: "Usage", icon: BarChart3 },
  { href: "/recurring", label: "Recurring", icon: RefreshCw },
];

// Auth routes that shouldn't show the sidebar
const AUTH_ROUTES = ["/auth/login", "/auth/signup", "/auth/forgot-password"];

function Sidebar() {
  const pathname = usePathname();
  const { isAuthenticated, isLoading } = useAuth();

  // Don't show sidebar on auth pages
  if (AUTH_ROUTES.some((route) => pathname?.startsWith(route))) {
    return null;
  }

  return (
    <aside className="w-64 bg-gray-900 border-r border-gray-800 flex flex-col shrink-0">
      {/* Logo */}
      <div className="p-6 border-b border-gray-800">
        <Link href="/" className="flex items-center gap-3">
          <div className="w-9 h-9 bg-indigo-600 rounded-lg flex items-center justify-center">
            <Bot className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-white tracking-tight">
              SquadOps
            </h1>
            <p className="text-xs text-gray-500">Ops Hub</p>
          </div>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? "text-white bg-gray-800"
                  : "text-gray-400 hover:text-white hover:bg-gray-800"
              }`}
            >
              <item.icon className="w-4.5 h-4.5" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-gray-800 space-y-2">
        {isLoading ? (
          <div className="flex items-center gap-3 px-3 py-2">
            <div className="w-8 h-8 rounded-full bg-gray-700 animate-pulse" />
            <div className="space-y-1">
              <div className="h-3 w-16 bg-gray-700 rounded animate-pulse" />
              <div className="h-2 w-12 bg-gray-700 rounded animate-pulse" />
            </div>
          </div>
        ) : isAuthenticated ? (
          <>
            <div className="flex items-center gap-3 px-3 py-2">
              <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-xs font-semibold text-white">
                SO
              </div>
              <div>
                <p className="text-sm font-medium text-gray-300">Admin</p>
                <p className="text-xs text-gray-500">squadops.ai</p>
              </div>
            </div>
            <LogoutButton />
          </>
        ) : (
          <Link
            href="/auth/login"
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
          >
            <LayoutDashboard className="w-4.5 h-4.5" />
            Sign In
          </Link>
        )}
      </div>
    </aside>
  );
}

function LayoutContent({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAuthPage = AUTH_ROUTES.some((route) => pathname?.startsWith(route));

  if (isAuthPage) {
    // Auth pages don't have sidebar
    return <>{children}</>;
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-y-auto bg-gray-950">
        <div className="p-8">{children}</div>
      </main>
    </div>
  );
}

export function ClientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthProvider>
      <LayoutContent>{children}</LayoutContent>
    </AuthProvider>
  );
}
