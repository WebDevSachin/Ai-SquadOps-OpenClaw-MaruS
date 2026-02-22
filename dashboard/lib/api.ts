"use client";

import axios, { AxiosError, InternalAxiosRequestConfig } from "axios";

// Base API URL from environment variable or default
export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

// Create axios instance
const api = axios.create({
  baseURL: `${API_BASE_URL}/api`,
  headers: {
    "Content-Type": "application/json",
  },
  timeout: 30000, // 30 second timeout
});

// Extend axios config to include custom properties
interface CustomAxiosRequestConfig extends InternalAxiosRequestConfig {
  _retry?: boolean;
}

// Token management
const getToken = (): string | null => {
  if (typeof window !== "undefined") {
    return localStorage.getItem("token");
  }
  return null;
};

const setToken = (token: string): void => {
  if (typeof window !== "undefined") {
    localStorage.setItem("token", token);
    // Also set as httpOnly cookie via API call if needed
    document.cookie = `token=${token}; path=/; max-age=604800; SameSite=Strict`; // 7 days
  }
};

const removeToken = (): void => {
  if (typeof window !== "undefined") {
    localStorage.removeItem("token");
    document.cookie = "token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
  }
};

// Request interceptor - inject JWT token
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = getToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error: AxiosError) => {
    return Promise.reject(error);
  }
);

// Response interceptor - handle token refresh on 401
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as CustomAxiosRequestConfig;

    if (!originalRequest) {
      return Promise.reject(error);
    }

    // Handle 401 Unauthorized errors
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      // Check if error is due to expired token
      const errorData = error.response.data as { error?: string };
      
      if (errorData?.error?.includes("expired") || errorData?.error?.includes("Invalid token")) {
        // Token is expired or invalid, clear it and redirect to login
        removeToken();
        
        // Only redirect if we're in the browser and not already on auth pages
        if (typeof window !== "undefined" && !window.location.pathname.startsWith("/auth")) {
          window.location.href = "/auth/login?session=expired";
        }
        
        return Promise.reject(error);
      }
    }

    // Handle network errors
    if (!error.response) {
      console.error("Network error - API server may be unavailable");
    }

    return Promise.reject(error);
  }
);

// Export token utilities
export { getToken, setToken, removeToken };

// Export API client
export default api;
