import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';

@Catch()
export class FileUploadExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(FileUploadExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();
      message =
        typeof exceptionResponse === 'string'
          ? exceptionResponse
          : (exceptionResponse as { message?: string }).message ||
            'Bad request';
    } else if (exception instanceof Error) {
      // Handle Multer errors specifically
      if (exception.message.includes('File too large')) {
        status = HttpStatus.BAD_REQUEST;
        message = 'File size exceeds the maximum allowed limit';
      } else if (exception.message.includes('Unexpected field')) {
        status = HttpStatus.BAD_REQUEST;
        message = 'Invalid file field name';
      } else if (exception.message.includes('Too many files')) {
        status = HttpStatus.BAD_REQUEST;
        message = 'Too many files uploaded';
      } else {
        message = exception.message;
      }
    }

    this.logger.error(
      `File upload error: ${message}`,
      exception instanceof Error ? exception.stack : '',
    );

    response.status(status).json({
      success: false,
      error: {
        statusCode: status,
        message,
        timestamp: new Date().toISOString(),
      },
    });
  }
}
