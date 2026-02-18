import test from 'node:test'
import assert from 'node:assert/strict'

import { normalizeMermaidId, parseMermaidDomainRef } from './mermaid-id.js'

test('normalizeMermaidId strips attr_ prefix', () => {
  assert.equal(normalizeMermaidId('attr_region_123'), 'region_123')
  assert.equal(normalizeMermaidId('region_123'), 'region_123')
})

test('parseMermaidDomainRef parses known entity ids', () => {
  assert.deepEqual(parseMermaidDomainRef('region_123'), { entity: 'region', id: '123' })
  assert.deepEqual(parseMermaidDomainRef('if_abcd1'), { entity: 'if', id: 'abcd1' })
  assert.deepEqual(parseMermaidDomainRef('attr_site_42'), { entity: 'site', id: '42' })
})

test('parseMermaidDomainRef parses site-group ids', () => {
  assert.deepEqual(parseMermaidDomainRef('site_group_99'), { entity: 'site-group', id: '99' })
  assert.deepEqual(parseMermaidDomainRef('attr_site_group_99'), { entity: 'site-group', id: '99' })
})

test('parseMermaidDomainRef parses definitions entity ids with underscore prefixes', () => {
  assert.deepEqual(parseMermaidDomainRef('manufacturer_abc123'), { entity: 'manufacturer', id: 'abc123' })
  assert.deepEqual(parseMermaidDomainRef('device_role_123'), { entity: 'device-role', id: '123' })
  assert.deepEqual(parseMermaidDomainRef('tenant_group_42'), { entity: 'tenant-group', id: '42' })
  assert.deepEqual(parseMermaidDomainRef('device_type_a1'), { entity: 'device-type', id: 'a1' })
  assert.deepEqual(parseMermaidDomainRef('virtual_chassis_vc1'), { entity: 'virtual-chassis', id: 'vc1' })
})

test('parseMermaidDomainRef ignores Mermaid internal suffixes', () => {
  assert.deepEqual(parseMermaidDomainRef('region_123-label'), { entity: 'region', id: '123' })
  assert.deepEqual(parseMermaidDomainRef('attr_region_123-text'), { entity: 'region', id: '123' })
  assert.deepEqual(parseMermaidDomainRef('attr_device_role_123-text'), { entity: 'device-role', id: '123' })
})

test('parseMermaidDomainRef parses root ids', () => {
  assert.deepEqual(parseMermaidDomainRef('definitions'), { entity: 'root', id: 'definitions' })
  assert.deepEqual(parseMermaidDomainRef('infrastructure'), { entity: 'root', id: 'infrastructure' })
  assert.deepEqual(parseMermaidDomainRef('connections'), { entity: 'root', id: 'connections' })
})

test('parseMermaidDomainRef returns null for unknown ids', () => {
  assert.equal(parseMermaidDomainRef(''), null)
  assert.equal(parseMermaidDomainRef('flowchart-xyz'), null)
  assert.equal(parseMermaidDomainRef('unknown_1'), null)
  assert.equal(parseMermaidDomainRef('region_'), null)
})
