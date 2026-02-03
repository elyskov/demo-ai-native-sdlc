import { Module } from '@nestjs/common';

import { ApiHealthController } from './health-api.controller';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';

@Module({
  controllers: [HealthController, ApiHealthController],
  providers: [HealthService],
})
export class HealthModule {}
