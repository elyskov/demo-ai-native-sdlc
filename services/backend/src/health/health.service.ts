import { Injectable } from '@nestjs/common';

type HealthResponse = {
  name: string;
  environment: string;
  nestVersion: string;
  nodeVersion: string;
};

@Injectable()
export class HealthService {
  getHealth(): HealthResponse {
    const environment =
      process.env.APP_ENV ?? process.env.NODE_ENV ?? 'development';

    const nestVersion = this.getNestVersion();

    return {
      name: process.env.APP_NAME ?? 'demo-ai-native-sdlc-backend',
      environment,
      nestVersion,
      nodeVersion: process.version,
    };
  }

  private getNestVersion(): string {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const pkg = require('@nestjs/core/package.json');
      return typeof pkg?.version === 'string' ? pkg.version : 'unknown';
    } catch {
      return 'unknown';
    }
  }
}
