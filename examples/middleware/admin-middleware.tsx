import { useSetContext, type MiddlewareFunction } from "@lib/middleware";

// Another route-specific middleware
export const adminLogMiddleware: MiddlewareFunction = (req, next, res) => {
  console.log(
    `🔐 Admin route accessed: ${req.path} at ${new Date().toISOString()}`
  );

  useSetContext("adminAccess", true);

  return next();
};
