import * as assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { DiagramDomainStore } from '../src/diagrams/commands/diagram-domain.store';
import { NetboxConfigService } from '../src/netbox-config/netbox-config.service';

async function withTempDir(fn: (dir: string) => Promise<void>) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'demo-ai-native-sdlc-'));
  try {
    await fn(dir);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
}

async function testDomainStoreRejectsInvalidParent() {
  const prev = process.env.DIAGRAMS_DIR;

  await withTempDir(async (dir) => {
    process.env.DIAGRAMS_DIR = dir;

    const diagramId = 'd1';
    const filePath = path.join(dir, `${diagramId}.domain.json`);

    await fs.writeFile(
      filePath,
      JSON.stringify(
        {
          version: 1,
          objects: [
            {
              id: 'o1',
              entity: 'region',
              parent: { foo: 'bar' },
              attributes: {},
            },
          ],
        },
        null,
        2,
      ),
      'utf8',
    );

    const store = new DiagramDomainStore();
    await assert.rejects(
      () => store.load(diagramId),
      /Corrupt diagram domain state/i,
    );
  });

  if (prev === undefined) delete process.env.DIAGRAMS_DIR;
  else process.env.DIAGRAMS_DIR = prev;
}

async function testDomainStoreNormalizesParent() {
  const prev = process.env.DIAGRAMS_DIR;

  await withTempDir(async (dir) => {
    process.env.DIAGRAMS_DIR = dir;

    const diagramId = 'd2';
    const filePath = path.join(dir, `${diagramId}.domain.json`);

    await fs.writeFile(
      filePath,
      JSON.stringify(
        {
          version: 1,
          objects: [
            {
              id: 'o1',
              entity: 'site',
              parent: { entity: ' region ', id: ' r1 ' },
              attributes: { name: 'Site 1' },
            },
            {
              id: 'o2',
              entity: 'tenant',
              parent: { root: 'definitions' },
              attributes: {},
            },
          ],
        },
        null,
        2,
      ),
      'utf8',
    );

    const store = new DiagramDomainStore();
    const state = await store.load(diagramId);

    assert.equal(state.objects.length, 2);
    assert.deepEqual(state.objects[0].parent, { entity: 'region', id: 'r1' });
    assert.deepEqual(state.objects[1].parent, { root: 'definitions' });
  });

  if (prev === undefined) delete process.env.DIAGRAMS_DIR;
  else process.env.DIAGRAMS_DIR = prev;
}

async function testNetboxConfigAllowsMissingStyles() {
  const prev = process.env.NETBOX_CONFIG_DIR;

  await withTempDir(async (dir) => {
    process.env.NETBOX_CONFIG_DIR = dir;

    await fs.writeFile(
      path.join(dir, 'netbox-model.yaml'),
      [
        'version: 1',
        'roots:',
        '  definitions: {}',
        '  infrastructure: {}',
        'entities: {}',
        '',
      ].join('\n'),
      'utf8',
    );

    await fs.writeFile(
      path.join(dir, 'netbox-to-mermaid.yaml'),
      [
        'version: 1',
        'kind: netbox-to-mermaid',
        'roots:',
        '  definitions:',
        '    mermaid: { type: subgraph, id: definitions, label: "*Definitions*" }',
        '  infrastructure:',
        '    mermaid: { type: subgraph, id: infrastructure, label: "*Infrastructure*" }',
        'entities: {}',
        '',
      ].join('\n'),
      'utf8',
    );

    const svc = new NetboxConfigService();
    await svc.onModuleInit();

    const styles = svc.getStyles();
    assert.ok(styles);
    assert.ok(typeof (styles as any).version !== 'undefined');
  });

  if (prev === undefined) delete process.env.NETBOX_CONFIG_DIR;
  else process.env.NETBOX_CONFIG_DIR = prev;
}

async function testNetboxConfigErrorsAreActionable() {
  const prev = process.env.NETBOX_CONFIG_DIR;

  await withTempDir(async (dir) => {
    process.env.NETBOX_CONFIG_DIR = dir;

    // Missing required model.entities
    await fs.writeFile(
      path.join(dir, 'netbox-model.yaml'),
      [
        'version: 1',
        'roots:',
        '  definitions: {}',
        '  infrastructure: {}',
        '',
      ].join('\n'),
      'utf8',
    );

    await fs.writeFile(
      path.join(dir, 'netbox-to-mermaid.yaml'),
      [
        'version: 1',
        'kind: netbox-to-mermaid',
        'roots: {}',
        'entities: {}',
        '',
      ].join('\n'),
      'utf8',
    );

    const svc = new NetboxConfigService();
    await assert.rejects(
      () => svc.onModuleInit(),
      (err: any) => {
        const msg = String(err?.message ?? err);
        return msg.includes("missing required section 'entities'") && msg.includes('netbox-model.yaml');
      },
    );
  });

  if (prev === undefined) delete process.env.NETBOX_CONFIG_DIR;
  else process.env.NETBOX_CONFIG_DIR = prev;
}

async function main() {
  await testDomainStoreRejectsInvalidParent();
  await testDomainStoreNormalizesParent();
  await testNetboxConfigAllowsMissingStyles();
  await testNetboxConfigErrorsAreActionable();

  // eslint-disable-next-line no-console
  console.log('diagram-domain-store.test.ts: OK');
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
