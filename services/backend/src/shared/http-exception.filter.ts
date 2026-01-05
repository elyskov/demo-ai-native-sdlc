import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  LoggerService,
} from '@nestjs/common';
import type { Request, Response } from 'express';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  constructor(private readonly logger: LoggerService) {}

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let errorResponse: unknown = { message: 'Internal Server Error' };

    const exceptionAny = exception as any;
    const isHttpExceptionLike =
      exception instanceof HttpException ||
      (exceptionAny &&
        typeof exceptionAny.getStatus === 'function' &&
        typeof exceptionAny.getResponse === 'function');

    if (isHttpExceptionLike) {
      status = Number(exceptionAny.getStatus());
      errorResponse = exceptionAny.getResponse();
    }

    const message =
      typeof errorResponse === 'string'
        ? errorResponse
        : (errorResponse as any)?.message ?? 'Error';

    if (status >= 500) {
      this.logger.error(
        `${request.method} ${request.url} -> ${status} (${String(message)})`,
        (exception as any)?.stack,
      );
    } else {
      this.logger.warn(
        `${request.method} ${request.url} -> ${status} (${String(message)})`,
      );
    }

    response.status(status).json({
      statusCode: status,
      path: request.url,
      method: request.method,
      timestamp: new Date().toISOString(),
      message,
    });
  }
}
