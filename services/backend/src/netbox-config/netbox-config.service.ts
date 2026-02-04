import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import * as yaml from 'js-yaml';

import type {
  LoadedNetboxConfig,
  MermaidStylesConfig,
  NetboxModelConfig,
  NetboxToMermaidConfig,
} from './netbox-config.models';

@Injectable()
export class NetboxConfigService implements OnModuleInit {
  private readonly logger = new Logger(NetboxConfigService.name);

  private loaded?: LoadedNetboxConfig;

  async onModuleInit() {
    const configDir =
      process.env.NETBOX_CONFIG_DIR ?? path.join(process.cwd(), 'config');

    const modelPath = path.join(configDir, 'netbox-model.yaml');
    const mappingPath = path.join(configDir, 'netbox-to-mermaid.yaml');
    const stylesPath = path.join(configDir, 'mermaid-styles.yaml');

    this.logger.log(`Loading NetBox YAML config from ${configDir}`);
    this.logger.log(
      `NetBox config files: model=${modelPath}, mapping=${mappingPath}, styles=${stylesPath} (optional)`,
    );

    const [modelRaw, mappingRaw, stylesRaw] = await Promise.all([
      this.readTextFile(modelPath, { required: true }),
      this.readTextFile(mappingPath, { required: true }),
      this.readTextFile(stylesPath, { required: false }),
    ]);

    const model = this.parseYaml<NetboxModelConfig>(modelRaw, modelPath);
    const mapping = this.parseYaml<NetboxToMermaidConfig>(mappingRaw, mappingPath);
    const styles = stylesRaw
      ? this.parseYaml<MermaidStylesConfig>(stylesRaw, stylesPath)
      : this.defaultStylesConfig();

    this.validateModelConfig(model, modelPath);
    this.validateMappingConfig(mapping, mappingPath);

    if (stylesRaw) {
      this.validateStylesConfig(styles, stylesPath);
    } else {
      this.logger.warn(`Mermaid styles config not found at ${stylesPath}; continuing without styles`);
    }

    this.loaded = { model, mapping, styles };

    this.logger.log(
      `Loaded NetBox config: ${Object.keys(model.entities).length} entities, ${Object.keys(mapping.roots).length} roots`,
    );
  }

  getModel(): NetboxModelConfig {
    if (!this.loaded) throw new Error('NetboxConfigService not initialized');
    return this.loaded.model;
  }

  getMapping(): NetboxToMermaidConfig {
    if (!this.loaded) throw new Error('NetboxConfigService not initialized');
    return this.loaded.mapping;
  }

  getStyles(): MermaidStylesConfig {
    if (!this.loaded) throw new Error('NetboxConfigService not initialized');
    return this.loaded.styles;
  }

  private async readTextFile(filePath: string, opts: { required: true }): Promise<string>;
  private async readTextFile(filePath: string, opts: { required: false }): Promise<string | null>;
  private async readTextFile(
    filePath: string,
    opts: { required: boolean },
  ): Promise<string | null> {
    try {
      return await fs.readFile(filePath, 'utf8');
    } catch (err) {
      const code = (err as any)?.code;
      if (!opts.required && code === 'ENOENT') {
        return null;
      }
      const detail = code ? ` (${code})` : '';
      throw new Error(`Failed to read NetBox config file at ${filePath}${detail}`);
    }
  }

  private parseYaml<T>(raw: string, filePath: string): T {
    try {
      return yaml.load(raw) as T;
    } catch (err) {
      const msg = (err as any)?.message ? String((err as any).message) : String(err);
      throw new Error(`Failed to parse YAML in ${filePath}: ${msg}`);
    }
  }

  private isRecord(value: unknown): value is Record<string, any> {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
  }

  private validateModelConfig(model: NetboxModelConfig, filePath: string) {
    if (!this.isRecord(model)) {
      throw new Error(`Invalid NetBox model config: expected a YAML object in ${filePath}`);
    }
    if (!this.isRecord((model as any).entities)) {
      throw new Error(
        `Invalid NetBox model config: missing required section 'entities' in ${filePath}`,
      );
    }
  }

  private validateMappingConfig(mapping: NetboxToMermaidConfig, filePath: string) {
    if (!this.isRecord(mapping)) {
      throw new Error(`Invalid NetBox mapping config: expected a YAML object in ${filePath}`);
    }
    if (!this.isRecord((mapping as any).entities)) {
      throw new Error(
        `Invalid NetBox mapping config: missing required section 'entities' in ${filePath}`,
      );
    }
    if (!this.isRecord((mapping as any).roots)) {
      throw new Error(
        `Invalid NetBox mapping config: missing required section 'roots' in ${filePath}`,
      );
    }
  }

  private validateStylesConfig(styles: MermaidStylesConfig, filePath: string) {
    if (!this.isRecord(styles)) {
      throw new Error(`Invalid Mermaid styles config: expected a YAML object in ${filePath}`);
    }

    // Styles are optional, but if present they should at least look like a config object.
    if ((styles as any).version === undefined || (styles as any).kind === undefined) {
      throw new Error(
        `Invalid Mermaid styles config: expected 'version' and 'kind' in ${filePath}`,
      );
    }

    if ((styles as any).themes !== undefined && !this.isRecord((styles as any).themes)) {
      throw new Error(
        `Invalid Mermaid styles config: 'themes' must be an object when present (${filePath})`,
      );
    }
  }

  private defaultStylesConfig(): MermaidStylesConfig {
    return {
      version: 1,
      kind: 'mermaid-styles',
      themes: {},
    };
  }
}
