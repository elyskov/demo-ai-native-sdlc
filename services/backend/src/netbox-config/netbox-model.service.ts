import { Injectable } from '@nestjs/common';

import type { NetboxModelConfig } from './netbox-config.models';
import { NetboxConfigService } from './netbox-config.service';

@Injectable()
export class NetboxModelService {
  constructor(private readonly config: NetboxConfigService) {}

  get(): NetboxModelConfig {
    return this.config.getModel();
  }
}
