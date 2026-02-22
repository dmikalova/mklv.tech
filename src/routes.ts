// Route definitions for mklv.tech service
import { Hono } from "hono";
import { warmServices } from "./warm.ts";

export const routes = new Hono();

// Warming endpoint - called by Cloud Scheduler every 10 minutes
routes.post("/warm", async (c) => {
  const results = await warmServices();

  const summary = {
    timestamp: new Date().toISOString(),
    total: results.length,
    success: results.filter((r) => r.status === "ok").length,
    failed: results.filter((r) => r.status === "error").length,
    services: results,
  };

  console.log("Warming complete:", JSON.stringify(summary));

  return c.json(summary);
});
