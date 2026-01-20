import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { promises as fs } from 'node:fs';
import * as path from 'node:path';

import { atomicWriteFile, ensureDir, fileExists } from '../../shared/fs-utils';

export type DomainParentRef =
  | { root: 'definitions' | 'infrastructure' }
  | { entity: string; id: string };

export type DomainObject = {
  id: string;
  entity: string;
  parent: DomainParentRef;
  attributes: Record<string, any>;
};

export type DiagramDomainState = {
  version: 1;
  objects: DomainObject[];
};

@Injectable()
export class DiagramDomainStore {
  private readonly logger = new Logger(DiagramDomainStore.name);
  private readonly diagramsDir = process.env.DIAGRAMS_DIR ?? '/app/diagrams';

  async load(diagramId: string): Promise<DiagramDomainState> {
    await ensureDir(this.diagramsDir);

    const filePath = this.domainFilePath(diagramId);
    if (!(await fileExists(filePath))) {
      const empty: DiagramDomainState = { version: 1, objects: [] };
      await atomicWriteFile(filePath, JSON.stringify(empty, null, 2));
      return empty;
    }

    try {
      const raw = await fs.readFile(filePath, 'utf8');
      const parsed = JSON.parse(raw) as Partial<DiagramDomainState>;
      const objects = Array.isArray(parsed.objects) ? (parsed.objects as any[]) : [];

      return {
        version: 1,
        objects: objects
          .filter((o) => o && typeof o.id === 'string' && typeof o.entity === 'string')
          .map((o) => ({
            id: String(o.id),
            entity: String(o.entity),
            parent: (o as any).parent,
            attributes: typeof (o as any).attributes === 'object' && (o as any).attributes ? (o as any).attributes : {},
          })),
      };
    } catch (err) {
      this.logger.error(`Failed to load domain state for diagram '${diagramId}'`, (err as any)?.stack);
      throw new BadRequestException('Corrupt diagram domain state');
    }
  }

  async save(diagramId: string, state: DiagramDomainState): Promise<void> {
    const filePath = this.domainFilePath(diagramId);
    await atomicWriteFile(filePath, JSON.stringify(state, null, 2));
  }

  generateObjectId(): string {
    // Stable object ids; small and URL-friendly.
    return randomBytes(6).toString('hex');
  }

  private domainFilePath(diagramId: string): string {
    return path.join(this.diagramsDir, `${diagramId}.domain.json`);
  }
}
