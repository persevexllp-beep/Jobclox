type LogLevel = 'debug' | 'info' | 'warn' | 'error';

type LogContext = Record<string, string | number | boolean | null | undefined>;

function serializeError(error: unknown): LogContext {
  if (error instanceof Error) {
    return {
      errorName: error.name,
      errorMessage: error.message,
      errorStack: process.env.NODE_ENV === 'production' ? undefined : error.stack,
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
