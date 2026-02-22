"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Bot, Mail, ArrowLeft, CheckCircle, AlertCircle, Loader2 } from "lucide-react";
import { Button, Card } from "@/components/ui";
import api from "@/lib/api";

export default function ForgotPasswordPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    if (!email.trim()) {
      setError("Email is required");
      setIsLoading(false);
      return;
    }

    try {
      // Call the forgot password API
      await api.post("/auth/forgot-password", {
        email: email.trim().toLowerCase(),
      });

      // Always show success to prevent email enumeration
      setIsSubmitted(true);
    } catch (err: unknown) {
      // Still show success to prevent email enumeration
      const error = err as { response?: { data?: { error?: string } } };
      console.error("Forgot password error:", error);
      setIsSubmitted(true);
    } finally {
      setIsLoading(false);
    }
  };

  if (isSubmitted) {
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
              Check your email
            </h2>
            <p className="text-sm text-gray-400 mb-6">
              We&apos;ve sent a password reset link to{" "}
              <span className="text-gray-300">{email}</span>
            </p>
            <Link href="/auth/login">
              <Button variant="secondary" fullWidth leftIcon={<ArrowLeft className="w-4 h-4" />}>
                Back to sign in
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
              Reset your password
            </h2>
            <p className="text-sm text-gray-400 mt-1">
              Enter your email and we&apos;ll send you a reset link
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
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">
                Email address
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="input-with-icon"
                  required
                  disabled={isLoading}
                />
              </div>
            </div>

            <Button
              type="submit"
              loading={isLoading}
              loadingText="Sending..."
              fullWidth
            >
              Send reset link
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
