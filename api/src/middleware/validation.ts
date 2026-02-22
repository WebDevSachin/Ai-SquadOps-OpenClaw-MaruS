import { Request, Response, NextFunction } from "express";
import { ZodSchema, ZodError } from "zod";

export interface ValidationError {
  field: string;
  message: string;
}

/**
 * Middleware to validate request body using Zod schema
 */
export function validateBody(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      req.body = schema.parse(req.body);
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const errors: ValidationError[] = error.errors.map((err) => ({
          field: err.path.join("."),
          message: err.message,
        }));
        res.status(400).json({
          error: "Validation failed",
          validation_errors: errors,
        });
        return;
      }
      next(error);
    }
  };
}

/**
 * Middleware to validate request query parameters using Zod schema
 */
export function validateQuery(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      req.query = schema.parse(req.query);
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const errors: ValidationError[] = error.errors.map((err) => ({
          field: err.path.join("."),
          message: err.message,
        }));
        res.status(400).json({
          error: "Validation failed",
          validation_errors: errors,
        });
        return;
      }
      next(error);
    }
  };
}

/**
 * Middleware to validate URL parameters using Zod schema
 */
export function validateParams(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      req.params = schema.parse(req.params);
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const errors: ValidationError[] = error.errors.map((err) => ({
          field: err.path.join("."),
          message: err.message,
        }));
        res.status(400).json({
          error: "Validation failed",
          validation_errors: errors,
        });
        return;
      }
      next(error);
    }
  };
}

/**
 * Combined validation middleware for body, query, and params
 */
export function validate(
  bodySchema?: ZodSchema,
  querySchema?: ZodSchema,
  paramsSchema?: ZodSchema
) {
  return [
    bodySchema ? validateBody(bodySchema) : (_req: Request, _res: Response, next: NextFunction) => next(),
    querySchema ? validateQuery(querySchema) : (_req: Request, _res: Response, next: NextFunction) => next(),
    paramsSchema ? validateParams(paramsSchema) : (_req: Request, _res: Response, next: NextFunction) => next(),
  ];
}

// Common validation schemas for reuse
import { z } from "zod";

export const uuidParamSchema = z.object({
  id: z.string().uuid("Invalid UUID format"),
});

export const paginationSchema = z.object({
  limit: z.coerce.number().min(1).max(100).default(50),
  offset: z.coerce.number().min(0).default(0),
});

export const idParamSchema = z.object({
  id: z.string().min(1, "ID is required"),
});

export const bulkIdsSchema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(100),
});

export const booleanQuerySchema = z.object({
  include: z.string().optional(),
  active: z.coerce.boolean().optional(),
});

export const searchQuerySchema = z.object({
  q: z.string().min(1).max(100).optional(),
  limit: z.coerce.number().min(1).max(100).default(50),
  offset: z.coerce.number().min(0).default(0),
});
