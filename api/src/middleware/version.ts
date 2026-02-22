import { Request, Response, NextFunction } from "express";

export interface ApiVersionRequest extends Request {
  apiVersion?: string;
}

export const API_VERSIONS = ["v1"] as const;
export type ApiVersion = typeof API_VERSIONS[number];

/**
 * Middleware to detect and validate API version from request
 * Checks Accept header or URL prefix for version
 */
export function versionDetection(
  req: ApiVersionRequest,
  res: Response,
  next: NextFunction
): void {
  let version: string | undefined;

  // Check URL prefix first (e.g., /api/v1/...)
  const urlMatch = req.path.match(/^\/v(\d+)/);
  if (urlMatch) {
    version = `v${urlMatch[1]}`;
  }

  // Check Accept header (e.g., application/vnd.squadops.v1+json)
  const acceptHeader = req.headers.accept || "";
  const acceptMatch = acceptHeader.match(/application\/vnd\.squadops\.(v\d+)/);
  if (acceptMatch) {
    version = acceptMatch[1];
  }

  // Validate version
  if (version && !API_VERSIONS.includes(version as ApiVersion)) {
    res.status(400).json({
      error: "Unsupported API version",
      supported_versions: API_VERSIONS,
      requested_version: version,
    });
    return;
  }

  req.apiVersion = version || "v1";
  next();
}

/**
 * Middleware to redirect old routes to versioned routes
 * Excludes auth routes to avoid breaking login/registration
 */
export function versionRedirect(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // If path starts with /api/ but not /api/v/
  // Exclude auth, onboarding, health, and docs routes - they work without version prefix
  const excludedPaths = [
    "/api/auth/",
    "/api/auth/signup",
    "/api/onboarding",
    "/api/tasks",
    "/api/goals",
    "/api/workflows",
    "/api/agents",
    "/api/swarm",
    "/api/health",
    "/api/docs",
    "/api/provider-keys",
    "/api/usage",
    "/api/messages",
    "/api/audit"
  ];
  
  const isExcluded = excludedPaths.some(path => req.path.startsWith(path));
  
  if (req.path.startsWith("/api/") && !req.path.match(/^\/api\/v\d+/) && !isExcluded) {
    const newPath = req.path.replace(/^\/api\//, "/api/v1/");
    res.redirect(301, newPath);
    return;
  }
  next();
}

/**
 * Response format wrapper for consistent API responses
 */
export function formatResponse<T>(data: T, meta?: Record<string, unknown>): {
  data: T;
  meta?: Record<string, unknown>;
  timestamp: string;
} {
  return {
    data,
    meta,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Error response formatter
 */
export function formatError(
  message: string,
  code?: string,
  details?: unknown
): {
  error: string;
  code?: string;
  details?: unknown;
  timestamp: string;
} {
  return {
    error: message,
    code,
    details,
    timestamp: new Date().toISOString(),
  };
}
