import { Injectable } from '@nestjs/common';

import type { CsvDatasetGenerator } from './csv.generator';
import type { CsvDataset } from './models/csv.models';

function stableHashToNumber(input: string): number {
  // Simple deterministic hash for mock data variation.
  let hash = 2166136261;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

@Injectable()
export class MockCsvDatasetGenerator implements CsvDatasetGenerator {
  async generate(input: {
    diagramId: string;
    diagramName: string;
    diagramContent: string;
  }): Promise<CsvDataset> {
    const seed = stableHashToNumber(
      `${input.diagramId}:${input.diagramName}:${input.diagramContent}`,
    );

    // Make the dataset composition non-static but deterministic.
    const wantsInterfaces = /interface|nic|port/i.test(input.diagramContent);
    const wantsCircuits = /circuit|isp|wan/i.test(input.diagramContent);

    const elements: CsvDataset['elements'] = [];

    elements.push({
      type: 'devices',
      csvContent:
        'name,role\n' +
        `node-${seed % 97},compute\n` +
        `node-${(seed + 1) % 97},compute\n`,
    });

    if (wantsInterfaces || seed % 2 === 0) {
      elements.push({
        type: 'interfaces',
        csvContent:
          'device,name,enabled\n' +
          `node-${seed % 97},eth0,true\n` +
          `node-${(seed + 1) % 97},eth0,true\n`,
      });
    }

    if (wantsCircuits || seed % 3 === 0) {
      elements.push({
        type: 'circuits',
        csvContent:
          'cid,provider,status\n' +
          `C-${seed % 1000},ISP-A,active\n`,
      });
    }

    // Ensure unique types.
    const seen = new Set<string>();
    for (const el of elements) {
      if (seen.has(el.type)) {
        throw new Error(`Duplicate CSV element type in mock generator: ${el.type}`);
      }
      seen.add(el.type);
    }

    return {
      diagramId: input.diagramId,
      diagramName: input.diagramName,
      elements,
    };
  }
}
