import type { NextFunction, Request, Response } from 'express';
import type { LoggerService } from '@nestjs/common';

export function requestLoggerMiddleware(logger: LoggerService) {
  return (req: Request, res: Response, next: NextFunction) => {
    const start = process.hrtime.bigint();

    res.on('finish', () => {
      const durationMs = Number(process.hrtime.bigint() - start) / 1_000_000;
      logger.log(
        `${req.method} ${req.originalUrl} -> ${res.statusCode} (${durationMs.toFixed(1)}ms)`,
      );
    });

    next();
  };
}
