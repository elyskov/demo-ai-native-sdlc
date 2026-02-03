import { Module } from '@nestjs/common';

import { MermaidStylesService } from './mermaid-styles.service';
import { NetboxConfigService } from './netbox-config.service';
import { NetboxModelService } from './netbox-model.service';
import { NetboxModelAnalysisService } from './netbox-model-analysis.service';
import { NetboxToMermaidService } from './netbox-to-mermaid.service';

@Module({
  providers: [
    NetboxConfigService,
    NetboxModelService,
    NetboxToMermaidService,
    MermaidStylesService,
    NetboxModelAnalysisService,
  ],
  exports: [NetboxModelService, NetboxToMermaidService, MermaidStylesService, NetboxModelAnalysisService],
})
export class NetboxConfigModule {}
