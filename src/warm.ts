// Warming service - discovers Cloud Run services and warms them
import { ServicesClient } from "@google-cloud/run";

const PROJECT_ID = Deno.env.get("GCP_PROJECT_ID") || "mklv-infrastructure";
const REGION = Deno.env.get("GCP_REGION") || "us-west1";
const TIMEOUT_MS = 5000;

// Initialize client at module level to avoid cold-start gRPC connection delays
// during request handling. The 60s timeout allows for slow initial connections.
const client = new ServicesClient({
  timeout: 60000,
});

interface WarmResult {
  service: string;
  url: string;
  status: "ok" | "error";
  latencyMs?: number;
  error?: string;
}

/**
 * Discovers Cloud Run services with warm=true label and hits their /health endpoints.
 * Uses @google-cloud/run for service discovery via Cloud Run Admin API.
 */
export async function warmServices(): Promise<WarmResult[]> {

  // List all services in the project/region
  const parent = `projects/${PROJECT_ID}/locations/${REGION}`;
  const [services] = await client.listServices({ parent });

  // Filter to services with warm=true label
  const warmableServices = services.filter(
    (svc) => svc.labels?.["warm"] === "true",
  );

  console.log(`Found ${warmableServices.length} services with warm=true label`);

  // Warm each service in parallel
  const results = await Promise.all(
    warmableServices.map((svc) => warmService(svc.name!, svc.uri!)),
  );

  return results;
}

/**
 * Warms a single service by hitting its /health endpoint.
 */
async function warmService(name: string, uri: string): Promise<WarmResult> {
  // Extract service name from full resource name (projects/.../services/name)
  const serviceName = name.split("/").pop()!;
  const healthUrl = `${uri}/health`;

  const start = performance.now();

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

    const response = await fetch(healthUrl, {
      method: "GET",
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    const latencyMs = Math.round(performance.now() - start);

    if (response.ok) {
      console.log(`Warmed ${serviceName} in ${latencyMs}ms`);
      return { service: serviceName, url: healthUrl, status: "ok", latencyMs };
    } else {
      const error = `HTTP ${response.status}`;
      console.error(`Failed to warm ${serviceName}: ${error}`);
      return { service: serviceName, url: healthUrl, status: "error", error };
    }
  } catch (err) {
    const latencyMs = Math.round(performance.now() - start);
    const error = err instanceof Error ? err.message : String(err);
    console.error(`Failed to warm ${serviceName}: ${error}`);
    return {
      service: serviceName,
      url: healthUrl,
      status: "error",
      latencyMs,
      error,
    };
  }
}
