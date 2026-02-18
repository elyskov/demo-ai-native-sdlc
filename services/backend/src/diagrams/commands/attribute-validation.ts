import type { NetboxAttributeDefinition, NetboxAttributeType } from '../../netbox-config/netbox-config.models';

export type CoercedAttributeValue = {
  type: NetboxAttributeType;
  raw: unknown;
  rawString: string;
  value: string | number | boolean;
};

function isEmptyValue(value: unknown): boolean {
  if (value === undefined || value === null) return true;
  if (typeof value === 'string' && value.trim() === '') return true;
  return false;
}

function coerceValue(entity: string, key: string, type: NetboxAttributeType, raw: unknown): CoercedAttributeValue {
  const rawString = typeof raw === 'string' ? raw.trim() : String(raw);

  if (type === 'string') {
    if (typeof raw === 'string') {
      return { type, raw, rawString, value: raw };
    }
    if (typeof raw === 'number' || typeof raw === 'boolean') {
      return { type, raw, rawString, value: String(raw) };
    }
    throw new Error(`Invalid attribute '${key}' for '${entity}': expected string`);
  }

  if (type === 'boolean') {
    if (typeof raw === 'boolean') {
      return { type, raw, rawString: raw ? 'true' : 'false', value: raw };
    }
    if (typeof raw === 'string') {
      const s = raw.trim().toLowerCase();
      if (s === 'true') return { type, raw, rawString: 'true', value: true };
      if (s === 'false') return { type, raw, rawString: 'false', value: false };
    }
    throw new Error(`Invalid attribute '${key}' for '${entity}': expected boolean (true/false)`);
  }

  if (type === 'number' || type === 'integer') {
    let num: number;

    if (typeof raw === 'number') {
      num = raw;
    } else if (typeof raw === 'string') {
      if (rawString === '') {
        // Handled by empty checks earlier.
        throw new Error(`Invalid attribute '${key}' for '${entity}': empty number`);
      }
      num = Number(rawString);
    } else {
      throw new Error(`Invalid attribute '${key}' for '${entity}': expected ${type}`);
    }

    if (!Number.isFinite(num)) {
      throw new Error(`Invalid attribute '${key}' for '${entity}': expected ${type}`);
    }

    if (type === 'integer' && !Number.isInteger(num)) {
      throw new Error(`Invalid attribute '${key}' for '${entity}': expected integer`);
    }

    return { type, raw, rawString, value: num };
  }

  // Exhaustive safeguard.
  throw new Error(`Invalid attribute '${key}' for '${entity}': unsupported type '${type}'`);
}

export function validateEntityAttributes(entity: string, attrs: Record<string, any>, definitions: Record<string, NetboxAttributeDefinition> | undefined) {
  const defs = definitions ?? {};

  for (const [key, def] of Object.entries(defs)) {
    const type: NetboxAttributeType = (def.type ?? 'string') as NetboxAttributeType;
    const nullable = Boolean(def.nullable);

    const raw = (attrs as any)[key];
    const empty = isEmptyValue(raw);

    if (empty) {
      if (nullable) continue;
      if (def.required) {
        throw new Error(`Missing required attribute '${key}' for '${entity}'`);
      }
      continue;
    }

    const coerced = coerceValue(entity, key, type, raw);

    if (type === 'string') {
      const maxLength = def.maxLength ?? 100;
      const s = String(coerced.value);
      if (s.length > maxLength) {
        throw new Error(`Invalid attribute '${key}' for '${entity}': exceeds maxLength ${maxLength}`);
      }
    }

    if (def.pattern) {
      const re = new RegExp(def.pattern);
      // For numbers/integers we validate the original string input format when possible.
      const testValue = (type === 'number' || type === 'integer') ? coerced.rawString : String(coerced.value);
      if (!re.test(testValue)) {
        throw new Error(`Invalid attribute '${key}' for '${entity}': does not match pattern ${def.pattern}`);
      }
    }

    if (def.value) {
      const allowed = def.value;
      const ok =
        type === 'string'
          ? allowed.some((v) => String(v) === String(coerced.value))
          : allowed.some((v) => v === coerced.value);
      if (!ok) {
        throw new Error(`Invalid attribute '${key}' for '${entity}': must be one of [${allowed.join(', ')}]`);
      }
    }

    if (type === 'number' || type === 'integer') {
      const num = coerced.value as number;

      if (def.minimum !== undefined && num < def.minimum) {
        throw new Error(`Invalid attribute '${key}' for '${entity}': must be >= ${def.minimum}`);
      }

      if (def.maximum !== undefined && num > def.maximum) {
        throw new Error(`Invalid attribute '${key}' for '${entity}': must be <= ${def.maximum}`);
      }
    }
  }
}
