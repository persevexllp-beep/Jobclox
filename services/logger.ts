type LogLevel = 'debug' | 'info' | 'warn' | 'error';

type LogValue = string | number | boolean | null | undefined | string[] | Record<string, unknown> | Record<string, unknown>[];
type LogContext = Record<string, LogValue>;

function serializeError(error: unknown): LogContext {
  if (error instanceof Error) {
    return {
      errorName: error.name,
      errorMessage: error.message,
      errorStack: process.env.NODE_ENV === 'production' ? undefined : error.stack,
    };
  }
  if (typeof error === 'object' && error !== null) {
    const details = error as Record<string, unknown>;
    return {
      errorMessage: typeof details.message === 'string' ? details.message : JSON.stringify(details),
      errorCode: typeof details.code === 'string' ? details.code : undefined,
      errorDetails: typeof details.details === 'string' ? details.details : undefined,
      errorHint: typeof details.hint === 'string' ? details.hint : undefined,
    };
  }
  return { errorMessage: String(error) };
}

function write(level: LogLevel, service: string, message: string, context: LogContext = {}) {
  const payload = {
    ts: new Date().toISOString(),
    level,
    service,
    message,
    ...context,
  };
  const line = JSON.stringify(payload);
  if (level === 'error') {
    console.error(line);
  } else if (level === 'warn') {
    console.warn(line);
  } else {
    console.log(line);
  }
}

export const logger = {
  debug: (service: string, message: string, context?: LogContext) => {
    if (process.env.LOG_LEVEL === 'debug') write('debug', service, message, context);
  },
  info: (service: string, message: string, context?: LogContext) => write('info', service, message, context),
  warn: (service: string, message: string, context?: LogContext) => write('warn', service, message, context),
  error: (service: string, message: string, error?: unknown, context: LogContext = {}) =>
    write('error', service, message, { ...context, ...serializeError(error) }),
};
