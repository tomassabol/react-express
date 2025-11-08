export {
  serve,
  useRoute,
  useSetContext,
  useContext,
  type Middleware as MiddlewareFunction,
} from "../index";
import React from "react";

export function Middleware({
  use,
}: {
  use: import("../index").Middleware | import("../index").Middleware[];
}): React.ReactElement {
  return { type: "Middleware", props: { use } } as any;
}
