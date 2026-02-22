"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Bot,
  Mail,
  Lock,
  User,
  Eye,
  EyeOff,
  AlertCircle,
  ArrowRight,
  Loader2,
  Check,
  X,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Button, Card } from "@/components/ui";

// Password requirement type
interface PasswordRequirement {
  label: string;
  test: (password: string) => boolean;
}

const passwordRequirements: PasswordRequirement[] = [
  { label: "At least 8 characters", test: (p) => p.length >= 8 },
  { label: "At least 12 characters", test: (p) => p.length >= 12 },
  { label: "Contains lowercase letter", test: (p) => /[a-z]/.test(p) },
  { label: "Contains uppercase letter", test: (p) => /[A-Z]/.test(p) },
  { label: "Contains number", test: (p) => /[0-9]/.test(p) },
  { label: "Contains special character", test: (p) => /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(p) },
];

export default function SignupPage() {
  const router = useRouter();
  const { register } = useAuth();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Calculate password strength
  const passwordStrength = useMemo(() => {
    if (!password) return { score: 0, label: "", color: "" };

    const passedRequirements = passwordRequirements.filter((req) => req.test(password)).length;
    const totalRequirements = passwordRequirements.length;

    if (passedRequirements === 0) return { score: 1, label: "Very Weak", color: "bg-red-500" };
    if (passedRequirements <= 2) return { score: 2, label: "Weak", color: "bg-red-400" };
    if (passedRequirements <= 4) return { score: 3, label: "Medium", color: "bg-yellow-500" };
    if (passedRequirements < totalRequirements) return { score: 4, label: "Strong", color: "bg-green-400" };
    return { score: 5, label: "Very Strong", color: "bg-green-500" };
  }, [password]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    if (!name.trim()) {
      setError("Name is required");
      setIsLoading(false);
      return;
    }

    if (!email.trim()) {
      setError("Email is required");
      setIsLoading(false);
      return;
    }

    // Validate password on client side first
    const validationErrors: string[] = [];
    if (password.length < 8) {
      validationErrors.push("Password must be at least 8 characters");
    }
    if (!/[a-z]/.test(password)) {
      validationErrors.push("Password must contain at least one lowercase letter");
    }
    if (!/[A-Z]/.test(password)) {
      validationErrors.push("Password must contain at least one uppercase letter");
    }
    if (!/[0-9]/.test(password)) {
      validationErrors.push("Password must contain at least one number");
    }
    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
      validationErrors.push("Password must contain at least one special character");
    }

    if (validationErrors.length > 0) {
      setError(validationErrors[0]);
      setIsLoading(false);
      return;
    }

    try {
      const result = await register({
        name: name.trim(),
        email: email.trim(),
        password,
      });

      if (result.success) {
        // Redirect to onboarding for new users
        router.push("/onboarding");
      } else {
        setError(result.error || "Registration failed");
      }
    } catch (err) {
      // Log error for debugging in development
      if (process.env.NODE_ENV === 'development') {
        console.error('Registration error:', err);
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
            <h2 className="text-xl font-semibold text-white">
              Create an account
            </h2>
            <p className="text-sm text-gray-400 mt-1">
              Get started with SquadOps
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-4 p-3 bg-red-900/30 border border-red-800/50 rounded-xl flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-500 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm text-red-200 font-medium">Error</p>
                <p className="text-xs text-red-200/70">{error}</p>
              </div>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Name */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">
                Full name
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="John Doe"
                  className="input-with-icon"
                  required
                  disabled={isLoading}
                />
              </div>
            </div>

            {/* Email */}
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

            {/* Password */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">
                Password
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

              <p className="mt-1.5 text-xs text-gray-500">
                Use at least 8 characters with uppercase, lowercase, number, and special character
              </p>
            </div>

            {/* Submit Button */}
            <Button
              type="submit"
              loading={isLoading}
              loadingText="Creating account..."
              fullWidth
              rightIcon={<ArrowRight className="w-4 h-4" />}
            >
              Create account
            </Button>
          </form>

          {/* Divider */}
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-800" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-gray-900 text-gray-500">
                Already have an account?
              </span>
            </div>
          </div>

          {/* Sign In Link */}
          <Link href="/auth/login">
            <Button variant="secondary" fullWidth>
              Sign in
            </Button>
          </Link>
        </Card>

        {/* Footer */}
        <p className="text-center text-xs text-gray-600 mt-8">
          By creating an account, you agree to our{" "}
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
