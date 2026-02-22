"use client";

import { useState, useMemo, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Bot,
  Lock,
  Eye,
  EyeOff,
  ArrowLeft,
  CheckCircle,
  AlertCircle,
  Loader2,
  Check,
  X,
} from "lucide-react";
import { Button, Card } from "@/components/ui";
import api from "@/lib/api";

// Password requirement type
interface PasswordRequirement {
  label: string;
  test: (password: string) => boolean;
}

const passwordRequirements: PasswordRequirement[] = [
  { label: "At least 8 characters", test: (p) => p.length >= 8 },
  { label: "Contains lowercase letter", test: (p) => /[a-z]/.test(p) },
  { label: "Contains uppercase letter", test: (p) => /[A-Z]/.test(p) },
  { label: "Contains number", test: (p) => /[0-9]/.test(p) },
  { label: "Contains special character", test: (p) => /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(p) },
];

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Calculate password strength
  const passwordStrength = useMemo(() => {
    if (!password) return { score: 0, label: "", color: "" };

    const passedRequirements = passwordRequirements.filter((req) => req.test(password)).length;
    const totalRequirements = passwordRequirements.length;

    if (passedRequirements === 0) return { score: 1, label: "Very Weak", color: "bg-red-500" };
    if (passedRequirements <= 2) return { score: 2, label: "Weak", color: "bg-red-400" };
    if (passedRequirements <= 3) return { score: 3, label: "Medium", color: "bg-yellow-500" };
    if (passedRequirements < totalRequirements) return { score: 4, label: "Strong", color: "bg-green-400" };
    return { score: 5, label: "Very Strong", color: "bg-green-500" };
  }, [password]);

  const passwordsMatch = password && confirmPassword && password === confirmPassword;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!token) {
      setError("Invalid or missing reset token");
      return;
    }

    if (!password) {
      setError("Password is required");
      return;
    }

    if (!confirmPassword) {
      setError("Please confirm your password");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    // Validate password requirements
    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }

    setIsLoading(true);

    try {
      await api.post("/auth/reset-password", {
        token,
        newPassword: password,
      });

      setIsSuccess(true);
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: string; details?: string[] } } };
      const errorMessage = error.response?.data?.error || "Failed to reset password";
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  // Success state
  if (isSuccess) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
        <div className="w-full max-w-md scale-in">
          {/* Logo */}
          <div className="flex justify-center mb-8">
            <Link href="/" className="flex items-center gap-3">
              <div className="w-14 h-14 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-xl shadow-indigo-500/20">
                <Bot className="w-8 h-8 text-white" />
              </div>
            </Link>
          </div>

          <Card className="text-center">
            <div className="w-16 h-16 bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-8 h-8 text-green-400" />
            </div>
            <h2 className="text-xl font-semibold text-white mb-2">
              Password reset successful
            </h2>
            <p className="text-sm text-gray-400 mb-6">
              Your password has been reset. You can now sign in with your new password.
            </p>
            <Link href="/auth/login">
              <Button fullWidth leftIcon={<ArrowLeft className="w-4 h-4" />}>
                Back to sign in
              </Button>
            </Link>
          </Card>
        </div>
      </div>
    );
  }

  // No token provided
  if (!token) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
        <div className="w-full max-w-md scale-in">
          {/* Logo */}
          <div className="flex justify-center mb-8">
            <Link href="/" className="flex items-center gap-3">
              <div className="w-14 h-14 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-xl shadow-indigo-500/20">
                <Bot className="w-8 h-8 text-white" />
              </div>
            </Link>
          </div>

          <Card className="text-center">
            <div className="w-16 h-16 bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="w-8 h-8 text-red-400" />
            </div>
            <h2 className="text-xl font-semibold text-white mb-2">
              Invalid reset link
            </h2>
            <p className="text-sm text-gray-400 mb-6">
              This password reset link is invalid or has expired. Please request a new one.
            </p>
            <Link href="/auth/forgot-password">
              <Button fullWidth>
                Request new reset link
              </Button>
            </Link>
          </Card>
        </div>
      </div>
    );
  }

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
            <h2 className="text-xl font-semibold text-white">
              Create new password
            </h2>
            <p className="text-sm text-gray-400 mt-1">
              Enter your new password below
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-4 p-3 bg-red-900/30 border border-red-800/50 rounded-xl flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-500 mt-0.5 shrink-0" />
              <p className="text-sm text-red-200">{error}</p>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Password */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">
                New password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="input-with-icon pr-10"
                  required
                  disabled={isLoading}
                  minLength={8}
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

              {/* Password Strength Meter */}
              {password && (
                <div className="mt-3">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="flex-1 h-1.5 bg-gray-800 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${passwordStrength.color} transition-all duration-300`}
                        style={{ width: `${(passwordStrength.score / 5) * 100}%` }}
                      />
                    </div>
                    <span className="text-xs text-gray-400">{passwordStrength.label}</span>
                  </div>

                  {/* Password Requirements */}
                  <div className="grid grid-cols-1 gap-1">
                    {passwordRequirements.slice(0, 4).map((req, index) => {
                      const passed = req.test(password);
                      return (
                        <div
                          key={index}
                          className="flex items-center gap-2 text-xs"
                        >
                          {passed ? (
                            <Check className="w-3 h-3 text-green-500" />
                          ) : (
                            <X className="w-3 h-3 text-gray-600" />
                          )}
                          <span className={passed ? "text-green-400" : "text-gray-500"}>
                            {req.label}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Confirm Password */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">
                Confirm new password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                <input
                  type={showPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  className="input-with-icon pr-10"
                  required
                  disabled={isLoading}
                  minLength={8}
                />
              </div>
              {confirmPassword && (
                <div className="flex items-center gap-2 mt-2 text-xs">
                  {passwordsMatch ? (
                    <>
                      <Check className="w-3 h-3 text-green-500" />
                      <span className="text-green-400">Passwords match</span>
                    </>
                  ) : (
                    <>
                      <X className="w-3 h-3 text-red-500" />
                      <span className="text-red-400">Passwords do not match</span>
                    </>
                  )}
                </div>
              )}
            </div>

            <Button
              type="submit"
              loading={isLoading}
              loadingText="Resetting..."
              fullWidth
              disabled={!passwordsMatch}
            >
              Reset password
            </Button>
          </form>

          {/* Back Link */}
          <div className="mt-6 text-center">
            <Link
              href="/auth/login"
              className="text-sm text-gray-400 hover:text-white transition-colors inline-flex items-center gap-1"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to sign in
            </Link>
          </div>
        </Card>
      </div>
    </div>
  );
}

// Loading fallback
function ResetPasswordSkeleton() {
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
export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<ResetPasswordSkeleton />}>
      <ResetPasswordForm />
    </Suspense>
  );
}
