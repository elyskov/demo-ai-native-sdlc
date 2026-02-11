# Postman Test Collections

Comprehensive API test collections for the `demo-ai-native-sdlc` project services.

## Contents

| File | Description | Requests | Tests |
|------|-------------|----------|-------|
| `Backend_API_Tests.postman_collection.json` | Full backend API coverage: Health, CRUD, Commands, CSV | 34 | 99 |
| `Frontend_Proxy_Tests.postman_collection.json` | Frontend proxy rewrite verification | 10 | 30 |
| `Local_Docker_Compose.postman_environment.json` | Environment variables for local Docker Compose | — | — |

## Prerequisites

Start the full stack:

```bash
docker compose up --build -d
```

Services must be available at:
- **Backend**: `http://localhost:3000`
- **Frontend**: `http://localhost:3001`

## Quick Start

### Import into Postman

1. Open Postman and create or select a workspace
2. **Import** → drag all three files (two collections + environment)
3. Select the **Local Docker Compose** environment
4. Run either collection via the **Collection Runner**

### Run via Newman (CLI)

```bash
npm install -g newman

# Backend tests
newman run Backend_API_Tests.postman_collection.json \
  -e Local_Docker_Compose.postman_environment.json

# Frontend proxy tests
newman run Frontend_Proxy_Tests.postman_collection.json \
  -e Local_Docker_Compose.postman_environment.json
```

## Test Coverage

### Backend API Tests (34 requests, 99 assertions)

| Folder | Tests | Description |
|--------|-------|-------------|
| Health | 2 | `/api/health` and `/api/health/api` endpoints |
| Diagrams CRUD | 10 | Create, list, get, rename (PATCH), update (PUT), delete, and error cases (404, validation) |
| Diagram Commands | 13 | list-types, create/update/move/delete entities, list-elements, error handling |
| CSV Export | 7 | List types by category, download CSV by type, download ZIP, error cases |
| Cleanup | 2 | Delete test diagram + verification |

### Frontend Proxy Tests (10 requests, 30 assertions)

| Folder | Tests | Description |
|--------|-------|-------------|
| Health | 1 | Proxied health check |
| Diagrams CRUD | 4 | List, create, get, rename through proxy |
| Diagram Commands | 2 | List types and create entity through proxy |
| CSV Export | 2 | List CSV types and download ZIP through proxy |
| Cleanup | 1 | Delete test diagram through proxy |

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `backend_base_url` | `http://localhost:3000` | Backend NestJS service |
| `frontend_base_url` | `http://localhost:3001` | Frontend Next.js service |

## Related

- GitHub Issue: [#41](https://github.com/elyskov/demo-ai-native-sdlc/issues/41)
