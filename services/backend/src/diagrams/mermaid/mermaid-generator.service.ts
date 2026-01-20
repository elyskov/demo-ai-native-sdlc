import { Injectable } from '@nestjs/common';

import { MermaidStylesService } from '../../netbox-config/mermaid-styles.service';
import { NetboxToMermaidService } from '../../netbox-config/netbox-to-mermaid.service';

const INSERT_MARKER_PREFIX = '%% INSERT ';

@Injectable()
export class MermaidGeneratorService {
  constructor(
    private readonly mappingService: NetboxToMermaidService,
    private readonly stylesService: MermaidStylesService,
  ) {}

  initialDiagram(theme: 'light' | 'dark' = 'light'): string {
    const mapping = this.mappingService.get();
    const styles = this.stylesService.get();

    const indent = mapping.globals?.indentation ?? '  ';
    const nl = mapping.globals?.line_separator ?? '\n';

    const initLine = this.renderInitDirective(styles);

    const definitions = this.renderRootSubgraph('definitions', indent, nl, theme);
    const infrastructure = this.renderInfrastructureRoot(indent, nl, theme);

    return [initLine, 'flowchart TB', '', definitions, '', infrastructure, ''].join(nl);
  }

  renderEntityBlock(entity: string, object: { id: string; name?: string } & Record<string, any>): {
    mermaidId: string;
    block: string;
  } {
    const mapping = this.mappingService.get();
    const entityCfg = mapping.entities?.[entity];
    if (!entityCfg) {
      throw new Error(`No Mermaid mapping for entity '${entity}'`);
    }

    const indent = mapping.globals?.indentation ?? '  ';
    const nl = mapping.globals?.line_separator ?? '\n';

    const mermaidId = this.applyTemplate(entityCfg.mermaid.id, { object });
    const label = this.applyTemplate(entityCfg.mermaid.label, { object });

    const anchorStart = this.anchorStart(mermaidId);
    const anchorEnd = this.anchorEnd(mermaidId);

    if (entityCfg.mermaid.type === 'subgraph') {
      const lines: string[] = [];
      lines.push(anchorStart);
      lines.push(`subgraph ${mermaidId}[${label}]`);

      const attrs = entityCfg.attributes?.render ?? [];
      for (const field of attrs) {
        const value = object[field];
        if (value === undefined || value === null) continue;
        const attrId = `attr_${mermaidId}_${field}`.replace(/[^0-9a-zA-Z_]/g, '_');
        const attrLabel = `${field}: ${String(value)}`;
        lines.push(`${indent}${attrId}["${this.escapeQuotes(attrLabel)}"]:::attribute`);
      }

      lines.push(`${indent}${INSERT_MARKER_PREFIX}${mermaidId}`);
      lines.push('end');
      lines.push(anchorEnd);
      return { mermaidId, block: lines.join(nl) };
    }

    // Node (non-structural) support (minimal v1)
    const nodeLabel = this.escapeQuotes(label);
    const lines = [
      anchorStart,
      `${mermaidId}["${nodeLabel}"]`,
      anchorEnd,
    ];
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

  private renderInitDirective(styles: any): string {
    const config = styles?.frontmatter?.config;
    if (!config) return '';

    const init: any = {};
    if (config.theme) init.theme = config.theme;
    if (config.themeVariables) init.themeVariables = config.themeVariables;

    return `%%{init: ${JSON.stringify(init)} }%%`;
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

  private anchorEnd(id: string): string {
    return `%% END ${id}`;
  }

  private escapeQuotes(s: string): string {
    return s.replace(/"/g, '\\"');
  }
}
