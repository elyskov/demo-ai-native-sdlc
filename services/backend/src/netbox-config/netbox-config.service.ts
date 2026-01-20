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

    const [modelRaw, mappingRaw, stylesRaw] = await Promise.all([
      fs.readFile(modelPath, 'utf8'),
      fs.readFile(mappingPath, 'utf8'),
      fs.readFile(stylesPath, 'utf8'),
    ]);

    const model = yaml.load(modelRaw) as NetboxModelConfig;
    const mapping = yaml.load(mappingRaw) as NetboxToMermaidConfig;
    const styles = yaml.load(stylesRaw) as MermaidStylesConfig;

    if (!model?.entities || !mapping?.entities || !mapping?.roots) {
      throw new Error('Invalid NetBox YAML config (missing required sections)');
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
}
