"use client";

import { Suspense, useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  Bot,
  Mail,
  Lock,
  Eye,
  EyeOff,
  AlertCircle,
  Loader2,
  ArrowRight,
} from "lucide-react";
import { useAuth, LoginCredentials } from "@/hooks/useAuth";
import { Button, Input, Card } from "@/components/ui";

// Inner component that uses useSearchParams
function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login, isAuthenticated } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [attemptsRemaining, setAttemptsRemaining] = useState<number | null>(null);

  // Get redirect URL from query params
  const redirect = searchParams.get("redirect") || "/";
  const sessionExpired = searchParams.get("session") === "expired";

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      router.push(redirect);
    }
  }, [isAuthenticated, router, redirect]);

    const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setAttemptsRemaining(null);
    setIsLoading(true);

    // Basic validation
    if (!email.trim()) {
      setError("Email is required");
      setIsLoading(false);
      return;
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      setError("Please enter a valid email address");
      setIsLoading(false);
      return;
    }

    if (!password) {
      setError("Password is required");
      setIsLoading(false);
      return;
    }

    try {
      const result = await login({
        email: email.trim(),
        password,
        remember_me: rememberMe,
      } as LoginCredentials & { remember_me?: boolean });

      if (result.success) {
        // Get user role from the auth context after login
        // Determine redirect based on role and onboarding status
        if (result.needsOnboarding) {
          router.push("/onboarding");
        } else {
          // Admin users go to admin dashboard, normal users go to main dashboard
          if (result.isAdmin) {
            router.push("/admin");
          } else {
            router.push(redirect);
          }
        }
      } else {
        // Handle specific error types
        const errorMessage = result.error || "Login failed";

        // Check for account locked error
        if (errorMessage.toLowerCase().includes("locked")) {
          setError(errorMessage);
        } else if (result.attemptsRemaining !== undefined) {
          setAttemptsRemaining(result.attemptsRemaining);
          setError(errorMessage);
        } else {
          setError(errorMessage);
        }
      }
    } catch (err) {
      // Log error for debugging in development
      if (process.env.NODE_ENV === 'development') {
        console.error('Login form error:', err);
      }
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md scale-in">
        {/* Logo */}
        <div className="flex justify-center mb-8">
          <Link href="/" className="flex items-center gap-3 group">
            <div className="w-14 h-14 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-xl shadow-indigo-500/20 transition-transform duration-200 group-hover:scale-105">
              <Bot className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white tracking-tight">
                SquadOps
              </h1>
              <p className="text-xs text-gray-500">AI Agent Operations Hub</p>
            </div>
          </Link>
        </div>

        {/* Card */}
        <Card className="relative overflow-hidden">
          {/* Gradient decoration */}
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500" />
          
          <div className="text-center mb-6">
            <h2 className="text-xl font-semibold text-white">Welcome back</h2>
            <p className="text-sm text-gray-400 mt-1">
              Sign in to your account to continue
            </p>
          </div>

          {/* Session Expired Message */}
          {sessionExpired && (
            <div className="mb-4 p-3 bg-yellow-900/30 border border-yellow-800/50 rounded-xl flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-yellow-500 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm text-yellow-200 font-medium">Session Expired</p>
                <p className="text-xs text-yellow-200/70">
                  Your session has expired. Please sign in again.
                </p>
              </div>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="mb-4 p-3 bg-red-900/30 border border-red-800/50 rounded-xl flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-500 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm text-red-200 font-medium">Error</p>
                <p className="text-xs text-red-200/70">{error}</p>
                {attemptsRemaining !== null && attemptsRemaining > 0 && (
                  <p className="text-xs text-red-200/70 mt-1">
                    {attemptsRemaining} attempt{attemptsRemaining !== 1 ? "s" : ""} remaining before account lockout
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Email */}
            <Input
              label="Email address"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              leftIcon={<Mail className="w-5 h-5" />}
              required
              disabled={isLoading}
              fullWidth
            />

            {/* Password */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500 z-10" />
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="input-with-icon pr-10"
                  required
                  disabled={isLoading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? (
                    <EyeOff className="w-5 h-5" />
                  ) : (
                    <Eye className="w-5 h-5" />
                  )}
                </button>
              </div>
            </div>

            {/* Forgot Password Link */}
            <div className="flex justify-between items-center">
              {/* Remember Me Checkbox */}
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-4 h-4 rounded border-gray-600 bg-gray-800 text-indigo-500 focus:ring-indigo-500 focus:ring-offset-gray-900"
                  disabled={isLoading}
                />
                <span className="text-sm text-gray-400">Remember me</span>
              </label>
              <Link
                href="/auth/forgot-password"
                className="text-sm text-indigo-400 hover:text-indigo-300 transition-colors"
              >
                Forgot password?
              </Link>
            </div>

            {/* Submit Button */}
            <Button
              type="submit"
              loading={isLoading}
              loadingText="Signing in..."
              fullWidth
              rightIcon={<ArrowRight className="w-4 h-4" />}
            >
              Sign in
            </Button>
          </form>

          {/* Divider */}
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-800" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-gray-900 text-gray-500">
                Don&apos;t have an account?
              </span>
            </div>
          </div>

          {/* Sign Up Link */}
          <Link href="/auth/signup">
            <Button variant="secondary" fullWidth>
              Create an account
            </Button>
          </Link>
        </Card>

        {/* Footer */}
        <p className="text-center text-xs text-gray-600 mt-8">
          By signing in, you agree to our{" "}
          <Link href="#" className="text-gray-500 hover:text-gray-400">
            Terms of Service
          </Link>{" "}
          and{" "}
          <Link href="#" className="text-gray-500 hover:text-gray-400">
            Privacy Policy
          </Link>
        </p>
      </div>
    </div>
  );
}

// Loading fallback
function LoginSkeleton() {
  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="flex justify-center mb-8">
          <div className="animate-pulse w-14 h-14 bg-gray-800 rounded-2xl" />
        </div>
        <div className="card animate-pulse">
          <div className="h-6 bg-gray-800 rounded mb-4" />
          <div className="h-4 bg-gray-800 rounded mb-6" />
          <div className="space-y-4">
            <div className="h-12 bg-gray-800 rounded-xl" />
            <div className="h-12 bg-gray-800 rounded-xl" />
            <div className="h-12 bg-gray-800 rounded-xl" />
          </div>
        </div>
      </div>
    </div>
  );
}

// Main page component with Suspense boundary
export default function LoginPage() {
  return (
    <Suspense fallback={<LoginSkeleton />}>
      <LoginForm />
    </Suspense>
  );
}
