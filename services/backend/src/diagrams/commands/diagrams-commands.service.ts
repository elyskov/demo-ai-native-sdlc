import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';

import { NetboxModelService } from '../../netbox-config/netbox-model.service';
import { DiagramsService } from '../diagrams.service';
import { MermaidGeneratorService } from '../mermaid/mermaid-generator.service';
import { DiagramCommandDto } from './dto/diagram-command.dto';
import { DiagramDomainStore, DomainObject, DomainParentRef } from './diagram-domain.store';

@Injectable()
export class DiagramsCommandsService {
  private readonly logger = new Logger(DiagramsCommandsService.name);

  constructor(
    private readonly diagramsService: DiagramsService,
    private readonly modelService: NetboxModelService,
    private readonly domainStore: DiagramDomainStore,
    private readonly mermaid: MermaidGeneratorService,
  ) {}

  async apply(diagramId: string, dto: DiagramCommandDto) {
    const diagram = await this.diagramsService.get(diagramId);

    if (dto.command === 'create') {
      return this.applyCreate(diagramId, diagram.name, diagram.content, dto);
    }

    if (dto.command === 'update') {
      return this.applyUpdate(diagramId, diagram.name, diagram.content, dto);
    }

    if (dto.command === 'delete') {
      return this.applyDelete(diagramId, diagram.name, diagram.content, dto);
    }

    if (dto.command === 'move') {
      return this.applyMove(diagramId, diagram.name, diagram.content, dto);
    }

    if (dto.command === 'list-types') {
      return this.applyListTypes();
    }

    if (dto.command === 'list-elements') {
      return this.applyListElements(diagramId, dto);
    }

    throw new BadRequestException('Unsupported command');
  }

  private async applyCreate(diagramId: string, diagramName: string, content: string, dto: DiagramCommandDto) {
    const model = this.modelService.get();
    const entityCfg = model.entities?.[dto.entity];
    if (!entityCfg) {
      throw new BadRequestException(`Unknown entity '${dto.entity}'`);
    }

    const parent = this.parseParent(dto);
    this.validateParent(dto.entity, parent);
    this.validateAttributes(dto.entity, dto.attributes ?? {});

    const state = await this.domainStore.load(diagramId);

    const newId = this.domainStore.generateObjectId();
    const obj: DomainObject = {
      id: newId,
      entity: dto.entity,
      parent: parent!,
      attributes: dto.attributes ?? {},
    };

    state.objects.push(obj);
    await this.domainStore.save(diagramId, state);

    // Mermaid placement: parent rules come from netbox-model.yaml; the command provides the parent.
    // We do not parse Mermaid; we insert deterministic blocks using insertion markers.
    const { mermaidId, block } = this.mermaid.renderEntityBlock(dto.entity, {
      id: obj.id,
      name: obj.attributes?.name,
      ...obj.attributes,
    });

    const parentMermaidId = this.resolveParentMermaidId(parent!);
    const updated = this.mermaid.insertBlockIntoParent(content, parentMermaidId, block);

    await this.diagramsService.updateContent(diagramId, updated);

    this.logger.log(`Applied create ${dto.entity} '${obj.id}' to diagram '${diagramId}'`);

    return { id: diagramId, name: diagramName, content: updated };
  }

  private async applyDelete(diagramId: string, diagramName: string, content: string, dto: DiagramCommandDto) {
    if (!dto.id) {
      throw new BadRequestException('Missing id for delete');
    }

    const state = await this.domainStore.load(diagramId);
    const idx = state.objects.findIndex((o) => o.id === dto.id && o.entity === dto.entity);
    if (idx < 0) {
      throw new NotFoundException(`Object '${dto.entity}:${dto.id}' not found in diagram domain state`);
    }

    const obj = state.objects[idx];
    state.objects.splice(idx, 1);
    await this.domainStore.save(diagramId, state);

    const mermaidId = this.resolveEntityMermaidId(obj.entity, obj.id);
    const updated = this.mermaid.removeBlockById(content, mermaidId);

    await this.diagramsService.updateContent(diagramId, updated);
    this.logger.log(`Applied delete ${dto.entity} '${dto.id}' to diagram '${diagramId}'`);

    return { id: diagramId, name: diagramName, content: updated };
  }

  private async applyMove(diagramId: string, diagramName: string, content: string, dto: DiagramCommandDto) {
    if (!dto.id) {
      throw new BadRequestException('Missing id for move');
    }

    const parent = this.parseParent(dto);
    this.validateParent(dto.entity, parent);

    const state = await this.domainStore.load(diagramId);
    const obj = state.objects.find((o) => o.id === dto.id && o.entity === dto.entity);
    if (!obj) {
      throw new NotFoundException(`Object '${dto.entity}:${dto.id}' not found in diagram domain state`);
    }

    obj.parent = parent!;
    await this.domainStore.save(diagramId, state);

    const mermaidId = this.resolveEntityMermaidId(obj.entity, obj.id);
    const without = this.mermaid.removeBlockById(content, mermaidId);

    // Re-render block deterministically and insert into new parent
    const { block } = this.mermaid.renderEntityBlock(obj.entity, {
      id: obj.id,
      name: obj.attributes?.name,
      ...obj.attributes,
    });

    const parentMermaidId = this.resolveParentMermaidId(parent!);
    const updated = this.mermaid.insertBlockIntoParent(without, parentMermaidId, block);

    await this.diagramsService.updateContent(diagramId, updated);
    this.logger.log(`Applied move ${dto.entity} '${dto.id}' to diagram '${diagramId}'`);

    return { id: diagramId, name: diagramName, content: updated };
  }

  private parseParent(dto: DiagramCommandDto): DomainParentRef | null {
    const p = dto.parent;

    if (p?.root) {
      if (p.root !== 'definitions' && p.root !== 'infrastructure') {
        throw new BadRequestException(`Invalid parent.root '${p.root}'`);
      }
      return { root: p.root };
    }

    if (p?.entity && p?.id) {
      return { entity: p.entity, id: p.id };
    }

    return null;
  }

  private validateParent(entity: string, parent: DomainParentRef | null) {
    const model = this.modelService.get();
    const cfg = model.entities?.[entity];
    if (!cfg) throw new BadRequestException(`Unknown entity '${entity}'`);

    const allowed = cfg.parent?.allowed ?? [];

    if (cfg.parent?.required) {
      if (!parent) {
        throw new BadRequestException(`Parent is required for entity '${entity}'`);
      }
    }

    if (!parent) return;

    const ok = allowed.some((a) => {
      if ('root' in parent && a.root) return a.root === parent.root;
      if ('entity' in parent && a.entity) return a.entity === parent.entity;
      return false;
    });

    if (!ok && allowed.length) {
      throw new BadRequestException(`Parent not allowed for '${entity}'`);
    }
  }

  private validateAttributes(entity: string, attrs: Record<string, any>) {
    const model = this.modelService.get();
    const cfg = model.entities?.[entity];
    if (!cfg) throw new BadRequestException(`Unknown entity '${entity}'`);

    const required = Object.entries(cfg.attributes ?? {})
      .filter(([, v]) => v?.required)
      .map(([k]) => k);

    for (const key of required) {
      const val = attrs[key];
      if (val === undefined || val === null || String(val).trim() === '') {
        throw new BadRequestException(`Missing required attribute '${key}' for '${entity}'`);
      }
    }
  }

  private resolveParentMermaidId(parent: DomainParentRef): string {
    if ('root' in parent) {
      return parent.root;
    }

    return this.resolveEntityMermaidId(parent.entity, parent.id);
  }

  private resolveEntityMermaidId(entity: string, objectId: string): string {
    try {
      return this.mermaid.resolveEntityMermaidId(entity, objectId);
    } catch (err) {
      throw new BadRequestException((err as any)?.message ?? 'Failed to resolve Mermaid id');
    }
  }

  // Update command: modify attributes of an existing entity (mock implementation)
  private async applyUpdate(diagramId: string, diagramName: string, content: string, dto: DiagramCommandDto) {
    if (!dto.id) {
      throw new BadRequestException('Missing id for update');
    }

    const state = await this.domainStore.load(diagramId);
    const obj = state.objects.find((o) => o.id === dto.id && o.entity === dto.entity);
    if (!obj) {
      throw new NotFoundException(`Object '${dto.entity}:${dto.id}' not found in diagram domain state`);
    }

    // Merge new attributes into existing object
    const mergedAttrs = { ...obj.attributes, ...(dto.attributes || {}) };
    this.validateAttributes(dto.entity, mergedAttrs);
    obj.attributes = mergedAttrs;
    await this.domainStore.save(diagramId, state);

    this.logger.log(`Applied update to ${dto.entity} '${dto.id}' in diagram '${diagramId}'`);
    return { id: diagramId, name: diagramName, content };
  }

  // List entity types: return available entity types from model (mock implementation)
  private applyListTypes() {
    const model = this.modelService.get();
    const types = Object.keys(model.entities ?? {}).sort();
    return { types };
  }

  // List elements: return child entities available under a given parent (mock implementation)
  private async applyListElements(diagramId: string, dto: DiagramCommandDto) {
    const parent = this.parseParent(dto);
    if (!parent) {
      throw new BadRequestException('Parent is required for list-elements');
    }

    const state = await this.domainStore.load(diagramId);
    
    // Find all objects matching the parent context
    const elements = state.objects
      .filter((obj) => {
        if ('root' in parent && 'root' in obj.parent) {
          return obj.parent.root === parent.root;
        }
        if ('entity' in parent && 'entity' in obj.parent) {
          return obj.parent.entity === parent.entity && obj.parent.id === parent.id;
        }
        return false;
      })
      .map((obj) => ({
        id: obj.id,
        entity: obj.entity,
        name: obj.attributes?.name ?? `${obj.entity}_${obj.id}`,
      }));

    return { elements };
  }
}
