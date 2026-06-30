import { format, transports } from 'winston';
import * as winston from 'winston';

const logFormat = format.printf(
  ({ timestamp, level, message, context, ...meta }) => {
    const contextStr = context ? ` [${context}]` : '';
    const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
    return `[${timestamp}] ${level.toUpperCase()}${contextStr}: ${message}${metaStr}`;
  },
);

export const winstonConfig = {
  transports: [
    new transports.Console({
      level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
      format: format.combine(
        format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        format.colorize(),
        logFormat,
      ),
    }),
    new transports.File({
      filename: 'logs/error.log',
      level: 'error',
      format: format.combine(
        format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        format.json(),
      ),
    }),
    new transports.File({
      filename: 'logs/combined.log',
      format: format.combine(
        format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        format.json(),
      ),
    }),
  ],
};
