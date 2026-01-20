import { Injectable } from '@nestjs/common';

import type { MermaidStylesConfig } from './netbox-config.models';
import { NetboxConfigService } from './netbox-config.service';

@Injectable()
export class MermaidStylesService {
  constructor(private readonly config: NetboxConfigService) {}

  get(): MermaidStylesConfig {
    return this.config.getStyles();
  }
}
