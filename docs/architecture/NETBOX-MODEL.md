# NetBox Model Config (`netbox-model.yaml`)

This document describes the configuration schema, semantics, and validation rules for the NetBox model configuration file used by the backend.

The backend uses this file as a **single source of truth** for:
- which entities exist,
- how entities can be nested (`parent`) and related (`links`),
- which attributes exist and how they are validated,
- the deterministic attribute ordering used by Mermaid generation and CSV export.

## Location and loading

- The backend loads YAML from `NETBOX_CONFIG_DIR` (default: `<backend cwd>/config`).
- Required files:
  - `netbox-model.yaml` (this document)
  - `netbox-to-mermaid.yaml`
- Optional file:
  - `mermaid-styles.yaml` (backend will warn and continue if missing)

## Top-level schema

```yaml
version: 1
roots: { ... }
field_groups: { ... }          # optional
entities: { ... }
```

### `version`

Type: `number | string`.

Used for human tracking and forward compatibility.

### `roots`

Type: `Record<string, { description?: string }>`.

Roots represent top-level containers in the domain model (and typically Mermaid subgraphs).

Example:

```yaml
roots:
  definitions:
    description: "Logical definitions and catalogs"
  infrastructure:
    description: "Physical and logical infrastructure"
```

### `field_groups` (optional)

Type: `Record<string, { attributes?: Record<string, AttributeDefinition> }>`.

Field groups are reusable attribute bundles to avoid repeating common attribute definitions across entities.

Example:

```yaml
field_groups:
  name_slug:
    attributes:
      name:
        required: true
        maxLength: 100
      slug:
        required: true
        pattern: ^[-a-zA-Z0-9_]+$
```

### `entities`

Type: `Record<string, EntityConfig>`.

Each entity key is the domain entity type (for example `site`, `device`, `tenant-group`).

## Entity schema

```yaml
entities:
  <entityKey>:
    meta: { ... }                 # optional, opaque to validation
    capabilities: { ... }         # optional
    include_groups: [ ... ]       # optional
    parent: { ... }               # optional
    links: { ... }                # optional
    attributes: { ... }           # optional
```

### `meta` (optional)

Type: `Record<string, unknown>`.

`meta` is allowed for storing UI or integration hints (for example `api_prefix`, `object`, grouping fields). The backend model validator does **not** enforce a schema for `meta`.

### `capabilities` (optional)

Type:

```yaml
capabilities:
  custom_fields: true|false
```

- `custom_fields` indicates that the entity supports NetBox custom fields.
- This is a **capability flag only**.
  - The configuration does not enumerate custom field keys.
  - Custom field keys/values are expected to live in diagram content or external inputs.

Validation rule:
- `capabilities` must be an object if present.
- `capabilities.custom_fields` must be a boolean if present.

### `include_groups` (optional)

Type: `string[]`.

Declares which `field_groups` should be merged into this entity’s attribute set.

Merge rules (important):
- If `include_groups` is present, `field_groups` must be present.
- Each referenced group key must exist in `field_groups`.
- At load time the backend **expands** attributes so downstream code sees a single merged `attributes` map.
- Merge order:
  1) attributes from the included groups (in the order listed)
  2) entity-local `attributes` override group attributes by key
- If multiple groups define the same attribute key, the first group wins (later groups do not overwrite it). Entity-local attributes always override.

Notes:
- Attribute ordering matters; this merge order is also the ordering used by generators.

### `parent` (optional)

Controls whether the entity must have a parent and which parent types are allowed.

Schema:

```yaml
parent:
  required: true|false
  allowed:
    - root: <rootKey>
      field: <netboxFieldName>
    - entity: <entityKey>
      field: <netboxFieldName>
```

Semantics:
- If `parent.required: true`, create/move operations must supply a parent.
- `allowed` is interpreted as a set of allowed parent contexts.
  - `root` entries allow placing the entity directly under a root.
  - `entity` entries allow placing the entity under another entity.
- `field` records the NetBox API field name used for that relationship in CSV/import semantics.

### `links` (optional)

Links represent additional relations (besides the parent relation) that map to NetBox API fields.

Schema:

```yaml
links:
  <linkKey>:
    entity: <entityKey>
    field: <netboxFieldName>
    required: true|false
```

Semantics:
- A link points to another entity type.
- `field` records the NetBox API field name.
- For the current phase, relations are treated as **id-only** in data export and integration assumptions.

### `attributes` (optional)

Type: `Record<string, AttributeDefinition>`.

Attributes are key/value fields stored on diagram objects and validated on create/update. Attribute ordering is preserved.

## AttributeDefinition

An attribute definition describes validation and type coercion rules for a single attribute.

### Supported types

Scalar types:
- `string` (default if omitted)
- `number`
- `integer`
- `boolean`

Composite type:
- `array` (one level only)

Schema (scalar):

```yaml
<attrKey>:
  required: true|false        # optional
  nullable: true|false        # optional
  type: string|number|integer|boolean
  maxLength: <int>            # string-only
  pattern: <regex>            # string/number/integer supported
  minimum: <number>           # number/integer only
  maximum: <number>           # number/integer only
  value: [ ... ]              # enum values (string|number|boolean)
  label: [ ... ]              # optional labels, same length as value
```

Schema (array):

```yaml
<attrKey>:
  type: array
  nullable: true|false        # optional
  items:
    type: string|number|integer|boolean
    # ... scalar rules apply here
```

### Validation and coercion rules

General:
- Missing/empty values:
  - A value is considered “empty” if it is `null`, `undefined`, or the empty string after trimming.
  - If `nullable: true` and the value is empty, validation is skipped (even if other rules exist).
  - If `required: true` and the value is empty, validation fails.

Scalar coercion:
- `string`: accepts string; also accepts number/boolean and stringifies them.
- `boolean`: accepts boolean; accepts strings `"true"`/`"false"` (case-insensitive).
- `number`/`integer`: accepts number; accepts numeric strings; rejects non-finite values.
- `integer`: additionally rejects decimals.

Scalar constraints:
- `maxLength`:
  - only meaningful for `string`.
  - if omitted for string, runtime validation defaults to `100`.
- `pattern`:
  - the regex must compile as a JavaScript `RegExp`.
  - for `number`/`integer`, the pattern is tested against the original input string when available.
- `value`/`label`:
  - `value` must be a non-empty array.
  - `label` is optional but if present:
    - requires `value`
    - must be an array of strings
    - must be the same length as `value`

Numeric constraints:
- `minimum` and `maximum` must be finite numbers if present.
- `minimum <= maximum` when both are present.

Array constraints:
- `type: array` requires `items` to be present and an object.
- Nested arrays (`array` within `items`) are not supported.
- For arrays, scalar-only fields like `pattern`, `maxLength`, `value`, `minimum`, etc. must be placed under `items`.
- Runtime validation requires the value to be a JSON array.
- Each array element is validated with the `items` schema.
- Empty elements (null/undefined/empty-string) are rejected.

## Common conventions used in this repo

### Tags (`tags`)

For entities that support tagging in NetBox, this repo models tags as:

```yaml
tags:
  type: array
  nullable: true
  items:
    type: string
    pattern: ^[-a-zA-Z0-9_]+$
```

Interpretation:
- Tags are represented as an array of **slugs** (strings).
- This aligns with “id-only” and CSV-friendly conventions for the current phase.

### Custom fields (`custom_fields`)

Entities that support NetBox custom fields can be marked with:

```yaml
capabilities:
  custom_fields: true
```

This is intentionally a capability flag only; the model does not define keys.

## Examples

### Minimal entity

```yaml
entities:
  region:
    parent:
      required: true
      allowed:
        - root: infrastructure
          field: parent
    links: {}
    attributes:
      name:
        required: true
      slug:
        required: true
        pattern: ^[-a-zA-Z0-9_]+$
```

### Entity using field group + tags

```yaml
field_groups:
  name_slug:
    attributes:
      name: { required: true, maxLength: 100 }
      slug: { required: true, pattern: ^[-a-zA-Z0-9_]+$ }

entities:
  site:
    include_groups: [name_slug]
    capabilities:
      custom_fields: true
    attributes:
      status:
        required: true
        value: [planned, active]
        label: [Planned, Active]
      tags:
        type: array
        nullable: true
        items:
          type: string
          pattern: ^[-a-zA-Z0-9_]+$
```

## Implementation notes (backend)

- Model validation is performed during backend startup.
- `include_groups` expansion is performed during config load so downstream services see merged `attributes`.
- Attribute validation is applied during diagram create/update operations.
- CSV and Mermaid generation use the attribute key order from the resolved (expanded) model.

## Known limitations (current phase)

- Only scalar and one-level `array` attributes are supported.
- Object/map attribute types are not modeled.
- Filtering/query parameter schema is not modeled here.
- Relations are treated as **id-only** in this phase (NetBox request schemas sometimes accept “id or object”).
