import { Module } from '@nestjs/common';

import { CsvModule } from './csv/csv.module';
import { DiagramsModule } from './diagrams/diagrams.module';
import { HealthModule } from './health/health.module';
import { NetboxConfigModule } from './netbox-config/netbox-config.module';

@Module({
  imports: [NetboxConfigModule, HealthModule, DiagramsModule, CsvModule],
})
export class AppModule {}
