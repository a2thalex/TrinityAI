/**
 * Logger utility for AI Code Generation Service
 * Provides structured logging with different levels and transports
 */

import winston from 'winston';
import path from 'path';

const logDir = process.env.LOG_DIR || path.join(process.cwd(), 'logs');

// Custom log format
const customFormat = winston.format.printf(({ timestamp, level, message, ...metadata }) => {
  let msg = `${timestamp} [${level.toUpperCase()}]: ${message}`;

  if (Object.keys(metadata).length > 0) {
    msg += ` ${JSON.stringify(metadata)}`;
  }

  return msg;
});

// Create the logger
export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.splat(),
    customFormat
  ),
  defaultMeta: { service: 'ai-codegen' },
  transports: [
    // Console transport
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        customFormat
      )
    })
  ]
});

// Add file transport in production
if (process.env.NODE_ENV === 'production') {
  logger.add(new winston.transports.File({
    filename: path.join(logDir, 'error.log'),
    level: 'error',
    maxsize: 5242880, // 5MB
    maxFiles: 5
  }));

  logger.add(new winston.transports.File({
    filename: path.join(logDir, 'combined.log'),
    maxsize: 5242880, // 5MB
    maxFiles: 5
  }));
}

// Add daily rotate file transport if needed
if (process.env.ENABLE_DAILY_LOGS === 'true') {
  const DailyRotateFile = require('winston-daily-rotate-file');

  logger.add(new DailyRotateFile({
    filename: path.join(logDir, 'application-%DATE%.log'),
    datePattern: 'YYYY-MM-DD',
    zippedArchive: true,
    maxSize: '20m',
    maxFiles: '14d'
  }));
}

// Stream for Morgan HTTP logger
export const stream = {
  write: (message: string) => {
    logger.info(message.trim());
  }
};

// Convenience methods for different contexts
export const loggers = {
  claudeSDK: logger.child({ context: 'claude-sdk' }),
  api: logger.child({ context: 'api' }),
  project: logger.child({ context: 'project' }),
  queue: logger.child({ context: 'queue' }),
  deployment: logger.child({ context: 'deployment' })
};

export default logger;