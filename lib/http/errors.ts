export type HttpErrorOptions = {
  cause?: unknown;
  code?: string;
  details?: unknown;
};

export class HttpError extends Error {
  statusCode: number;
  code?: string;
  details?: unknown;

  constructor(statusCode: number, message: string, options: HttpErrorOptions = {}) {
    super(message);
    this.name = 'HttpError';
    this.statusCode = statusCode;
    this.code = options.code;
    this.details = options.details;
    if (options.cause !== undefined) {
      (this as Error & { cause?: unknown }).cause = options.cause;
    }
  }
}

export function createHttpError(statusCode: number, message: string, options?: HttpErrorOptions): HttpError {
  return new HttpError(statusCode, message, options);
}

export function isHttpError(error: unknown): error is HttpError {
  return error instanceof HttpError;
}

export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

export function toHttpError(error: unknown, fallbackStatusCode = 500, fallbackMessage = 'Internal server error'): HttpError {
  if (isHttpError(error)) {
    return error;
  }

  return new HttpError(fallbackStatusCode, error instanceof Error ? error.message : fallbackMessage, {
    cause: error,
  });
}
