/**
 * Error Handler Middleware
 * Centralized error handling for the AI Code Generation Service
 */

import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';
import { ZodError } from 'zod';

export interface ApiError extends Error {
  statusCode?: number;
  details?: any;
  code?: string;
}

/**
 * Custom error class for API errors
 */
export class AppError extends Error implements ApiError {
  statusCode: number;
  details?: any;
  code?: string;
  isOperational: boolean;

  constructor(
    message: string,
    statusCode: number = 500,
    code?: string,
    details?: any
  ) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Async error wrapper for route handlers
 */
export const asyncHandler = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

/**
 * Format Zod validation errors
 */
function formatZodError(error: ZodError): any {
  return {
    message: 'Validation failed',
    errors: error.errors.map(err => ({
      field: err.path.join('.'),
      message: err.message,
      code: err.code
    }))
  };
}

/**
 * Main error handler middleware
 */
export const errorHandler = (
  err: ApiError,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // Default to 500 server error
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Internal Server Error';
  let details = err.details;
  let code = err.code;

  // Handle specific error types
  if (err instanceof ZodError) {
    statusCode = 400;
    const formatted = formatZodError(err);
    message = formatted.message;
    details = formatted.errors;
    code = 'VALIDATION_ERROR';
  } else if (err.name === 'ValidationError') {
    statusCode = 400;
    message = 'Validation Error';
    code = 'VALIDATION_ERROR';
  } else if (err.name === 'CastError') {
    statusCode = 400;
    message = 'Invalid ID format';
    code = 'INVALID_ID';
  } else if (err.name === 'UnauthorizedError') {
    statusCode = 401;
    message = 'Unauthorized';
    code = 'UNAUTHORIZED';
  } else if (err.message?.includes('ENOENT')) {
    statusCode = 404;
    message = 'Resource not found';
    code = 'NOT_FOUND';
  } else if (err.message?.includes('EACCES')) {
    statusCode = 403;
    message = 'Permission denied';
    code = 'PERMISSION_DENIED';
  }

  // Log error details
  if (statusCode >= 500) {
    logger.error('Server error:', {
      error: err.message,
      stack: err.stack,
      statusCode,
      method: req.method,
      path: req.path,
      body: req.body,
      query: req.query,
      headers: req.headers
    });
  } else {
    logger.warn('Client error:', {
      error: err.message,
      statusCode,
      method: req.method,
      path: req.path,
      body: req.body,
      query: req.query
    });
  }

  // Send error response
  const response: any = {
    success: false,
    error: {
      message,
      code: code || 'ERROR'
    }
  };

  // Include details in development
  if (process.env.NODE_ENV === 'development') {
    response.error.details = details;
    response.error.stack = err.stack;
  } else if (details && statusCode < 500) {
    // Include safe details for client errors in production
    response.error.details = details;
  }

  res.status(statusCode).json(response);
};

/**
 * 404 handler for undefined routes
 */
export const notFoundHandler = (req: Request, res: Response, next: NextFunction) => {
  const error = new AppError(
    `Route ${req.originalUrl} not found`,
    404,
    'ROUTE_NOT_FOUND'
  );
  next(error);
};

/**
 * Validation error factory
 */
export const validationError = (message: string, details?: any): AppError => {
  return new AppError(message, 400, 'VALIDATION_ERROR', details);
};

/**
 * Authentication error factory
 */
export const authError = (message: string = 'Authentication required'): AppError => {
  return new AppError(message, 401, 'AUTH_ERROR');
};

/**
 * Authorization error factory
 */
export const forbiddenError = (message: string = 'Access denied'): AppError => {
  return new AppError(message, 403, 'FORBIDDEN');
};

/**
 * Not found error factory
 */
export const notFoundError = (resource: string = 'Resource'): AppError => {
  return new AppError(`${resource} not found`, 404, 'NOT_FOUND');
};

/**
 * Conflict error factory
 */
export const conflictError = (message: string): AppError => {
  return new AppError(message, 409, 'CONFLICT');
};

/**
 * Rate limit error factory
 */
export const rateLimitError = (message: string = 'Too many requests'): AppError => {
  return new AppError(message, 429, 'RATE_LIMIT');
};

/**
 * Server error factory
 */
export const serverError = (message: string = 'Internal server error'): AppError => {
  return new AppError(message, 500, 'SERVER_ERROR');
};

/**
 * Service unavailable error factory
 */
export const serviceUnavailableError = (message: string = 'Service temporarily unavailable'): AppError => {
  return new AppError(message, 503, 'SERVICE_UNAVAILABLE');
};

/**
 * Handle unhandled promise rejections
 */
process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
  logger.error('Unhandled Promise Rejection:', {
    reason: reason?.message || reason,
    stack: reason?.stack,
    promise
  });

  // In production, you might want to gracefully shut down
  if (process.env.NODE_ENV === 'production') {
    logger.error('Shutting down due to unhandled promise rejection...');
    process.exit(1);
  }
});

/**
 * Handle uncaught exceptions
 */
process.on('uncaughtException', (error: Error) => {
  logger.error('Uncaught Exception:', {
    error: error.message,
    stack: error.stack
  });

  // Gracefully shut down
  logger.error('Shutting down due to uncaught exception...');
  process.exit(1);
});

export default errorHandler;