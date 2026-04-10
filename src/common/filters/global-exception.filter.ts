import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response, Request } from 'express';

interface ErrorBody {
  success: false;
  error: string;
  message: string | string[];
  statusCode: number;
  timestamp: string;
  path: string;
  requestId: string;
}

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request & { id?: string }>();

    let statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
    let error = 'INTERNAL_SERVER_ERROR';
    let message: string | string[] = 'An unexpected error occurred';

    if (exception instanceof HttpException) {
      statusCode = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
        const body = exceptionResponse as Record<string, unknown>;
        error = (body['error'] as string) ?? exception.name;
        message = (body['message'] as string | string[]) ?? exception.message;
      } else {
        error = exception.name;
        message = exception.message;
      }
    } else if (exception instanceof Error) {
      this.logger.error({ err: exception }, 'Unhandled exception');
    }

    const errorBody: ErrorBody = {
      success: false,
      error,
      message,
      statusCode,
      timestamp: new Date().toISOString(),
      path: request.url,
      requestId: request.id ?? 'unknown',
    };

    response.status(statusCode).json(errorBody);
  }
}
