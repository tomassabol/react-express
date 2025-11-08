import { type CorsOptions } from "cors";
import type { TypedMiddleware } from "./types";

export function App({
  children,
  port,
  cors,
  middleware,
}: {
  children: any;
  port?: number;
  cors?: boolean | CorsOptions;
  middleware?:
    | TypedMiddleware<Record<string, string>, unknown, unknown>
    | TypedMiddleware<Record<string, string>, unknown, unknown>[];
}): React.ReactElement {
  return { type: "App", props: { children, port, cors, middleware } } as any;
}
