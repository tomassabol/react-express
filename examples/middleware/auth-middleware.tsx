import {
  type Middleware as MiddlewareFunction,
  useSetContext,
} from "../../index";
import { Response } from "../../lib";

export const authMiddleware: MiddlewareFunction = (req, next, res) => {
  const token = req.headers.authorization?.split(" ")[1];

  if (!token) {
    return <Response status={401} json={{ error: "Unauthorized" }} />;
  }

  // In a real app, you'd validate the token here
  // For demo purposes, we'll just check if it equals "valid-token"
  if (token !== "valid-token") {
    return <Response status={401} json={{ error: "Invalid token" }} />;
  }

  // Attach user to context so the route can use it
  useSetContext("user", {
    id: 1,
    name: "Titanium",
    email: "admin@example.com",
  });

  return next();
};
