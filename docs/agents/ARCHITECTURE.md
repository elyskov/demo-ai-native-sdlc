# Architecture (NPD)

Applies when changing the system design, domain model, backend/frontend boundaries, Mermaid generation rules, CSV export rules, or Docker packaging.

## Stack

- Backend: NestJS REST API
- Frontend: Next.js (App Router)
- Diagrams: Mermaid **flowchart** diagrams
- Packaging/runtime: Docker + Docker Compose

## Service responsibilities

### Frontend

- Provides UI for creating and editing **flowchart diagrams**.
- Renders diagrams using Mermaid’s render pipeline (see `docs/agents/FRONTEND.md`).
- Sends domain commands to the backend rather than directly editing Mermaid text.

### Backend

- Stores, validates, and manipulates diagram domain state.
- Generates Mermaid deterministically from domain state.
- Exports NetBox-compatible CSV data (single entity exports and ZIP bundles).

## Deterministic Mermaid invariants

The backend updates Mermaid text **without parsing Mermaid**.

- Mermaid documents contain anchored blocks (for example `%% BEGIN <id>` / `%% END <id>`) and insertion markers (`%% INSERT <parentId>`).
- Create/move/delete operations insert or remove entire anchored blocks.
- Any changes to the Mermaid generator or command handlers must preserve deterministic, stable output.

## Config-driven model

Backend behavior is driven by YAML configuration (see backend README for env vars and file locations):

- `netbox-model.yaml` defines entity attributes and their order (single source of truth).
- `netbox-to-mermaid.yaml` defines Mermaid ids, templates, and roots.
- `mermaid-styles.yaml` is optional (styling is skipped if missing).

## CSV export rules

- Output must be deterministic and documented.
- Exports must match the chosen NetBox CSV schema for the represented inventory objects.

## Deployment & Docker

- The repository ships **two** multi-stage Docker builds (backend and frontend).
- Local dev and production runs are orchestrated via Docker Compose.

See `INSTALL.md` for the supported run modes and CI publish behavior.
