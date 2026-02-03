import { Controller, Get } from '@nestjs/common';

import { HealthService } from './health.service';

@Controller('api/health')
export class ApiHealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  getHealth() {
    return this.healthService.getHealth();
  }
}
