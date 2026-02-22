import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Routes that don't require onboarding completion
const ONBOARDING_EXEMPT_ROUTES = [
  "/landing",
  "/auth/login",
  "/auth/signup",
  "/auth/forgot-password",
  "/onboarding",
  "/admin",  // Admin routes bypass onboarding
];

// Admin routes that should bypass onboarding
const ADMIN_ROUTES = ["/admin", "/admin/"];

// Check if route is exempt from onboarding requirement
function isOnboardingExempt(pathname: string): boolean {
  return ONBOARDING_EXEMPT_ROUTES.some((route) => 
    pathname === route || pathname.startsWith(route + "/")
  );
}

// Check if route is an admin route
function isAdminRoute(pathname: string): boolean {
  return ADMIN_ROUTES.some((route) => 
    pathname === route || pathname.startsWith(route + "/")
  );
}

// Check if user is admin from JWT token
function isAdminUser(token: string | undefined): boolean {
  if (!token) return false;
  try {
    // JWT tokens are base64 encoded in the payload section
    const payload = token.split(".")[1];
    if (!payload) return false;
    const decoded = JSON.parse(Buffer.from(payload, "base64").toString());
    return decoded.role === "admin";
  } catch {
    return false;
  }
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get("token")?.value;
  const onboardingCookie = request.cookies.get("onboarding")?.value;

  // Allow public routes without any checks
  if (isOnboardingExempt(pathname)) {
    // If user is trying to access onboarding but has completed it, redirect to dashboard
    if (pathname === "/onboarding" && onboardingCookie === "completed") {
      return NextResponse.redirect(new URL("/", request.url));
    }
    return NextResponse.next();
  }

  // User is not authenticated - let them through (auth context will handle redirect)
  if (!token) {
    return NextResponse.next();
  }

  // Admin users bypass onboarding for admin routes
  // But they still need to complete onboarding for non-admin routes
  if (isAdminUser(token)) {
    // Allow admin to access admin routes regardless of onboarding status
    if (isAdminRoute(pathname)) {
      return NextResponse.next();
    }
    // For non-admin routes, check onboarding like regular users
    // (fall through to the next check)
  } else {
    // Non-admin users: if trying to access admin routes, redirect to dashboard
    if (isAdminRoute(pathname)) {
      return NextResponse.redirect(new URL("/", request.url));
    }
  }

  // User is authenticated but hasn't completed onboarding
  if (onboardingCookie !== "completed") {
    // Redirect to onboarding
    return NextResponse.redirect(new URL("/onboarding", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // Skip static files and api routes
    "/((?!_next/static|_next/image|favicon.ico|api/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
