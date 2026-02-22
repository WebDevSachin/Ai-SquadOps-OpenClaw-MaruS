"use client";

import { useEffect, ReactNode } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Shield, Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui";

interface AuthGuardProps {
  children: ReactNode;
  requireAdmin?: boolean;
  fallback?: ReactNode;
}

// Public routes that don't require authentication
const PUBLIC_ROUTES = ["/auth/login", "/auth/signup", "/auth/forgot-password"];

/**
 * AuthGuard component for route protection
 * 
 * Usage:
 * - Wrap pages that require authentication with <AuthGuard>children</AuthGuard>
 * - For admin-only pages: <AuthGuard requireAdmin>children</AuthGuard>
 * - For public auth pages: No wrapper needed, or use with fallback
 */
export function AuthGuard({
  children,
  requireAdmin = false,
  fallback,
}: AuthGuardProps) {
  const { isAuthenticated, isAdmin, isLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (isLoading) return;

    // If not authenticated and not on a public route, redirect to login
    if (!isAuthenticated && !PUBLIC_ROUTES.includes(pathname)) {
      router.push(`/auth/login?redirect=${encodeURIComponent(pathname)}`);
      return;
    }

    // If authenticated but requires admin and user is not admin
    if (isAuthenticated && requireAdmin && !isAdmin) {
      router.push("/"); // Redirect to dashboard
      return;
    }

    // If authenticated and on auth pages, redirect to dashboard
    if (isAuthenticated && PUBLIC_ROUTES.includes(pathname)) {
      router.push("/");
      return;
    }
  }, [isAuthenticated, isAdmin, isLoading, pathname, router, requireAdmin]);

  // Show loading state or fallback while checking authentication
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

  // If authentication is required but user is not authenticated
  if (!isAuthenticated && !PUBLIC_ROUTES.includes(pathname)) {
    return fallback || null;
  }

  // If admin is required but user is not admin
  if (requireAdmin && !isAdmin) {
    return (
      fallback || (
        <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
          <AccessDenied />
        </div>
      )
    );
  }

  return <>{children}</>;
}

// Access Denied Component
function AccessDenied() {
  const router = useRouter();

  return (
    <div className="text-center max-w-md">
      <div className="w-20 h-20 bg-red-900/20 rounded-2xl flex items-center justify-center mx-auto mb-6">
        <Shield className="w-10 h-10 text-red-500" />
      </div>
      <h1 className="text-2xl font-bold text-white mb-2">Access Denied</h1>
      <p className="text-gray-400 mb-6">
        You don&apos;t have permission to access this page. Please contact your administrator if you believe this is a mistake.
      </p>
      <div className="flex items-center justify-center gap-3">
        <Button variant="secondary" onClick={() => router.back()}>
          Go Back
        </Button>
        <Button onClick={() => router.push("/")}>
          Dashboard
        </Button>
      </div>
    </div>
  );
}

/**
 * Helper hook to check if current user can access a route
 */
export function useCanAccess(requireAdmin: boolean = false): boolean {
  const { isAuthenticated, isAdmin, isLoading } = useAuth();

  if (isLoading) return false;
  if (!isAuthenticated) return false;
  if (requireAdmin && !isAdmin) return false;

  return true;
}

/**
 * Component for showing content only to authenticated users
 */
export function AuthenticatedOnly({
  children,
  fallback = null,
}: {
  children: ReactNode;
  fallback?: ReactNode;
}) {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="animate-pulse">
        <div className="h-4 bg-gray-800 rounded w-24" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}

/**
 * Component for showing content only to admin users
 */
export function AdminOnly({
  children,
  fallback = null,
}: {
  children: ReactNode;
  fallback?: ReactNode;
}) {
  const { isAdmin, isLoading, isAuthenticated } = useAuth();

  if (isLoading) {
    return (
      <div className="animate-pulse">
        <div className="h-4 bg-gray-800 rounded w-24" />
      </div>
    );
  }

  if (!isAuthenticated || !isAdmin) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}
