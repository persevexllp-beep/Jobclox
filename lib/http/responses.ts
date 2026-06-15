import { NextResponse } from 'next/server';
import { getErrorMessage, toHttpError } from './errors';

export function jsonOk<T>(data: T, init?: ResponseInit) {
  return NextResponse.json(data, { status: 200, ...init });
}

export function jsonCreated<T>(data: T, init?: ResponseInit) {
  return NextResponse.json(data, { status: 201, ...init });
}

export function jsonNoContent(init?: ResponseInit) {
  return new NextResponse(null, { status: 204, ...init });
}

export function jsonError(status: number, message: string, extra?: Record<string, unknown>) {
  return NextResponse.json(
    {
      error: message,
      ...(extra || {}),
    },
    { status }
  );
}

export function errorToResponse(error: unknown, fallbackStatusCode = 500, fallbackMessage = 'Internal server error') {
  const httpError = toHttpError(error, fallbackStatusCode, fallbackMessage);
  const payload: Record<string, unknown> = {
    error: httpError.message || getErrorMessage(error),
  };

  if (httpError.code) payload.code = httpError.code;
  if (httpError.details !== undefined) payload.details = httpError.details;

  return NextResponse.json(payload, { status: httpError.statusCode });
}
