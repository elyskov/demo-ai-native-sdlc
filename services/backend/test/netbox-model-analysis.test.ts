import * as assert from 'node:assert/strict';

import type { NetboxModelConfig } from '../src/netbox-config/netbox-config.models';
import {
  analyzeModelByRoot,
  closureWithDependencies,
  topoSortDeterministic,
} from '../src/netbox-config/netbox-model-analysis';

function modelFixture(): NetboxModelConfig {
  return {
    version: 1,
    roots: {
      definitions: { description: 'Definitions' },
      infrastructure: { description: 'Infrastructure' },
    },
    entities: {
      // defs
      tenant: {
        parent: { allowed: [{ root: 'definitions' }] },
        links: {},
        attributes: {},
      },
      // infra chain: region -> site -> rack
      region: {
        parent: { allowed: [{ root: 'infrastructure' }] },
        links: {},
        attributes: {},
      },
      site: {
        parent: { allowed: [{ entity: 'region' }] },
        links: { tenant: { entity: 'tenant', field: 'tenant' } },
        attributes: {},
      },
      rack: {
        parent: { allowed: [{ entity: 'site' }] },
        links: {},
        attributes: {},
      },
      // independent infra node to test tie-breaking
      vlan: {
        parent: { allowed: [{ root: 'infrastructure' }] },
        links: {},
        attributes: {},
      },
    },
  };
}

// Basic deterministic topo behavior
{
  const { ordered, cycleNodes } = topoSortDeterministic(
    ['b', 'a', 'c'],
    [{ from: 'a', to: 'c' }],
  );
  assert.deepEqual(cycleNodes, []);
  assert.deepEqual(ordered, ['a', 'b', 'c']);
}

// Model analysis by roots
{
  const model = modelFixture();
  const analyses = analyzeModelByRoot(model);

  assert.ok(analyses.definitions);
  assert.ok(analyses.infrastructure);

  // definitions contains tenant only
  assert.deepEqual(analyses.definitions.ordered, ['tenant']);

  // infrastructure contains region/site/rack/vlan and orders dependencies correctly.
  const ordered = analyses.infrastructure.ordered;
  assert.ok(ordered.indexOf('region') < ordered.indexOf('site'));
  assert.ok(ordered.indexOf('site') < ordered.indexOf('rack'));

  // stable ordering for independent nodes (region vs vlan) comes from lexicographic tie-breaker.
  assert.ok(ordered.indexOf('region') < ordered.indexOf('vlan'));

  // closure includes dependencies
  const needed = closureWithDependencies(analyses.infrastructure, ['rack']);
  assert.equal(needed.has('rack'), true);
  assert.equal(needed.has('site'), true);
  assert.equal(needed.has('region'), true);
}

// Cycle detection
{
  const model = modelFixture();
  model.entities.a = {
    parent: { allowed: [{ root: 'infrastructure' }] },
    links: { b: { entity: 'b', field: 'b' } },
  } as any;
  model.entities.b = {
    parent: { allowed: [{ root: 'infrastructure' }] },
    links: { a: { entity: 'a', field: 'a' } },
  } as any;

  assert.throws(() => analyzeModelByRoot(model), /cycle detected/i);
}

console.log('netbox-model-analysis.test.ts: OK');
