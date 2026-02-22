// Main entry point for mklv.tech service
import { app } from "./app.ts";

const port = parseInt(Deno.env.get("PORT") || "8080");

console.log(`Starting mklv.tech service on port ${port}`);

Deno.serve({ port }, app.fetch);
