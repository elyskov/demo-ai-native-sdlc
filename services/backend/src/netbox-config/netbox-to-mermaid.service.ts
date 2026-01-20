import { Injectable } from '@nestjs/common';

import type { NetboxToMermaidConfig } from './netbox-config.models';
import { NetboxConfigService } from './netbox-config.service';

@Injectable()
export class NetboxToMermaidService {
  constructor(private readonly config: NetboxConfigService) {}

  get(): NetboxToMermaidConfig {
    return this.config.getMapping();
  }
}
