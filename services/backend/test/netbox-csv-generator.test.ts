import { strict as assert } from 'node:assert';

import type { NetboxModelConfig } from '../src/netbox-config/netbox-config.models';
import { buildEntityCsvSchema, csvEscapeCell, renderEntityCsv } from '../src/csv/netbox-csv.generator';
import type { DomainObject } from '../src/diagrams/commands/diagram-domain.store';

function testSchemaOrdering() {
  const model: NetboxModelConfig = {
    version: 1,
    roots: { definitions: {}, infrastructure: {} },
    entities: {
      region: {
        parent: { allowed: [{ entity: 'region', field: 'parent' }, { root: 'infrastructure' }] },
        links: {},
        attributes: { name: { required: true }, slug: { required: true } },
      },
      tenant: {
        links: {},
        attributes: { name: { required: true } },
      },
      site: {
        parent: { allowed: [{ entity: 'region', field: 'region' }, { root: 'infrastructure' }] },
        links: { tenant: { entity: 'tenant', field: 'tenant', required: false } },
        attributes: { name: { required: true }, slug: { required: true }, status: { required: true } },
      },
    },
  };

  const siteSchema = buildEntityCsvSchema(model, 'site');
  assert.deepEqual(siteSchema.columns, ['region', 'tenant', 'name', 'slug', 'status']);

  const regionSchema = buildEntityCsvSchema(model, 'region');
  assert.deepEqual(regionSchema.columns, ['parent', 'name', 'slug']);
}

function testCsvEscaping() {
  assert.equal(csvEscapeCell('a'), 'a');
  assert.equal(csvEscapeCell('a,b'), '"a,b"');
  assert.equal(csvEscapeCell('a\nb'), '"a\nb"');
  assert.equal(csvEscapeCell('a"b'), '"a""b"');
}

function testDeterministicRowOrderingAndRefs() {
  const model: NetboxModelConfig = {
    version: 1,
    roots: { infrastructure: {} },
    entities: {
      region: {
        links: {},
        attributes: { name: { required: true }, slug: { required: true } },
      },
      site: {
        parent: { allowed: [{ entity: 'region', field: 'region' }] },
        links: {},
        attributes: { name: { required: true }, slug: { required: true } },
      },
    },
  };

  const objects: DomainObject[] = [
    {
      id: 'r1',
      entity: 'region',
      parent: { root: 'infrastructure' },
      attributes: { name: 'Region A', slug: 'region-a' },
    },
    {
      id: 's2',
      entity: 'site',
      parent: { entity: 'region', id: 'r1' },
      attributes: { name: 'Beta', slug: 'beta' },
    },
    {
      id: 's1',
      entity: 'site',
      parent: { entity: 'region', id: 'r1' },
      attributes: { name: 'Alpha', slug: 'alpha' },
    },
  ];

  const objectsById = new Map(objects.map((o) => [o.id, o] as const));
  const csv = renderEntityCsv(model, 'site', objects.filter((o) => o.entity === 'site'), objectsById);

  const lines = csv.trimEnd().split('\n');
  assert.equal(lines[0], 'region,name,slug');

  // Rows should be ordered by name then id.
  assert.equal(lines[1], 'Region A,Alpha,alpha');
  assert.equal(lines[2], 'Region A,Beta,beta');
}

function main() {
  testSchemaOrdering();
  testCsvEscaping();
  testDeterministicRowOrderingAndRefs();
  // eslint-disable-next-line no-console
  console.log('netbox-csv-generator.test.ts: OK');
}

main();
