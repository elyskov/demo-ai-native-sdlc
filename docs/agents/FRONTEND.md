# Frontend (NPD)

Applies when changing the Next.js app, UI components, Mermaid rendering, or browser-facing behavior.

## Tech & structure

- Next.js (App Router), React 18, TypeScript.
- UI uses Tailwind + shadcn/Radix primitives already present in the codebase.
- Do not introduce new design systems or hard-coded theme colors; prefer existing CSS variables/tokens.

## Mermaid rendering & interaction

- Diagrams are Mermaid **flowchart** diagrams.
- Use Mermaid’s render pipeline (returns `{ svg, bindFunctions }`) and attach event handling to the rendered SVG DOM.
- Mermaid must run with a strict security posture (see current `mermaid-viewer` implementation):
  - `securityLevel: 'strict'`
- Theme is derived from existing CSS variables; keep light/dark behavior consistent.

### Interactive behavior constraints

- Element selection uses logical Mermaid ids extracted from SVG ids/titles.
- If new entity types or id formats are introduced, update logical id extraction accordingly.
- Avoid brittle global selectors; bind listeners after render to the produced SVG.

## Frontend ↔ backend connectivity

- Frontend calls backend APIs via `/api/*` paths.
- Next.js rewrites proxy `/api/*` to the backend service in Docker Compose.
- Do not hardcode backend container URLs in browser code.

## Browser compatibility

- Prefer feature detection (for example `if ('fetch' in window)`) over user-agent sniffing.
- Target the latest two stable releases of Chrome, Firefox, Edge, and Safari (macOS and iOS).
