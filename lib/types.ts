import type { Request, Response } from "express";
import type { ReactNode } from "react";
import type { ZodTypeAny, infer as ZodInfer } from "zod";

/**
 * Allowed HTTP methods for Route.method
 */
export type HttpMethod =
  | "GET"
  | "POST"
  | "PUT"
  | "PATCH"
  | "DELETE"
  | "OPTIONS"
  | "HEAD"
  | "ALL";

/**
 * Methods that semantically allow a request body
 */
export type MethodsWithBody = Exclude<HttpMethod, "GET" | "HEAD" | "OPTIONS">;

/**
 * Extract parameter names (without ':') from a path string like "/users/:id/:postId"
 */
type ExtractParamNames<Path extends string> =
  Path extends `${string}:${infer P}/${infer R}`
    ? P | ExtractParamNames<`/${R}`>
    : Path extends `${string}:${infer P}`
      ? P
      : never;

/**
 * Map a route path string to a params object type.
 * Example: ParamsOf<"/users/:id"> -> { id: string }
 */
export type ParamsOf<Path extends string> = [ExtractParamNames<Path>] extends [
  never,
]
  ? Record<string, never>
  : { [K in ExtractParamNames<Path>]: string };

/**
 * Strongly-typed route context available inside handlers via useRoute()/useContext()
 */
export type RouteContext<
  P = Record<string, string>,
  Q = unknown,
  B = unknown,
> = {
  req: Request<P, any, B, Q>;
  res: any;
  params: P;
  query: Q;
  body: B;
};

/**
 * Branded key used to read/write typed values to the middleware/global context
 */
export type ContextKey<T> = { key: string } & { readonly __contextBrand?: T };

/**
 * Create a typed context key for use with useContext/useSetContext
 */
export function createContextKey<T>(key: string): ContextKey<T> {
  return { key } as ContextKey<T>;
}

/**
 * Middleware typed over route Params (P), Body (B) and Query (Q)
 */
export type TypedMiddleware<
  P = Record<string, string>,
  B = unknown,
  Q = unknown,
> = (
  req: Request<P, any, B, Q>,
  next: () => any,
  res: Response<any, Record<string, any>>
) => any;

/**
 * Route handler function that can be declared with or without a typed ctx param.
 * The runtime will not pass an argument; the ctx param is only for type inference.
 */
export type RouteHandler<P, Q, B, R = ReactNode | Promise<any>> = (
  ctx?: RouteContext<P, Q, B>
) => R;

/**
 * Infer the runtime type from a Zod schema
 */
export type InferSchema<S> = S extends ZodTypeAny ? ZodInfer<S> : unknown;
