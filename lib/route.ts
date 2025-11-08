import type { ReactElement } from "react";
import type {
  HttpMethod,
  InferSchema,
  MethodsWithBody,
  ParamsOf,
  RouteHandler,
  TypedMiddleware,
} from "./types";
import type { ZodTypeAny } from "zod";

/**
 * Declare an HTTP route. The `path` literal drives param inference.
 * The `children` handler may optionally accept a typed ctx param for DX.
 */
export function Route<
  P extends string,
  M extends HttpMethod,
  SQ extends ZodTypeAny | undefined = undefined,
  SB extends ZodTypeAny | undefined = undefined,
>({
  children,
  path,
  method,
  middleware,
  query,
  body,
}: {
  children: RouteHandler<ParamsOf<P>, InferSchema<SQ>, InferSchema<SB>, any>;
  path: P;
  method: M;
  middleware?:
    | TypedMiddleware<ParamsOf<P>, InferSchema<SB>, InferSchema<SQ>>
    | TypedMiddleware<ParamsOf<P>, InferSchema<SB>, InferSchema<SQ>>[];
  query?: SQ;
  body?: M extends MethodsWithBody ? SB : never;
}): ReactElement {
  return {
    type: "Route",
    props: { children, path, method, middleware, query, body },
  } as unknown as ReactElement;
}
