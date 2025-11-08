import { useSetContext, type MiddlewareFunction } from "@lib/middleware";

// Route-specific middleware example
export const slowRouteMiddleware: MiddlewareFunction = (req, next, res) => {
  console.log(`⏱️ Slow route accessed: ${req.path}`);

  // Simulate some processing time
  useSetContext("processStartTime", Date.now());

  return next();
};
