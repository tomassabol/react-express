import { App, Middleware, Response, Route, RouteGroup } from "@lib/index";
import {
  serve,
  useContext,
  useRoute,
  useSetContext,
  type Middleware as MiddlewareFunction,
} from "../index";
import * as z from "zod";
import { setTimeout } from "timers/promises";
import { authMiddleware } from "./middleware/auth-middleware";
import { loggingMiddleware } from "./middleware/logging-middleware";
import { validationMiddleware } from "./middleware/validation-middleware";
import { slowRouteMiddleware } from "./middleware/slow-route-middleware";
import { adminLogMiddleware } from "./middleware/admin-middleware";

const mockUsers = [
  { id: 1, name: "John Doe", email: "john@example.com" },
  { id: 2, name: "Jane Smith", email: "jane@example.com" },
  { id: 3, name: "Bob Johnson", email: "bob@example.com" },
];

export default function handler() {
  return (
    <App cors={true} middleware={[loggingMiddleware, validationMiddleware]}>
      <RouteGroup prefix="/api">
        <Route
          path="/:id/hello"
          method="POST"
          body={z.object({ name: z.string() })}
          query={z.object({ age: z.number() })}
        >
          {async (ctx) => {
            const { body, query } = useContext(ctx);
            console.log("query", query);
            await setTimeout(2000);
            return (
              <Response
                json={{ message: `Hello, ${body.name}!` }}
                status={201}
                headers={{
                  "X-Custom-Header": "Hello, World!",
                }}
              />
            );
          }}
        </Route>
      </RouteGroup>

      <Route path="/" method="GET">
        {async () => <Response json={{ message: "Welcome to ReactServe!" }} />}
      </Route>

      <Route
        path="/hello"
        method="POST"
        body={z.object({ name: z.string() })}
        query={z.object({ age: z.coerce.number() })}
        middleware={[loggingMiddleware]}
      >
        {async (ctx) => {
          const body = useContext("body", ctx);
          const query = useContext("query", ctx);
          return <Response json={{ message: `Hello, ${body.name}!` }} />;
        }}
      </Route>

      <Route path="/slow" method="GET" middleware={slowRouteMiddleware}>
        {async () => {
          const processStart = useContext<number>("processStartTime");
          const processingTime = Date.now() - processStart;

          return (
            <Response
              json={{
                message: "This route has its own middleware",
                processStartTime: processStart,
                processingTime: processingTime + "ms",
              }}
            />
          );
        }}
      </Route>

      <Route path="/admin-only" method="GET" middleware={[adminLogMiddleware]}>
        {async () => {
          const timestamp = useContext<number>("requestTimestamp");
          const adminAccess = useContext<boolean>("adminAccess");

          return (
            <Response
              json={{
                message: "Admin route with multiple middlewares",
                requestedAt: timestamp,
                adminAccess: adminAccess,
              }}
            />
          );
        }}
      </Route>

      <RouteGroup prefix="/api">
        <Route path="/users" method="GET">
          {async () => {
            const timestamp = useContext<number>("requestTimestamp");
            return (
              <Response json={{ users: mockUsers, requestedAt: timestamp }} />
            );
          }}
        </Route>

        <Route
          path="/special-users"
          method="GET"
          middleware={slowRouteMiddleware}
        >
          {async () => {
            const timestamp = useContext<number>("requestTimestamp");
            const processStart = useContext<number>("processStartTime");

            return (
              <Response
                json={{
                  users: mockUsers.slice(0, 1), // Only first user for "special"
                  requestedAt: timestamp,
                  processStartTime: processStart,
                  note: "This route has RouteGroup middleware + individual middleware",
                }}
              />
            );
          }}
        </Route>

        <Route path="/users/:id" method="GET">
          {async () => {
            const { params } = useRoute();
            const timestamp = useContext("requestTimestamp");
            const user = mockUsers.find((u) => u.id === Number(params.id));

            if (!user) {
              return (
                <Response status={404} json={{ error: "User not found" }} />
              );
            }

            return <Response json={{ ...user, requestedAt: timestamp }} />;
          }}
        </Route>

        <Route path="/health" method="GET">
          {async () => {
            const timestamp = useContext("requestTimestamp");
            return (
              <Response
                json={{
                  status: "OK",
                  timestamp: new Date().toISOString(),
                  requestedAt: timestamp,
                }}
              />
            );
          }}
        </Route>
      </RouteGroup>

      <RouteGroup prefix="/api/protected">
        <Middleware use={authMiddleware} />

        <Route path="/me" method="GET">
          {async () => {
            const user = useContext("user");
            const timestamp = useContext("requestTimestamp");
            return <Response json={{ ...user, requestedAt: timestamp }} />;
          }}
        </Route>

        <Route path="/admin/stats" method="GET">
          {async () => {
            const user = useContext("user");
            const timestamp = useContext("requestTimestamp");
            return (
              <Response
                json={{
                  totalUsers: mockUsers.length,
                  adminUser: user,
                  requestedAt: timestamp,
                }}
              />
            );
          }}
        </Route>
      </RouteGroup>
    </App>
  );
}

serve(handler());
