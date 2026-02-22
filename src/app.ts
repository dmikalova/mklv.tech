// Hono application setup
import { Hono } from "hono";
import { serveStatic } from "hono/deno";
import { routes } from "./routes.ts";

export const app = new Hono();

// Health check endpoint
app.get("/health", (c) => c.text("OK"));

// API routes
app.route("/api", routes);

// Static files (landing page, favicon)
app.use("/*", serveStatic({ root: "./src/public" }));

// Fallback to index.html for root
app.get("/", serveStatic({ path: "./src/public/index.html" }));
