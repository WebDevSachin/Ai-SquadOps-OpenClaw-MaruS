"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { Shield, ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui";
import { useAuth } from "@/hooks/useAuth";
import { useImpersonation } from "@/hooks/useImpersonation";

// Use actual auth hook for admin check
function useAdminCheck() {
  const { isAdmin, isLoading } = useAuth();
  const { isImpersonating } = useImpersonation();
  // When impersonating, user is NOT admin (even if they were originally)
  return { isAdmin: isAdmin && !isImpersonating, isLoading, isImpersonating };
}

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isAdmin, isLoading, isImpersonating } = useAdminCheck();
  const pathname = usePathname();
  const router = useRouter();

  // Redirect to dashboard if impersonating (can't access admin)
  useEffect(() => {
    if (!isLoading && isImpersonating) {
      router.push("/");
    }
  }, [isLoading, isImpersonating, router]);

  // Admin nav items - shown as tabs instead of nested sidebar
  const adminNavItems = [
    { href: "/admin", label: "Overview" },
    { href: "/admin/users", label: "Users" },
    { href: "/admin/swarm", label: "Agent Swarm" },
    { href: "/admin/settings", label: "Settings" },
  ];

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
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
      <div className="flex h-full items-center justify-center p-4">
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
    <div className="h-full overflow-y-auto">
      <div className="max-w-7xl mx-auto">
        {/* Admin Header with Tabs */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-gradient-to-br from-red-500 to-orange-600 rounded-xl flex items-center justify-center shadow-lg shadow-red-500/20">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white tracking-tight">
                Admin Dashboard
              </h1>
              <p className="text-sm text-gray-500">Manage your SquadOps deployment</p>
            </div>
          </div>

          {/* Tab Navigation */}
          <nav className="flex items-center gap-1 border-b border-gray-800">
            {adminNavItems.map((item) => {
              const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`
                    px-4 py-3 text-sm font-medium transition-colors relative
                    ${isActive 
                      ? "text-white" 
                      : "text-gray-400 hover:text-white hover:bg-gray-800/50"
                    }
                  `}
                >
                  {item.label}
                  {isActive && (
                    <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-red-500" />
                  )}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Page Content */}
        {children}
      </div>
    </div>
  );
}
