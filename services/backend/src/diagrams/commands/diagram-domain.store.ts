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

  private parseParentRef(value: unknown, ctx: { diagramId: string; objectId: string; entity: string }): DomainParentRef {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      throw new Error(
        `Invalid parent for '${ctx.entity}:${ctx.objectId}' in diagram '${ctx.diagramId}' (expected an object)`,
      );
    }

    const v = value as any;

    const hasRoot = Object.prototype.hasOwnProperty.call(v, 'root');
    const hasEntity = Object.prototype.hasOwnProperty.call(v, 'entity');
    const hasId = Object.prototype.hasOwnProperty.call(v, 'id');

    // Disallow ambiguous shapes (e.g. both root and entity/id).
    if (hasRoot && (hasEntity || hasId)) {
      throw new Error(
        `Invalid parent for '${ctx.entity}:${ctx.objectId}' in diagram '${ctx.diagramId}' (cannot combine root with entity/id)`,
      );
    }

    if (hasRoot) {
      const root = typeof v.root === 'string' ? v.root.trim() : '';
      if (root !== 'definitions' && root !== 'infrastructure') {
        throw new Error(
          `Invalid parent.root '${String(v.root)}' for '${ctx.entity}:${ctx.objectId}' in diagram '${ctx.diagramId}'`,
        );
      }
      return { root };
    }

    if (hasEntity || hasId) {
      const entity = typeof v.entity === 'string' ? v.entity.trim() : '';
      const id = typeof v.id === 'string' ? v.id.trim() : '';
      if (!entity || !id) {
        throw new Error(
          `Invalid parent for '${ctx.entity}:${ctx.objectId}' in diagram '${ctx.diagramId}' (expected non-empty entity and id)`,
        );
      }
      return { entity, id };
    }

    throw new Error(
      `Invalid parent for '${ctx.entity}:${ctx.objectId}' in diagram '${ctx.diagramId}' (expected root or entity/id reference)`,
    );
  }

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
          .map((o) => {
            const objectId = String(o.id);
            const entity = String(o.entity);
            const parent = this.parseParentRef((o as any).parent, { diagramId, objectId, entity });
            const attributes =
              typeof (o as any).attributes === 'object' && (o as any).attributes
                ? (o as any).attributes
                : {};

            return { id: objectId, entity, parent, attributes };
          }),
      };
    } catch (err) {
      const msg = (err as any)?.message ? String((err as any).message) : String(err);
      this.logger.error(
        `Failed to load domain state for diagram '${diagramId}': ${msg}`,
        (err as any)?.stack,
      );
      throw new BadRequestException(`Corrupt diagram domain state: ${msg}`);
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
