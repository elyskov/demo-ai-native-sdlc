import type { NetboxAttributeDefinition, NetboxAttributeType, NetboxModelConfig } from './netbox-config.models';

function isRecord(value: unknown): value is Record<string, any> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function formatLocation(entity: string, attribute?: string): string {
  if (!attribute) return `entity '${entity}'`;
  return `entity '${entity}', attribute '${attribute}'`;
}

function assertAttributeType(type: unknown, filePath: string, entity: string, attribute: string): asserts type is NetboxAttributeType {
  if (type === undefined) return;
  if (type === 'string' || type === 'number' || type === 'integer' || type === 'boolean') return;
  throw new Error(
    `Invalid NetBox model config: ${formatLocation(entity, attribute)} has unsupported type '${String(type)}' (${filePath})`,
  );
}

function validateAttributeDefinition(def: unknown, filePath: string, entity: string, attribute: string): asserts def is NetboxAttributeDefinition {
  if (!isRecord(def)) {
    throw new Error(
      `Invalid NetBox model config: ${formatLocation(entity, attribute)} definition must be an object (${filePath})`,
    );
  }

  assertAttributeType((def as any).type, filePath, entity, attribute);

  if ((def as any).maxLength !== undefined) {
    const v = (def as any).maxLength;
    if (!isFiniteNumber(v) || !Number.isInteger(v) || v < 0) {
      throw new Error(
        `Invalid NetBox model config: ${formatLocation(entity, attribute)} has invalid maxLength (expected non-negative integer) (${filePath})`,
      );
    }
  }

  if ((def as any).pattern !== undefined) {
    const p = (def as any).pattern;
    if (typeof p !== 'string' || !p.length) {
      throw new Error(
        `Invalid NetBox model config: ${formatLocation(entity, attribute)} has invalid pattern (expected non-empty string) (${filePath})`,
      );
    }
    try {
      // Validate regex compiles.
      // We intentionally do not add flags here; the raw string must be a valid JS regex pattern.
      new RegExp(p);
    } catch (err) {
      const msg = (err as any)?.message ? String((err as any).message) : String(err);
      throw new Error(
        `Invalid NetBox model config: ${formatLocation(entity, attribute)} has invalid pattern regex '${p}': ${msg} (${filePath})`,
      );
    }
  }

  const minimum = (def as any).minimum;
  const maximum = (def as any).maximum;

  if (minimum !== undefined && !isFiniteNumber(minimum)) {
    throw new Error(
      `Invalid NetBox model config: ${formatLocation(entity, attribute)} has non-numeric minimum (${filePath})`,
    );
  }
  if (maximum !== undefined && !isFiniteNumber(maximum)) {
    throw new Error(
      `Invalid NetBox model config: ${formatLocation(entity, attribute)} has non-numeric maximum (${filePath})`,
    );
  }
  if (isFiniteNumber(minimum) && isFiniteNumber(maximum) && minimum > maximum) {
    throw new Error(
      `Invalid NetBox model config: ${formatLocation(entity, attribute)} has minimum > maximum (${filePath})`,
    );
  }

  const values = (def as any).value;
  const labels = (def as any).label;

  if (labels !== undefined && values === undefined) {
    throw new Error(
      `Invalid NetBox model config: ${formatLocation(entity, attribute)} has 'label' without 'value' (${filePath})`,
    );
  }

  if (values !== undefined) {
    if (!Array.isArray(values) || values.length === 0) {
      throw new Error(
        `Invalid NetBox model config: ${formatLocation(entity, attribute)} has invalid 'value' (expected non-empty array) (${filePath})`,
      );
    }

    for (const v of values) {
      const ok = typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean';
      if (!ok) {
        throw new Error(
          `Invalid NetBox model config: ${formatLocation(entity, attribute)} enum value contains unsupported item '${String(v)}' (${filePath})`,
        );
      }
    }

    if (labels !== undefined) {
      if (!Array.isArray(labels)) {
        throw new Error(
          `Invalid NetBox model config: ${formatLocation(entity, attribute)} has invalid 'label' (expected array) (${filePath})`,
        );
      }
      if (labels.length !== values.length) {
        throw new Error(
          `Invalid NetBox model config: ${formatLocation(entity, attribute)} has label/value length mismatch (${filePath})`,
        );
      }
      for (const l of labels) {
        if (typeof l !== 'string') {
          throw new Error(
            `Invalid NetBox model config: ${formatLocation(entity, attribute)} label must be string (${filePath})`,
          );
        }
      }
    }
  }
}

export function validateNetboxModelConfig(model: NetboxModelConfig, filePath: string) {
  if (!isRecord(model)) {
    throw new Error(`Invalid NetBox model config: expected a YAML object in ${filePath}`);
  }

  if (!isRecord((model as any).entities)) {
    throw new Error(
      `Invalid NetBox model config: missing required section 'entities' in ${filePath}`,
    );
  }

  const entities = (model as any).entities as Record<string, any>;
  for (const [entityKey, entityCfg] of Object.entries(entities)) {
    if (!isRecord(entityCfg)) {
      throw new Error(`Invalid NetBox model config: entity '${entityKey}' must be an object (${filePath})`);
    }

    const attrs = (entityCfg as any).attributes;
    if (attrs === undefined) continue;

    if (!isRecord(attrs)) {
      throw new Error(
        `Invalid NetBox model config: entity '${entityKey}' attributes must be an object (${filePath})`,
      );
    }

    for (const [attrKey, def] of Object.entries(attrs)) {
      validateAttributeDefinition(def, filePath, entityKey, attrKey);
    }
  }
}
