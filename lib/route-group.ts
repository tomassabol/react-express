import type { TypedMiddleware } from "./types";

export function RouteGroup({
  children,
  prefix,
  middleware,
}: {
  children?: React.ReactNode;
  prefix?: string;
  middleware?:
    | TypedMiddleware<Record<string, string>, unknown, unknown>
    | TypedMiddleware<Record<string, string>, unknown, unknown>[];
}): React.ReactElement {
  return { type: "RouteGroup", props: { children, prefix, middleware } } as any;
}
