# mklv.tech

Warming service and landing page for mklv.tech.

## Features

- **Landing page**: Simple branding with links to apps
- **Warming endpoint**: Keeps Cloud Run services warm by pinging `/health`
  endpoints every 10 minutes

## Development

```bash
# Install dependencies and set up git hooks
deno task setup

# Start development server with hot reload
deno task dev

# Type-check
deno task check

# Format and lint
deno task fmt
deno task lint
```

## Warming

The `/api/warm` endpoint discovers Cloud Run services with the `warm=true` label
and hits their `/health` endpoints. Cloud Scheduler invokes this every 10
minutes.

Services opt-in to warming by setting `warm = true` in their Terraform
configuration (default is `true` for all apps using the cloud-run-app module).
