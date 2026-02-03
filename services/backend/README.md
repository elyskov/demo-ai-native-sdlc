# Backend (Nest.js)

Minimal Nest.js REST API for demo-ai-native-sdlc.

## Endpoints

- `GET /health` → returns JSON with application name, environment, Nest.js version, Node.js version.

## Diagrams API

REST endpoints (JSON):

- `GET /api/diagrams`
- `GET /api/diagrams/:id`
- `POST /api/diagrams`
- `PUT /api/diagrams/:id`
- `DELETE /api/diagrams/:id`

## CSV Export API (NetBox)

- `GET /api/csv/:diagramId?category=<Category>` → ordered NetBox entity types for a diagram/category (deterministic)
- `GET /api/csv/:diagramId?type=<entity>` → single CSV export for one NetBox entity type
- `GET /api/csv/:diagramId/zip` → ZIP archive containing numbered CSV files (`01__<entity>.csv`, ...)

## Domain Commands API (v1, backend-driven)

The editor does not manipulate Mermaid directly. Instead, it sends domain commands to the backend, which validates them using YAML config and updates Mermaid deterministically by inserting/removing anchored blocks (Mermaid is never parsed).

- `POST /api/diagrams/:id/commands`

Example: create a region (parented to `definitions` in the domain model)

```bash
curl -sS -X POST "http://localhost:3000/api/diagrams/<diagramId>/commands" \
	-H 'content-type: application/json' \
	-d '{
		"command": "create",
		"entity": "region",
		"parent": { "root": "definitions" },
		"attributes": { "name": "Region 1", "slug": "region-1" }
	}'
```

Expected Mermaid invariants (example snippets)

- Root groups exist and are anchored:

```mermaid
%% BEGIN definitions
subgraph definitions[*Definitions*]
	%% INSERT definitions
end
%% END definitions

%% BEGIN infrastructure
subgraph infrastructure[*Infrastructure*]
	%% INSERT infrastructure
	%% BEGIN connections
	subgraph connections[*Connections*]
		%% INSERT connections
	end
	%% END connections
end
%% END infrastructure
```

- Each created object is exactly one anchored block with stable Mermaid id based on `object.id` (example):

```mermaid
%% BEGIN region_<objectId>
subgraph region_<objectId>[*Region 1*]
	attr_region_<objectId>_name["name: Region 1"]:::attribute
	attr_region_<objectId>_slug["slug: region-1"]:::attribute
	%% INSERT region_<objectId>
end
%% END region_<objectId>
```

Swagger/OpenAPI:

- `GET /api/docs`

Notes:

- `POST /api/diagrams` generates a server-side `id` (16 chars of `[0-9a-zA-Z_]`).
