# Testing (NPD)

Applies when changing APIs, diagram behavior, Mermaid generation, CSV export, UI proxying, or anything with observable behavior.

## Baseline expectations

- Keep existing tests passing.
- Add lightweight tests when there is a clear place to do so.

### Backend

- The backend has a small TypeScript test suite under `services/backend/test`.
- Run: `npm test` (from `services/backend`).

### Frontend

- The frontend uses Node’s built-in test runner for `services/frontend/lib/**/*.test.js`.
- Run: `npm test` (from `services/frontend`).

## Postman-based regression testing

This repository includes Postman collections as first-class regression coverage.

- Collections live in `postman/`.
- When you change API contracts, proxy/rewrites, CSV output, or command behavior, update or extend the relevant Postman collections.

### Newman (CLI)

From `postman/`:

- Backend API tests:
  - `newman run Backend_API_Tests.postman_collection.json -e Local_Docker_Compose.postman_environment.json`
- Frontend proxy tests:
  - `newman run Frontend_Proxy_Tests.postman_collection.json -e Local_Docker_Compose.postman_environment.json`

See `postman/README.md` for the canonical setup and coverage.
