import 'reflect-metadata';
import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

import { AppModule } from './app.module';
import { HttpExceptionFilter } from './shared/http-exception.filter';
import { requestLoggerMiddleware } from './shared/request-logger.middleware';

async function bootstrap() {
  const appName = process.env.APP_NAME ?? 'demo-ai-native-sdlc-backend';
  const logger = new Logger(appName);

  const app = await NestFactory.create(AppModule, {
    logger,
  });

  app.use(requestLoggerMiddleware(logger));

  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidUnknownValues: true,
    }),
  );

  app.useGlobalFilters(new HttpExceptionFilter(logger));

  const swaggerConfig = new DocumentBuilder()
    .setTitle('demo-ai-native-sdlc backend')
    .setDescription('Backend API for managing Mermaid diagrams')
    .setVersion('0.1')
    .build();
  const swaggerDoc = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, swaggerDoc);

  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port, '0.0.0.0');

  logger.log(`Listening on http://0.0.0.0:${port}`);
}

bootstrap().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('Fatal bootstrap error', err);
  process.exitCode = 1;
});
