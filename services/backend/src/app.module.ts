import { Module } from '@nestjs/common';

import { DiagramsModule } from './diagrams/diagrams.module';
import { HealthModule } from './health/health.module';

@Module({
  imports: [HealthModule, DiagramsModule],
})
export class AppModule {}
