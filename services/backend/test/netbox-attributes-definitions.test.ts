import * as assert from 'node:assert/strict';

import { validateEntityAttributes } from '../src/diagrams/commands/attribute-validation';
import { validateNetboxModelConfig } from '../src/netbox-config/netbox-model-validation';

function baseModel(entities: Record<string, any>) {
  return {
    version: 1,
    roots: {
      definitions: { description: 'defs' },
      infrastructure: { description: 'infra' },
    },
    entities,
  };
}

function expectThrows(fn: () => void, re: RegExp) {
  try {
    fn();
    assert.fail(`Expected error matching ${re}`);
  } catch (err) {
    const msg = (err as any)?.message ? String((err as any).message) : String(err);
    assert.match(msg, re);
  }
}

async function testModelConfigAcceptsNewFields() {
  const model = baseModel({
    site: {
      attributes: {
        name: { required: true, maxLength: 100 },
        slug: { required: true, pattern: '^[-a-zA-Z0-9_]+$' },
        status: {
          required: true,
          value: ['planned', 'active'],
          label: ['Planned', 'Active'],
        },
        latitude: {
          type: 'number',
          pattern: '^\\d{2}\\.\\d{6}$',
          nullable: true,
          minimum: -90,
          maximum: 90,
        },
      },
    },
  });

  validateNetboxModelConfig(model as any, 'netbox-model.yaml');
}

async function testModelConfigRejectsUnsupportedType() {
  const model = baseModel({
    region: {
      attributes: {
        name: { type: 'float' },
      },
    },
  });

  expectThrows(
    () => validateNetboxModelConfig(model as any, 'netbox-model.yaml'),
    /unsupported type/i,
  );
}

async function testModelConfigRejectsBadRegex() {
  const model = baseModel({
    region: {
      attributes: {
        slug: { pattern: '(' },
      },
    },
  });

  expectThrows(
    () => validateNetboxModelConfig(model as any, 'netbox-model.yaml'),
    /invalid pattern regex/i,
  );
}

async function testModelConfigRejectsLabelMismatch() {
  const model = baseModel({
    rack: {
      attributes: {
        width: { value: [10, 19], label: ['10 inches'] },
      },
    },
  });

  expectThrows(
    () => validateNetboxModelConfig(model as any, 'netbox-model.yaml'),
    /length mismatch/i,
  );
}

async function testModelConfigRejectsMinimumGreaterThanMaximum() {
  const model = baseModel({
    site: {
      attributes: {
        latitude: { type: 'number', minimum: 2, maximum: 1 },
      },
    },
  });

  expectThrows(
    () => validateNetboxModelConfig(model as any, 'netbox-model.yaml'),
    /minimum > maximum/i,
  );
}

async function testAttributeValidationMaxLength() {
  expectThrows(
    () => validateEntityAttributes('region', { name: 'abcd' }, { name: { required: true, maxLength: 3 } }),
    /exceeds maxLength/i,
  );
}

async function testAttributeValidationPattern() {
  expectThrows(
    () => validateEntityAttributes('region', { slug: 'bad slug' }, { slug: { required: true, pattern: '^[-a-zA-Z0-9_]+$' } }),
    /does not match pattern/i,
  );
}

async function testAttributeValidationNullableSkipsOtherRulesWhenEmpty() {
  validateEntityAttributes(
    'site',
    { latitude: '' },
    { latitude: { type: 'number', nullable: true, pattern: '^\\d{2}\\.\\d{6}$', minimum: -90, maximum: 90 } },
  );
}

async function testAttributeValidationNumberMinimumMaximum() {
  expectThrows(
    () => validateEntityAttributes(
      'site',
      { latitude: '91.000000' },
      { latitude: { type: 'number', pattern: '^\\d{2}\\.\\d{6}$', minimum: -90, maximum: 90 } },
    ),
    /<= 90/i,
  );

  validateEntityAttributes(
    'site',
    { latitude: '02.123456' },
    { latitude: { type: 'number', pattern: '^\\d{2}\\.\\d{6}$', minimum: -90, maximum: 90 } },
  );
}

async function testAttributeValidationIntegerRejectsDecimals() {
  expectThrows(
    () => validateEntityAttributes('rack-type', { width: '19.5' }, { width: { type: 'integer' } }),
    /expected integer/i,
  );

  validateEntityAttributes('rack-type', { width: '19' }, { width: { type: 'integer' } });
}

async function testAttributeValidationBoolean() {
  expectThrows(
    () => validateEntityAttributes('rack-type', { desc_units: 'yes' }, { desc_units: { type: 'boolean' } }),
    /expected boolean/i,
  );

  validateEntityAttributes('rack-type', { desc_units: 'false' }, { desc_units: { type: 'boolean' } });
}

async function testAttributeValidationEnumStringifiedWhenTypeString() {
  validateEntityAttributes(
    'rack-type',
    { width: '19' },
    { width: { value: [10, 19, 21, 23] } },
  );

  expectThrows(
    () => validateEntityAttributes('rack-type', { width: '18' }, { width: { value: [10, 19, 21, 23] } }),
    /must be one of/i,
  );
}

async function main() {
  await testModelConfigAcceptsNewFields();
  await testModelConfigRejectsUnsupportedType();
  await testModelConfigRejectsBadRegex();
  await testModelConfigRejectsLabelMismatch();
  await testModelConfigRejectsMinimumGreaterThanMaximum();

  await testAttributeValidationMaxLength();
  await testAttributeValidationPattern();
  await testAttributeValidationNullableSkipsOtherRulesWhenEmpty();
  await testAttributeValidationNumberMinimumMaximum();
  await testAttributeValidationIntegerRejectsDecimals();
  await testAttributeValidationBoolean();
  await testAttributeValidationEnumStringifiedWhenTypeString();

  // eslint-disable-next-line no-console
  console.log('netbox-attributes-definitions.test.ts: OK');
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
