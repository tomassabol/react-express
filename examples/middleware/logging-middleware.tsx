import { useSetContext, type MiddlewareFunction } from "@lib/middleware";

// Logging middleware example
export const loggingMiddleware: MiddlewareFunction = (req, next, res) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);

  // Add request timestamp to context
  useSetContext("requestTimestamp", Date.now());

  return next();
};
