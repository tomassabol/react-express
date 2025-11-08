import { Response } from "@lib";
import {
  useContext,
  useSetContext,
  type MiddlewareFunction,
} from "@lib/middleware";
import * as z from "zod";

// Validation middleware - automatically validates against schemas defined on the Route
export const validationMiddleware: MiddlewareFunction = (req, next, res) => {
  // Get schemas from context (set by the route handler)
  const bodySchema = useContext<z.ZodTypeAny>("_bodySchema");
  const querySchema = useContext<z.ZodTypeAny>("_querySchema");
  const paramsSchema = useContext<z.ZodTypeAny>("_paramsSchema");

  const errors: {
    body?: z.ZodError;
    params?: z.ZodError;
    query?: z.ZodError;
  } = {};

  // Validate body if schema provided
  if (bodySchema) {
    const result = bodySchema.safeParse(req.body);
    if (!result.success) {
      errors.body = result.error;
    } else {
      // Update context with validated body
      useSetContext("body", result.data);
    }
  }

  // Validate params if schema provided
  if (paramsSchema) {
    const result = paramsSchema.safeParse(req.params);
    if (!result.success) {
      errors.params = result.error;
    } else {
      // Update context with validated params
      useSetContext("params", result.data);
    }
  }

  // Validate query if schema provided
  if (querySchema) {
    const result = querySchema.safeParse(req.query);
    if (!result.success) {
      errors.query = result.error;
    } else {
      // Update context with validated query
      useSetContext("query", result.data);
    }
  }

  // If there are any validation errors, return 400 response
  if (Object.keys(errors).length > 0) {
    const formattedErrors: Record<string, any> = {};

    if (errors.body) {
      formattedErrors.body = errors.body.issues.map((err: z.ZodIssue) => ({
        path: err.path.join("."),
        message: err.message,
        code: err.code,
      }));
    }

    if (errors.params) {
      formattedErrors.params = errors.params.issues.map((err: z.ZodIssue) => ({
        path: err.path.join("."),
        message: err.message,
        code: err.code,
      }));
    }

    if (errors.query) {
      formattedErrors.query = errors.query.issues.map((err: z.ZodIssue) => ({
        path: err.path.join("."),
        message: err.message,
        code: err.code,
      }));
    }

    return (
      <Response
        status={400}
        json={{
          error: "Validation failed",
          message: "One or more validation errors occurred",
          details: formattedErrors,
        }}
      />
    );
  }

  // All validations passed, continue to next middleware
  return next();
};
