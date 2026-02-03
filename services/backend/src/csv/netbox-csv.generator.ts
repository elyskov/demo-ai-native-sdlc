import { Injectable } from '@nestjs/common';

import { DiagramDomainStore, type DomainObject } from '../diagrams/commands/diagram-domain.store';
import { NetboxModelService } from '../netbox-config/netbox-model.service';
import { NetboxModelAnalysisService } from '../netbox-config/netbox-model-analysis.service';
import type { NetboxModelConfig } from '../netbox-config/netbox-config.models';
import type { CsvDatasetGenerator } from './csv.generator';
import type { CsvDataset } from './models/csv.models';

export function csvEscapeCell(raw: string): string {
  if (raw.includes('"')) {
    raw = raw.replace(/"/g, '""');
  }
  if (/[\r\n,\"]/g.test(raw)) {
    return `"${raw}"`;
  }
  return raw;
}

function stableJsonStringify(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);

  if (Array.isArray(value)) {
    return `[${value.map((v) => stableJsonStringify(v)).join(',')}]`;
  }

  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    const keys = Object.keys(obj).sort((a, b) => a.localeCompare(b));
    const parts = keys.map((k) => `${JSON.stringify(k)}:${JSON.stringify(stableJsonStringify(obj[k]))}`);
    return `{${parts.join(',')}}`;
  }

  return String(value);
}

function bestReferenceValue(obj: DomainObject | undefined): string {
  if (!obj) return '';
  const name = obj.attributes?.name;
  if (typeof name === 'string' && name.trim()) return name.trim();
  const slug = obj.attributes?.slug;
  if (typeof slug === 'string' && slug.trim()) return slug.trim();
  return obj.id;
}

function resolveDomainReference(value: unknown, objectsById: Map<string, DomainObject>): string {
  if (value === null || value === undefined) return '';

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return '';
    const target = objectsById.get(trimmed);
    return target ? bestReferenceValue(target) : trimmed;
  }

  if (typeof value === 'object' && value) {
    const maybe = value as any;
    if (typeof maybe.id === 'string') {
      const target = objectsById.get(maybe.id);
      return target ? bestReferenceValue(target) : maybe.id;
    }
  }

  return stableJsonStringify(value);
}

export type NetboxCsvEntitySchema = {
  columns: string[];
  parentEntityToField: Record<string, string>;
};

export function buildEntityCsvSchema(model: NetboxModelConfig, entity: string): NetboxCsvEntitySchema {
  const cfg = model.entities?.[entity];
  if (!cfg) {
    return { columns: ['id'], parentEntityToField: {} };
  }

  const parentEntityToField: Record<string, string> = {};
  const parentFields: string[] = [];

  for (const a of cfg.parent?.allowed ?? []) {
    const parentEntity = (a as any)?.entity;
    const field = (a as any)?.field;
    if (typeof parentEntity !== 'string' || !parentEntity) continue;
    if (typeof field !== 'string' || !field) continue;

    // Preserve first occurrence order.
    if (!parentFields.includes(field)) parentFields.push(field);
    if (!parentEntityToField[parentEntity]) parentEntityToField[parentEntity] = field;
  }

  const linkFields: string[] = [];
  for (const link of Object.values(cfg.links ?? {})) {
    const field = (link as any)?.field;
    if (typeof field !== 'string' || !field) continue;
    if (!linkFields.includes(field)) linkFields.push(field);
  }

  const attributeFields = Object.keys(cfg.attributes ?? {});

  const seen = new Set<string>();
  const columns: string[] = [];
  for (const col of [...parentFields, ...linkFields, ...attributeFields]) {
    if (!col) continue;
    if (seen.has(col)) continue;
    seen.add(col);
    columns.push(col);
  }

  // Ensure at least one column.
  if (columns.length === 0) columns.push('id');

  return { columns, parentEntityToField };
}

function objectSortKey(o: DomainObject): { primary: string; secondary: string } {
  const name = o.attributes?.name;
  const slug = o.attributes?.slug;
  const primary = (typeof name === 'string' && name.trim())
    ? name.trim()
    : (typeof slug === 'string' && slug.trim())
      ? slug.trim()
      : o.id;

  return { primary, secondary: o.id };
}

export function renderEntityCsv(
  model: NetboxModelConfig,
  entity: string,
  objects: DomainObject[],
  objectsById: Map<string, DomainObject>,
): string {
  const schema = buildEntityCsvSchema(model, entity);
  const cols = schema.columns;
  const parentFieldSet = new Set(Object.values(schema.parentEntityToField));

  const header = cols.join(',');

  const sorted = objects.slice().sort((a, b) => {
    const ka = objectSortKey(a);
    const kb = objectSortKey(b);
    const p = ka.primary.localeCompare(kb.primary);
    if (p) return p;
    return ka.secondary.localeCompare(kb.secondary);
  });

  const lines: string[] = [header];

  for (const obj of sorted) {
    const row = cols.map((col) => {
      // Parent fields (may be blank if parent is a root or doesn't match).
      if (parentFieldSet.has(col)) {
        const p: any = obj.parent as any;
        if (p && typeof p.entity === 'string' && typeof p.id === 'string') {
          const field = schema.parentEntityToField[p.entity];
          if (field === col) {
            return csvEscapeCell(bestReferenceValue(objectsById.get(p.id)));
          }
        }
        return '';
      }

      const raw = (obj.attributes ?? {})[col];
      const resolved = resolveDomainReference(raw, objectsById);
      return csvEscapeCell(resolved);
    });

    lines.push(row.join(','));
  }

  return lines.join('\n') + '\n';
}

@Injectable()
export class NetboxCsvDatasetGenerator implements CsvDatasetGenerator {
  constructor(
    private readonly domainStore: DiagramDomainStore,
    private readonly modelService: NetboxModelService,
    private readonly modelAnalysis: NetboxModelAnalysisService,
  ) {}

  async generate(input: {
    diagramId: string;
    diagramName: string;
    diagramContent: string;
  }): Promise<CsvDataset> {
    const model = this.modelService.get();
    const state = await this.domainStore.load(input.diagramId);

    const objects = state.objects ?? [];
    const objectsById = new Map(objects.map((o) => [o.id, o] as const));

    const seedTypes = new Set(objects.map((o) => o.entity).filter(Boolean));

    // Include dependency types (even if empty) to keep output predictable and ordered.
    const needed = this.modelAnalysis.getGlobalNeededTypes(seedTypes);
    for (const t of seedTypes) needed.add(t);

    const orderedAll = this.modelAnalysis.getGlobalOrderedTypes();
    const types = orderedAll.filter((t) => needed.has(t) && model.entities?.[t]);

    const elements = types.map((type) => {
      const rowsForType = objects.filter((o) => o.entity === type);
      return {
        type,
        csvContent: renderEntityCsv(model, type, rowsForType, objectsById),
      };
    });

    return {
      diagramId: input.diagramId,
      diagramName: input.diagramName,
      elements,
    };
  }
}
