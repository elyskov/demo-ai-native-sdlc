import { Module } from '@nestjs/common';

import { NetboxConfigModule } from '../netbox-config/netbox-config.module';

import { DiagramsController } from './diagrams.controller';
import { DiagramsCommandsController } from './commands/diagrams-commands.controller';
import { DiagramDomainStore } from './commands/diagram-domain.store';
import { DiagramsCommandsService } from './commands/diagrams-commands.service';
import { DiagramsService } from './diagrams.service';
import { MermaidGeneratorService } from './mermaid/mermaid-generator.service';

@Module({
  imports: [NetboxConfigModule],
  controllers: [DiagramsController, DiagramsCommandsController],
  providers: [DiagramsService, MermaidGeneratorService, DiagramDomainStore, DiagramsCommandsService],
  exports: [DiagramsService, DiagramDomainStore],
})
export class DiagramsModule {}
