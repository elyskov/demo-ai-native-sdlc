import { BadRequestException, Inject, Injectable, Logger } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import type { Collection, Db } from 'mongodb';

import { MONGO_DB } from '../../shared/mongo/mongo.constants';

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

type DiagramDomainDoc = {
  _id: string; // diagramId
  version: 1;
  objects: any[];
  updatedAt: Date;
};

@Injectable()
export class DiagramDomainStore {
  private readonly logger = new Logger(DiagramDomainStore.name);

  private readonly domains: Collection<DiagramDomainDoc>;

  constructor(@Inject(MONGO_DB) db: Db) {
    this.domains = db.collection<DiagramDomainDoc>('diagram_domains');
  }

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
    const doc = await this.domains.findOne({ _id: diagramId });
    if (!doc) {
      const empty: DiagramDomainState = { version: 1, objects: [] };
      await this.domains.updateOne(
        { _id: diagramId },
        { $setOnInsert: { version: 1, objects: [], updatedAt: new Date() } },
        { upsert: true },
      );
      return empty;
    }

    try {
      const objects = Array.isArray((doc as any).objects) ? ((doc as any).objects as any[]) : [];

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
    const objects = Array.isArray(state.objects) ? state.objects : [];
    const sanitized = objects.map((o) => {
      const objectId = String((o as any).id ?? '');
      const entity = String((o as any).entity ?? '');
      if (!objectId || !entity) {
        throw new BadRequestException('Invalid domain object');
      }

      const parent = this.parseParentRef((o as any).parent, { diagramId, objectId, entity });
      const attributes =
        typeof (o as any).attributes === 'object' && (o as any).attributes
          ? (o as any).attributes
          : {};

      return { id: objectId, entity, parent, attributes };
    });

    await this.domains.updateOne(
      { _id: diagramId },
      { $set: { version: 1, objects: sanitized, updatedAt: new Date() } },
      { upsert: true },
    );
  }

  async delete(diagramId: string): Promise<void> {
    await this.domains.deleteOne({ _id: diagramId });
  }

  generateObjectId(): string {
    // Stable object ids; small and URL-friendly.
    return randomBytes(6).toString('hex');
  }

}
