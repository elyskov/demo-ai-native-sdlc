import { Module } from '@nestjs/common';

import { CsvModule } from './csv/csv.module';
import { DiagramsModule } from './diagrams/diagrams.module';
import { HealthModule } from './health/health.module';

@Module({
  imports: [HealthModule, DiagramsModule, CsvModule],
})
export class AppModule {}
