"use client";

import { useState, useEffect, useCallback, createContext, useContext, ReactNode } from "react";
import { useRouter } from "next/navigation";
import axios from "axios";
import api, { setToken, removeToken, getToken } from "@/lib/api";

// User type definition
export interface User {
  id: string;
  email: string;
  name: string;
  role: "admin" | "member" | string;
  created_at?: string;
  onboardingCompleted?: boolean;
}

// Onboarding status type
interface OnboardingStatus {
  completed: boolean;
  completedAt?: string;
  skipped?: boolean;
}

// Auth context type
interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isAdmin: boolean;
  onboarding: OnboardingStatus | null;
  onboardingLoading: boolean;
  login: (credentials: LoginCredentials) => Promise<LoginResult>;
  logout: () => void;
  register: (data: RegisterData) => Promise<{ success: boolean; error?: string; needsOnboarding?: boolean }>;
  refreshUser: () => Promise<void>;
  refreshOnboarding: () => Promise<void>;
}

// Login credentials type
export interface LoginCredentials {
  email: string;
  password: string;
  remember_me?: boolean;
}

// Login result type
export interface LoginResult {
  success: boolean;
  error?: string;
  needsOnboarding?: boolean;
  isAdmin?: boolean;
  attemptsRemaining?: number;
}

// Register data type
export interface RegisterData {
  name: string;
  email: string;
  password: string;
}

// Create auth context
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Auth provider component
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [onboarding, setOnboarding] = useState<OnboardingStatus | null>(null);
  const [onboardingLoading, setOnboardingLoading] = useState(false);
  const router = useRouter();

  // Check if user is authenticated
  const isAuthenticated = !!user;
  const isAdmin = user?.role === "admin";

  // Fetch current user on mount
  const refreshUser = useCallback(async () => {
    const token = getToken();
    if (!token) {
      setIsLoading(false);
      return;
    }

    try {
      // Check if impersonating
      const impersonationData = localStorage.getItem("impersonation_data");
      if (impersonationData) {
        const parsed = JSON.parse(impersonationData);
        if (parsed.isImpersonating && parsed.impersonatedUser) {
          // Use impersonated user data instead of calling API
          setUser(parsed.impersonatedUser);
          setIsLoading(false);
          return;
        }
      }

      const response = await api.get("/auth/me");
      setUser((response.data as { user: User }).user);
    } catch (error) {
      console.error("Failed to fetch user:", error);
      removeToken();
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Fetch onboarding status
  const refreshOnboarding = useCallback(async () => {
    const token = getToken();
    if (!token) return;

    setOnboardingLoading(true);
    try {
      const response = await api.get("/onboarding/status");
      const onboardingData = response.data.onboarding;
      setOnboarding(onboardingData);
      
      // Sync cookie with onboarding status for middleware
      if (typeof document !== "undefined") {
        if (onboardingData.completed) {
          document.cookie = "onboarding=completed; path=/; max-age=2592000"; // 30 days
        } else {
          document.cookie = "onboarding=pending; path=/; max-age=2592000";
        }
      }
    } catch (error) {
      console.error("Failed to fetch onboarding status:", error);
      setOnboarding(null);
      // Assume not completed if error
      if (typeof document !== "undefined") {
        document.cookie = "onboarding=pending; path=/; max-age=2592000";
      }
    } finally {
      setOnboardingLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  useEffect(() => {
    if (user) {
      refreshOnboarding();
    }
  }, [user, refreshOnboarding]);

  // Login function
  const login = async (
    credentials: LoginCredentials
  ): Promise<LoginResult> => {
    try {
      const { remember_me, ...loginData } = credentials;
      const response = await api.post("/auth/login", {
        ...loginData,
        remember_me,
      });
      const { accessToken, user } = response.data as { accessToken: string; user: User };

      setToken(accessToken);
      setUser(user);

      // Use onboarding status from login response
      const onboardingCompleted = user.onboardingCompleted;
      
      // Set cookie for middleware
      if (typeof document !== "undefined") {
        if (onboardingCompleted) {
          document.cookie = "onboarding=completed; path=/; max-age=2592000; SameSite=Lax"; // 30 days
        } else {
          document.cookie = "onboarding=pending; path=/; max-age=2592000; SameSite=Lax";
        }
      }
      
      setOnboarding({ completed: !!onboardingCompleted });
      
      return { 
        success: true, 
        needsOnboarding: !onboardingCompleted,
        isAdmin: user.role === "admin"
      };
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const message = error.response?.data?.error || "Login failed";
        const attemptsRemaining = error.response?.data?.attemptsRemaining;
        return { 
          success: false, 
          error: message,
          ...(attemptsRemaining !== undefined && { attemptsRemaining })
        };
      }
      return { success: false, error: "An unexpected error occurred" };
    }
  };

  // Logout function
  const logout = useCallback(() => {
    removeToken();
    setUser(null);
    router.push("/auth/login");
  }, [router]);

  // Register function
  const register = async (
    data: RegisterData
  ): Promise<{ success: boolean; error?: string; needsOnboarding?: boolean }> => {
    try {
      await api.post("/auth/register", data);
      
      // Auto-login after successful registration
      const loginResult = await login({
        email: data.email,
        password: data.password,
      });

      if (loginResult.success) {
        // New users always need onboarding
        return { success: true, needsOnboarding: true };
      } else {
        // Registration succeeded but login failed
        return {
          success: true,
          error: "Account created but auto-login failed. Please log in manually.",
        };
      }
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const message = error.response?.data?.error || "Registration failed";
        return { success: false, error: message };
      }
      return { success: false, error: "An unexpected error occurred" };
    }
  };

  const value: AuthContextType = {
    user,
    isLoading,
    isAuthenticated,
    isAdmin,
    onboarding,
    onboardingLoading,
    login,
    logout,
    register,
    refreshUser,
    refreshOnboarding,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// Custom hook to use auth context
export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
