import express, {
  type Request,
  type Response,
  type RequestHandler,
} from "express";
import type { IncomingHttpHeaders } from "http";
import { type ReactNode } from "react";
import cors from "cors";
import type {
  ContextKey,
  RouteContext,
  MethodsWithBody,
  HttpMethod,
} from "@lib/types";
import type { ZodTypeAny } from "zod";

// Context to hold req/res for useRoute() and middleware context
let routeContext:
  | (RouteContext<any, any, any> & { middlewareContext: Map<string, any> })
  | null = null;

// Global context that can be used from anywhere
const globalContext = new Map<string, any>();

export function useRoute<
  P = Record<string, string>,
  Q = unknown,
  B = unknown,
>(): RouteContext<P, Q, B> & { middlewareContext: Map<string, any> };
export function useRoute<P, Q, B>(
  ctx?: RouteContext<P, Q, B>
): RouteContext<P, Q, B> & { middlewareContext: Map<string, any> };
export function useRoute(..._args: any[]) {
  if (!routeContext) throw new Error("useRoute must be used inside a Route");
  return routeContext;
}

/**
 * Set a value into the current request's context (or global context if outside a request).
 * Prefer using a `ContextKey<T>` from `@lib/types` for typed access.
 */
export function useSetContext(key: string | ContextKey<any>, value: any) {
  const resolvedKey = typeof key === "string" ? key : key.key;
  if (routeContext) {
    // If we're inside a route/middleware, use the route context
    routeContext.middlewareContext.set(resolvedKey, value);
    // Also update routeContext properties for body, query, and params to keep them in sync
    if (resolvedKey === "body") {
      routeContext.body = value;
    } else if (resolvedKey === "query") {
      routeContext.query = value;
    } else if (resolvedKey === "params") {
      routeContext.params = value;
    }
  } else {
    // If we're outside a route/middleware, use the global context
    globalContext.set(resolvedKey, value);
  }
}

/**
 * Read a value from the current request's context (or global context).
 * Pass a `ContextKey<T>` to get fully-typed results.
 */
export function useContext<P, Q, B>(
  ctx?: RouteContext<P, Q, B>
): {
  body: B;
  query: Q;
  params: P;
  req: Request<P, any, B, Q>;
  res: Response;
  path: string;
  method: HttpMethod;
  headers: IncomingHttpHeaders;
};
export function useContext<P, Q, B>(
  key: "body",
  ctx?: RouteContext<P, Q, B>
): B;
export function useContext<P, Q, B>(
  key: "query",
  ctx?: RouteContext<P, Q, B>
): Q;
export function useContext<P, Q, B>(
  key: "params",
  ctx?: RouteContext<P, Q, B>
): P;
export function useContext<P, Q, B>(
  key: "req",
  ctx?: RouteContext<P, Q, B>
): Request<P, any, B, Q>;
export function useContext<P, Q, B>(
  key: "res",
  ctx?: RouteContext<P, Q, B>
): Response;
export function useContext<P, Q, B>(
  key: "path",
  ctx?: RouteContext<P, Q, B>
): string;
export function useContext<P, Q, B>(
  key: "method",
  ctx?: RouteContext<P, Q, B>
): HttpMethod;
export function useContext<P, Q, B>(
  key: "headers",
  ctx?: RouteContext<P, Q, B>
): IncomingHttpHeaders;
export function useContext<T = any>(key: string | ContextKey<T>, ctx?: any): T;
export function useContext<T = any>(
  keyOrCtx?: string | ContextKey<T> | RouteContext<any, any, any>,
  _ctx?: any
): any {
  // Helper to get a value by key from route/global context
  const getFromContext = (k: string) => {
    if (routeContext) {
      const routeValue = routeContext.middlewareContext.get(k);
      if (routeValue !== undefined) return routeValue;
      return globalContext.get(k);
    }
    return globalContext.get(k);
  };

  // If called as useContext(ctx) (or with no arg), return a convenience object
  const isRouteCtxLike =
    keyOrCtx &&
    typeof keyOrCtx === "object" &&
    // Detect by presence of req which RouteContext has at type-level
    // (at runtime, ctx is typically undefined; this check is defensive)
    "req" in (keyOrCtx as any);
  if (keyOrCtx === undefined || isRouteCtxLike) {
    return {
      body: getFromContext("body"),
      query: getFromContext("query"),
      params: getFromContext("params"),
      req: getFromContext("req"),
      res: getFromContext("res"),
      path: getFromContext("path"),
      method: getFromContext("method"),
      headers: getFromContext("headers"),
    };
  }

  // Backwards-compatible key-based access
  const resolvedKey =
    typeof keyOrCtx === "string" ? keyOrCtx : (keyOrCtx as any).key;
  if (routeContext) {
    const routeValue = routeContext.middlewareContext.get(resolvedKey);
    if (routeValue !== undefined) return routeValue as T;
    return globalContext.get(resolvedKey) as T;
  }
  return globalContext.get(resolvedKey) as T;
}

// Middleware type
export type Middleware<P = Record<string, string>, B = unknown, Q = unknown> = (
  req: Request<P, any, B, Q>,
  next: () => any,
  res: Response
) => any;

// Internal store for routes, middlewares and config
const routes: {
  method: string;
  path: string;
  handler: Function;
  middlewares: Middleware[];
  querySchema?: ZodTypeAny;
  bodySchema?: ZodTypeAny;
}[] = [];
let appConfig: { port?: number; cors?: boolean | cors.CorsOptions } = {};

// Component processor
function processElement(
  element: any,
  pathPrefix: string = "",
  middlewares: Middleware[] = []
): void {
  if (!element) return;

  if (Array.isArray(element)) {
    element.forEach((el) => processElement(el, pathPrefix, middlewares));
    return;
  }

  if (typeof element === "object") {
    // Handle React elements with function components
    if (typeof element.type === "function") {
      // Call the function component to get its JSX result
      const result = element.type(element.props || {});
      processElement(result, pathPrefix, middlewares);
      return;
    }

    if (element.type) {
      if (
        element.type === "App" ||
        (element.type && element.type.name === "App")
      ) {
        // Extract app configuration
        const props = element.props || {};
        appConfig = {
          port: props.port || 9000,
          cors: props.cors,
        };

        // Collect App-level middleware
        let appMiddlewares = [...middlewares];
        if (props.middleware) {
          if (Array.isArray(props.middleware)) {
            appMiddlewares.push(...props.middleware);
          } else {
            appMiddlewares.push(props.middleware);
          }
        }

        // Process children with App-level middleware
        if (props.children) {
          if (Array.isArray(props.children)) {
            props.children.forEach((child: any) =>
              processElement(child, pathPrefix, appMiddlewares)
            );
          } else {
            processElement(props.children, pathPrefix, appMiddlewares);
          }
        }
        return;
      }

      if (
        element.type === "RouteGroup" ||
        (element.type && element.type.name === "RouteGroup")
      ) {
        // Handle RouteGroup component
        const props = element.props || {};
        const groupPrefix = props.prefix
          ? `${pathPrefix}${props.prefix}`
          : pathPrefix;

        // Start with inherited middlewares (from App or parent RouteGroup)
        let groupMiddlewares = [...middlewares];

        // Add RouteGroup-level middleware from prop
        if (props.middleware) {
          if (Array.isArray(props.middleware)) {
            groupMiddlewares.push(...props.middleware);
          } else {
            groupMiddlewares.push(props.middleware);
          }
        }

        // Process children to collect middlewares and routes
        if (props.children) {
          const children = Array.isArray(props.children)
            ? props.children
            : [props.children];

          // First pass: collect all middleware components in this group
          children.forEach((child: any) => {
            if (
              child &&
              typeof child === "object" &&
              (child.type === "Middleware" ||
                (child.type && child.type.name === "Middleware"))
            ) {
              const middlewareProps = child.props || {};
              if (middlewareProps.use) {
                if (Array.isArray(middlewareProps.use)) {
                  groupMiddlewares.push(...middlewareProps.use);
                } else if (typeof middlewareProps.use === "function") {
                  groupMiddlewares.push(middlewareProps.use);
                }
              }
            }
          });

          // Second pass: process all children with the accumulated middlewares
          children.forEach((child: any) => {
            // Skip middleware components in second pass since we already processed them
            if (
              !(
                child &&
                typeof child === "object" &&
                (child.type === "Middleware" ||
                  (child.type && child.type.name === "Middleware"))
              )
            ) {
              processElement(child, groupPrefix, groupMiddlewares);
            }
          });
        }
        return;
      }

      if (
        element.type === "Route" ||
        (element.type && element.type.name === "Route")
      ) {
        const props = element.props || {};
        if (props.path && props.children) {
          if (!props.method) {
            throw new Error(
              `Route with path "${props.path}" is missing a required "method" property`
            );
          }
          const fullPath = `${pathPrefix}${props.path}`;

          // Combine RouteGroup middlewares with Route-level middlewares
          let routeMiddlewares = [...middlewares];

          if (props.middleware) {
            if (Array.isArray(props.middleware)) {
              routeMiddlewares.push(...props.middleware);
            } else {
              routeMiddlewares.push(props.middleware);
            }
          }

          // Validate that body schema is only used with methods that allow a body
          const bodyAllowedMethods: MethodsWithBody[] = [
            "POST",
            "PUT",
            "PATCH",
            "DELETE",
          ];
          if (
            props.body &&
            !bodyAllowedMethods.includes(
              String(props.method).toUpperCase() as MethodsWithBody
            )
          ) {
            throw new Error(
              `Route ${String(props.method).toUpperCase()} ${fullPath} cannot declare a body schema. Allowed only for ${bodyAllowedMethods.join(
                ", "
              )}.`
            );
          }

          routes.push({
            method: props.method.toLowerCase(),
            path: fullPath,
            handler: props.children,
            middlewares: routeMiddlewares,
            querySchema: props.query as ZodTypeAny | undefined,
            bodySchema: props.body as ZodTypeAny | undefined,
          });
        }
        return;
      }
    }

    // Process children for non-RouteGroup elements
    if (element.props && element.props.children) {
      if (Array.isArray(element.props.children)) {
        element.props.children.forEach((child: any) =>
          processElement(child, pathPrefix, middlewares)
        );
      } else {
        processElement(element.props.children, pathPrefix, middlewares);
      }
    }
  }
}

export function serve(element: ReactNode) {
  // Clear routes and config before processing
  routes.length = 0;
  appConfig = {};

  // Process the React element tree to extract routes and config
  processElement(element);

  const port = appConfig.port || 6969;

  // Express
  const app = express();
  app.use(express.json());

  // Apply CORS if enabled in App props
  if (appConfig.cors) {
    app.use(cors(appConfig.cors === true ? {} : appConfig.cors));
  }

  // Unified output handler to reduce duplication across methods
  const sendResponseFromOutput = (res: Response, output: any): void => {
    if (!output) {
      if (!res.headersSent) {
        res.status(500).json({ error: "No response generated" });
      }
      return;
    }

    if (typeof output === "object") {
      const isResponseElement = Boolean(
        output.type &&
          (output.type === "Response" || output.type?.name === "Response")
      );

      if (isResponseElement) {
        const { status, json, text, html, headers, redirect } =
          output.props || {};

        if (headers && typeof headers === "object") {
          for (const [h, v] of Object.entries(headers)) {
            res.setHeader(h, v as any);
          }
        }

        if (redirect) {
          if (status && typeof status === "number") {
            res.redirect(status, redirect);
          } else {
            res.redirect(302, redirect);
          }
          return;
        }

        if (text !== undefined) {
          if (status) res.status(status);
          res.type("text/plain").send(String(text));
          return;
        }

        if (html !== undefined) {
          if (status) res.status(status);
          res.type("text/html").send(String(html));
          return;
        }

        if (json !== undefined) {
          if (status) res.status(status);
          res.json(json);
          return;
        }

        // If status specified without body, just end with status
        if (status) {
          res.status(status).end();
          return;
        }

        res.status(200).end();
        return;
      }

      if (!res.headersSent) {
        res.status(500).json({ error: "Invalid response format" });
      }
      return;
    }

    // Primitive outputs are sent as text
    res.send(String(output));
  };

  // Shared request handler factory used for all HTTP methods
  const createExpressHandler = (
    handler: Function,
    middlewares: Middleware[] = [],
    bodySchema?: ZodTypeAny,
    querySchema?: ZodTypeAny
  ) => {
    const wrapped: RequestHandler = async (req: Request, res: Response) => {
      routeContext = {
        req,
        res,
        params: req.params,
        query: req.query,
        body: req.body,
        middlewareContext: new Map<string, any>(),
      };

      try {
        // Seed common request context values for convenient access via useContext(...)
        routeContext.middlewareContext.set("req", req);
        routeContext.middlewareContext.set("res", res);
        routeContext.middlewareContext.set("params", req.params);
        routeContext.middlewareContext.set("path", req.path);
        routeContext.middlewareContext.set("method", req.method as HttpMethod);
        routeContext.middlewareContext.set("headers", req.headers);
        routeContext.middlewareContext.set("query", routeContext.query);
        routeContext.middlewareContext.set("body", routeContext.body);

        // Store schemas in context for validation middleware to use
        if (bodySchema) {
          routeContext.middlewareContext.set("_bodySchema", bodySchema);
        }
        if (querySchema) {
          routeContext.middlewareContext.set("_querySchema", querySchema);
        }

        // Execute middlewares in sequence
        let middlewareIndex = 0;

        const executeNextMiddleware = async (): Promise<any> => {
          if (middlewareIndex >= middlewares.length) {
            // All middlewares executed, run the main handler
            return await handler();
          }

          const currentMiddleware = middlewares[middlewareIndex++];
          return await currentMiddleware?.(req, executeNextMiddleware, res);
        };

        const output = await executeNextMiddleware();
        sendResponseFromOutput(res, output);
      } catch (error) {
        console.error("Route handler error:", error);
        if (!res.headersSent) {
          res.status(500).json({ error: "Internal server error" });
        }
      } finally {
        routeContext = null;
      }
    };
    return wrapped;
  };

  // Register all routes for supported HTTP methods
  const regularRoutes = routes.filter((route) => route.path !== "*");
  const wildcardRoutes = routes.filter((route) => route.path === "*");

  // Collect allowed methods per path for 405 handling
  const methodsByPath: { [path: string]: string[] } = {};
  for (const route of regularRoutes) {
    if (!methodsByPath[route.path]) {
      methodsByPath[route.path] = [];
    }
    if (!methodsByPath[route.path]?.includes(route.method.toUpperCase())) {
      methodsByPath[route.path]?.push(route.method.toUpperCase());
    }
  }

  for (const route of regularRoutes) {
    const method = route.method.toLowerCase();

    const registrar: Record<
      string,
      (path: string, ...handlers: RequestHandler[]) => any
    > = {
      get: app.get.bind(app),
      post: app.post.bind(app),
      put: app.put.bind(app),
      patch: app.patch.bind(app),
      delete: app.delete.bind(app),
      options: app.options.bind(app),
      head: app.head.bind(app),
      all: app.all.bind(app),
    };

    const register = registrar[method];
    if (register) {
      register(
        route.path,
        createExpressHandler(
          route.handler,
          route.middlewares,
          route.bodySchema,
          route.querySchema
        )
      );
    } else {
      console.warn(`Unsupported HTTP method: ${route.method}`);
    }
  }

  app.use((req: Request, res: Response, next: any) => {
    const path = req.path;
    if (methodsByPath[path] && !methodsByPath[path].includes(req.method)) {
      res.set("Allow", methodsByPath[path].join(", "));

      console.log(
        `\n🚫  [405 Method Not Allowed]\n` +
          `   ✦ Path: ${path}\n` +
          `   ✦ Tried: ${req.method}\n` +
          `   ✦ Allowed: ${methodsByPath[path].join(", ")}\n`
      );

      res.status(405).json({
        error: "Method Not Allowed",
        message: `Method ${req.method} is not allowed for path ${path}`,
        path,
        method: req.method,
      });
    } else {
      next();
    }
  });

  const hasCustomWildcard = wildcardRoutes.length > 0;

  if (hasCustomWildcard) {
    for (const route of wildcardRoutes) {
      const method = route.method.toLowerCase();

      const methodSpecificWildcardHandler = async (
        req: Request,
        res: Response,
        next: any
      ) => {
        if (method === "all" || req.method.toLowerCase() === method) {
          routeContext = {
            req,
            res,
            params: req.params,
            query: req.query,
            body: req.body,
            middlewareContext: new Map<string, any>(),
          };
          try {
            // Seed common request context values for convenient access via useContext(...)
            routeContext.middlewareContext.set("req", req);
            routeContext.middlewareContext.set("res", res);
            routeContext.middlewareContext.set("params", req.params);
            routeContext.middlewareContext.set("path", req.path);
            routeContext.middlewareContext.set(
              "method",
              req.method as HttpMethod
            );
            routeContext.middlewareContext.set("headers", req.headers);
            routeContext.middlewareContext.set("query", routeContext.query);
            routeContext.middlewareContext.set("body", routeContext.body);
            let middlewareIndex = 0;

            const executeNextMiddleware = async (): Promise<any> => {
              if (middlewareIndex >= route.middlewares.length) {
                return await route.handler();
              }
              const currentMiddleware = route.middlewares[middlewareIndex++];
              return await currentMiddleware?.(req, executeNextMiddleware, res);
            };

            const output = await executeNextMiddleware();
            sendResponseFromOutput(res, output);
          } catch (error) {
            console.error("Wildcard route handler error:", error);
            if (!res.headersSent)
              res.status(500).json({ error: "Internal server error" });
          } finally {
            routeContext = null;
          }
        } else {
          next();
        }
      };

      app.use(methodSpecificWildcardHandler);
    }
  } else {
    // Default 404 handler if no wildcard route is defined
    app.use((req: Request, res: Response) => {
      res.status(404).json({
        error: "Not Found",
        message: `Route ${req.method} ${req.originalUrl} not found`,
        path: req.originalUrl,
        method: req.method,
      });
    });
  }

  const server = app.listen(port, () => {
    console.log(`🚀 ReactServe running at http://localhost:${port}`);
    if (process.env.NODE_ENV !== "production") {
      console.log("🔥 Hot reload enabled - watching for file changes...");
    }
  });

  server.on("error", (err) => {
    console.error("Server error:", err);
  });

  // // Hot reload
  // if (process.env.NODE_ENV !== "production") {
  //   const watchPaths = ["."];
  //   watchPaths.forEach((watchPath) => {
  //     watch(watchPath, { recursive: true }, (eventType, filename) => {
  //       if (
  //         filename &&
  //         (filename.endsWith(".ts") || filename.endsWith(".tsx")) &&
  //         !filename.includes("node_modules") &&
  //         !filename.includes(".git")
  //       ) {
  //         console.log(`🔄 File changed: ${filename} - Restarting server...`);
  //         server.close(() => {
  //           process.exit(0);
  //         });
  //       }
  //     });
  //   });
  // }

  return server;
}
