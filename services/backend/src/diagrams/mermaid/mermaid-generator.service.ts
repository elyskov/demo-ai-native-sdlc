import { Injectable } from '@nestjs/common';

import { MermaidStylesService } from '../../netbox-config/mermaid-styles.service';
import { NetboxModelService } from '../../netbox-config/netbox-model.service';
import { NetboxToMermaidService } from '../../netbox-config/netbox-to-mermaid.service';

const INSERT_MARKER_PREFIX = '%% INSERT ';

@Injectable()
export class MermaidGeneratorService {
  constructor(
    private readonly modelService: NetboxModelService,
    private readonly mappingService: NetboxToMermaidService,
    private readonly stylesService: MermaidStylesService,
  ) {}

  initialDiagram(diagramName: string, theme: 'light' | 'dark' = 'light'): string {
    const mapping = this.mappingService.get();
    const styles = this.stylesService.get();

    const indent = mapping.globals?.indentation ?? '  ';
    const nl = mapping.globals?.line_separator ?? '\n';

    const frontmatter = this.renderFrontmatter(styles, diagramName);

    const definitions = this.renderRootSubgraph('definitions', indent, nl, theme);
    const infrastructure = this.renderInfrastructureRoot(indent, nl, theme);

    return [frontmatter, 'flowchart TB', '', definitions, '', infrastructure, ''].join(nl);
  }

  renderEntityBlock(entity: string, object: { id: string; name?: string } & Record<string, any>): {
    mermaidId: string;
    block: string;
  } {
    const model = this.modelService.get();
    const mapping = this.mappingService.get();
    const entityCfg = mapping.entities?.[entity];
    if (!entityCfg) {
      throw new Error(`No Mermaid mapping for entity '${entity}'`);
    }

    const modelEntity = model.entities?.[entity];
    if (!modelEntity) {
      throw new Error(`No NetBox model entry for entity '${entity}'`);
    }

    const indent = mapping.globals?.indentation ?? '  ';
    const nl = mapping.globals?.line_separator ?? '\n';

    const mermaidId = this.applyTemplate(entityCfg.mermaid.id, { object });
    const labelTemplate =
      typeof (entityCfg as any)?.mermaid?.label === 'string'
        ? (entityCfg as any).mermaid.label
        : typeof (entityCfg as any)?.label === 'string'
          ? (entityCfg as any).label
          : '{{ object.name }}';
    const label = this.applyTemplate(labelTemplate, { object });

    const anchorStart = this.anchorStart(mermaidId);
    const anchorEnd = this.anchorEnd(mermaidId);

    // For now we style generated blocks using the default (light) theme.
    // This keeps styling deterministic without parsing existing Mermaid content.
    const theme: 'light' | 'dark' = 'light';

    if (entityCfg.mermaid.type === 'subgraph') {
      const lines: string[] = [];
      lines.push(anchorStart);
      lines.push(`subgraph ${mermaidId}[${label}]`);

      // Attributes are now sourced from netbox-model.yaml (single source of truth).
      // Render only fields that are present in the object, but keep the model's field order.
      const attrs = Object.keys(modelEntity.attributes ?? {});
      const attrLines: string[] = [];
      for (const field of attrs) {
        const value = object[field];
        if (value === undefined || value === null) continue;
        attrLines.push(`${field}: ${String(value)}`);
      }

      const attrsCfg = mapping.others?.attributes?.mermaid;
      let attrMermaidIdUsed: string | null = null;
      if (attrsCfg && attrLines.length) {
        const attrMermaidId = this.applyTemplate(attrsCfg.id ?? 'attr_{{ object.mermaidId }}', {
          object: {
            mermaidId,
            id: object.id,
            name: object.name ?? '',
            entity,
          },
        });

        attrMermaidIdUsed = attrMermaidId;

        const attrLabel = this.escapeQuotes(attrLines.join(nl));
        const template = attrsCfg.template ?? '{{ id }}@{ shape: comment, label: "{{ label }}" }';
        const rendered = this.applyTemplate(template, {
          id: attrMermaidId,
          label: attrLabel,
          object: {
            mermaidId,
            id: object.id,
            name: object.name ?? '',
            entity,
          },
        });

        lines.push(this.indentBlock(rendered.trimEnd(), indent, nl));
      }

      lines.push(`${indent}${INSERT_MARKER_PREFIX}${mermaidId}`);
      lines.push('end');

      // Style entity and its attribute-node (if present). Keep these inside the anchored block
      // so delete/remove operations cleanly remove associated style statements.
      const entityStyle = this.resolveEntityStyle(theme, entity, object);
      const entityStyleLine = this.renderStyleLine(mermaidId, entityStyle);
      if (entityStyleLine) {
        lines.push(entityStyleLine);
      }

      if (attrMermaidIdUsed) {
        const attrStyle = this.resolveAttributeStyle(theme, entity);
        const attrStyleLine = this.renderStyleLine(attrMermaidIdUsed, attrStyle);
        if (attrStyleLine) {
          lines.push(attrStyleLine);
        }
      }

      lines.push(anchorEnd);
      return { mermaidId, block: lines.join(nl) };
    }

    // Node (non-structural) support (minimal v1)
    const nodeLabel = this.escapeQuotes(label);
    const lines: string[] = [anchorStart, `${mermaidId}["${nodeLabel}"]`];

    const nodeStyle = this.resolveEntityStyle(theme, entity, object);
    const nodeStyleLine = this.renderStyleLine(mermaidId, nodeStyle);
    if (nodeStyleLine) {
      lines.push(nodeStyleLine);
    }

    lines.push(anchorEnd);
    return { mermaidId, block: lines.join(nl) };
  }

  resolveEntityMermaidId(entity: string, objectId: string): string {
    const mapping = this.mappingService.get();
    const entityCfg = mapping.entities?.[entity];
    if (!entityCfg) {
      throw new Error(`No Mermaid mapping for entity '${entity}'`);
    }

    const template = entityCfg.mermaid.id;
    return template.replace(/\{\{\s*object\.id\s*\}\}/g, objectId);
  }

  insertBlockIntoParent(content: string, parentMermaidId: string, childBlock: string): string {
    const marker = `${INSERT_MARKER_PREFIX}${parentMermaidId}`;
    const idx = content.indexOf(marker);
    if (idx < 0) {
      throw new Error(`Insertion marker not found for parent '${parentMermaidId}'`);
    }

    const before = content.slice(0, idx);
    const after = content.slice(idx);

    // Ensure there's a blank line between blocks for readability.
    const spacer = before.endsWith('\n\n') ? '' : before.endsWith('\n') ? '\n' : '\n\n';
    return `${before}${spacer}${childBlock}\n${after}`;
  }

  removeBlockById(content: string, mermaidId: string): string {
    const start = this.anchorStart(mermaidId);
    const end = this.anchorEnd(mermaidId);

    const startIdx = content.indexOf(start);
    const endIdx = content.indexOf(end);
    if (startIdx < 0 || endIdx < 0 || endIdx < startIdx) {
      throw new Error(`Anchored block '${mermaidId}' not found`);
    }

    const afterEnd = endIdx + end.length;

    // Remove any trailing newline to keep formatting clean.
    let remainder = content.slice(afterEnd);
    if (remainder.startsWith('\r\n')) remainder = remainder.slice(2);
    else if (remainder.startsWith('\n')) remainder = remainder.slice(1);

    return content.slice(0, startIdx) + remainder;
  }

  private renderInfrastructureRoot(indent: string, nl: string, theme: 'light' | 'dark'): string {
    const mapping = this.mappingService.get();
    const infra = mapping.roots?.infrastructure?.mermaid;
    if (!infra) throw new Error('Missing infrastructure root mapping');

    const anchorStart = this.anchorStart(infra.id);
    const anchorEnd = this.anchorEnd(infra.id);

    const connectionsId = 'connections';

    const lines: string[] = [];
    lines.push(anchorStart);
    lines.push(`subgraph ${infra.id}[${infra.label}]`);
    lines.push(`${indent}${INSERT_MARKER_PREFIX}${infra.id}`);

    // Dedicated connections subgraph inside infrastructure
    lines.push(this.anchorStart(connectionsId));
    lines.push(`${indent}subgraph ${connectionsId}[*Connections*]`);
    lines.push(`${indent}${indent}${INSERT_MARKER_PREFIX}${connectionsId}`);
    lines.push(`${indent}end`);
    lines.push(this.anchorEnd(connectionsId));

    lines.push('end');
    lines.push(anchorEnd);

    // Root styling (uses mermaid-styles.yaml)
    const styleLine = this.renderRootStyle(theme, 'infrastructure', infra.id);
    if (styleLine) {
      lines.push(styleLine);
    }

    return lines.join(nl);
  }

  private renderRootSubgraph(rootKey: 'definitions' | 'infrastructure', indent: string, nl: string, theme: 'light' | 'dark'): string {
    const mapping = this.mappingService.get();
    const root = mapping.roots?.[rootKey]?.mermaid;
    if (!root) throw new Error(`Missing root mapping '${rootKey}'`);

    const anchorStart = this.anchorStart(root.id);
    const anchorEnd = this.anchorEnd(root.id);

    const lines: string[] = [];
    lines.push(anchorStart);
    lines.push(`subgraph ${root.id}[${root.label}]`);
    lines.push(`${indent}${INSERT_MARKER_PREFIX}${root.id}`);
    lines.push('end');
    lines.push(anchorEnd);

    const styleLine = this.renderRootStyle(theme, rootKey, root.id);
    if (styleLine) {
      lines.push(styleLine);
    }

    return lines.join(nl);
  }

  private renderFrontmatter(styles: any, diagramName: string): string {
    const fm = styles?.frontmatter;
    if (!fm) return '';

    const titleTpl = typeof fm.title === 'string' ? fm.title : '';
    const resolvedTitleRaw = titleTpl
      ? this.applyTemplate(titleTpl, { diagram: { name: diagramName } })
      : diagramName;
    const resolvedTitle = resolvedTitleRaw?.trim?.() ? resolvedTitleRaw.trim() : diagramName;

    const config = fm.config ?? {};

    const lines: string[] = [];
    lines.push('---');
    lines.push(`title: ${this.yamlScalar(resolvedTitle)}`);
    lines.push('config:');

    // Keep stable, human-friendly key ordering.
    if (config.theme !== undefined) {
      lines.push(`  theme: ${this.yamlScalar(config.theme)}`);
    }
    if (config.look !== undefined) {
      lines.push(`  look: ${this.yamlScalar(config.look)}`);
    }

    if (config.themeVariables && typeof config.themeVariables === 'object') {
      lines.push('  themeVariables:');
      for (const [k, v] of Object.entries(config.themeVariables)) {
        lines.push(`    ${k}: ${this.yamlScalar(v)}`);
      }
    }

    // Any other config keys (rare) are appended deterministically.
    const extraKeys = Object.keys(config)
      .filter((k) => k !== 'theme' && k !== 'look' && k !== 'themeVariables')
      .sort();
    for (const k of extraKeys) {
      const v = (config as any)[k];
      if (v === undefined) continue;
      lines.push(`  ${k}: ${this.yamlScalar(v)}`);
    }

    lines.push('---');
    return lines.join('\n');
  }

  private yamlScalar(value: unknown): string {
    if (value === null) return 'null';
    if (value === true) return 'true';
    if (value === false) return 'false';
    if (typeof value === 'number') return Number.isFinite(value) ? String(value) : 'null';
    const s = String(value);

    // Safe unquoted scalars for simple titles/values.
    if (/^[0-9a-zA-Z _.-]+$/.test(s) && !/^(null|true|false)$/i.test(s)) {
      return s;
    }

    // Quote everything else.
    return JSON.stringify(s);
  }

  private renderRootStyle(theme: string, rootKey: string, mermaidId: string): string | null {
    const styles = this.stylesService.get();
    const style = styles.themes?.[theme]?.roots?.[rootKey]?.style;
    if (!style) return null;

    const parts: string[] = [];
    for (const [k, v] of Object.entries(style)) {
      const mappedKey = k;
      parts.push(`${mappedKey}:${v}`);
    }

    return parts.length ? `style ${mermaidId} ${parts.join(',')}` : null;
  }

  private resolveEntityStyle(theme: 'light' | 'dark', entity: string, object: Record<string, any>): Record<string, string> {
    const styles = this.stylesService.get();
    const t = styles.themes?.[theme];
    const base = (t?.entities?.[entity]?.style ?? {}) as Record<string, string>;

    // Optional: status style overlay (e.g. Active/Planned) based on the object's status field.
    const status = typeof object.status === 'string' ? object.status : null;
    const statusStyle = status ? ((t?.statuses?.[status]?.style ?? {}) as Record<string, string>) : {};

    return { ...base, ...statusStyle };
  }

  private resolveAttributeStyle(theme: 'light' | 'dark', entity: string): Record<string, string> {
    const styles = this.stylesService.get();
    const t = styles.themes?.[theme];

    // Global attribute style (themes.*.entities.attribute.style)
    const global = (t?.entities?.attribute?.style ?? {}) as Record<string, string>;

    // Per-entity attribute overrides (themes.*.entities.<entity>.attributes)
    const perEntity = (t?.entities?.[entity]?.attributes ?? {}) as Record<string, string>;

    return { ...global, ...perEntity };
  }

  private renderStyleLine(mermaidId: string, style: Record<string, string> | undefined | null): string | null {
    if (!style) return null;
    const entries = Object.entries(style).filter(([, v]) => v !== undefined && v !== null && String(v).length);
    if (!entries.length) return null;

    const parts: string[] = [];
    for (const [k, v] of entries) {
      parts.push(`${k}:${v}`);
    }
    return parts.length ? `style ${mermaidId} ${parts.join(',')}` : null;
  }

  private applyTemplate(template: string, ctx: Record<string, any>): string {
    return template.replace(/\{\{\s*([^}]+)\s*\}\}/g, (_m, expr) => {
      const parts = String(expr).trim().split('.');
      let cur: any = ctx;
      for (const p of parts) {
        cur = cur?.[p];
      }
      return cur === undefined || cur === null ? '' : String(cur);
    });
  }

  private anchorStart(id: string): string {
    return `%% BEGIN ${id}`;
  }

  private indentBlock(block: string, indent: string, nl: string): string {
    return block
      .split(nl)
      .map((line) => (line.length ? `${indent}${line}` : line))
      .join(nl);
  }

  private anchorEnd(id: string): string {
    return `%% END ${id}`;
  }

  private escapeQuotes(s: string): string {
    return s.replace(/"/g, '\\"');
  }
}
