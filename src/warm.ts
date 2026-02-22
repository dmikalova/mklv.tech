// Warming service - discovers Cloud Run services and warms them
// Uses Cloud Run Admin REST API (not gRPC) for Deno compatibility.

const PROJECT_ID = Deno.env.get("GCP_PROJECT_ID") || "mklv-infrastructure";
const REGION = Deno.env.get("GCP_REGION") || "us-west1";
const TIMEOUT_MS = 5000;

interface WarmResult {
  service: string;
  url: string;
  status: "ok" | "error";
  latencyMs?: number;
  error?: string;
}

interface CloudRunService {
  name: string;
  uri: string;
  labels?: Record<string, string>;
}

interface ListServicesResponse {
  services?: CloudRunService[];
}

/**
 * Gets an access token from the GCE metadata server.
 * This works automatically on Cloud Run.
 */
async function getAccessToken(): Promise<string> {
  const metadataUrl =
    "http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token";
  const response = await fetch(metadataUrl, {
    headers: { "Metadata-Flavor": "Google" },
  });

  if (!response.ok) {
    throw new Error(`Failed to get access token: ${response.status}`);
  }

  const data = await response.json();
  return data.access_token;
}

/**
 * Lists Cloud Run services using the REST API.
 */
async function listServices(): Promise<CloudRunService[]> {
  const token = await getAccessToken();
  const url = `https://run.googleapis.com/v2/projects/${PROJECT_ID}/locations/${REGION}/services`;

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Cloud Run API error ${response.status}: ${text}`);
  }

  const data: ListServicesResponse = await response.json();
  return data.services || [];
}

/**
 * Discovers Cloud Run services with warm=true label and hits their /health endpoints.
 * Uses Cloud Run Admin REST API for service discovery.
 */
export async function warmServices(): Promise<WarmResult[]> {
  // List all services in the project/region
  const services = await listServices();

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
