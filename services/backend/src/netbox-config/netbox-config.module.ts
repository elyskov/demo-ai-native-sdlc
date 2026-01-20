import { Module } from '@nestjs/common';

import { MermaidStylesService } from './mermaid-styles.service';
import { NetboxConfigService } from './netbox-config.service';
import { NetboxModelService } from './netbox-model.service';
import { NetboxToMermaidService } from './netbox-to-mermaid.service';

@Module({
  providers: [
    NetboxConfigService,
    NetboxModelService,
    NetboxToMermaidService,
    MermaidStylesService,
  ],
  exports: [NetboxModelService, NetboxToMermaidService, MermaidStylesService],
})
export class NetboxConfigModule {}
