const envApiBase = import.meta.env.VITE_API_URL?.trim();

function getLocalDevApiBase(): string {
  if (typeof window === 'undefined') {
    return 'http://localhost:3000';
  }

  const { protocol, hostname } = window.location;
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return `${protocol}//${hostname}:3000`;
  }

  return window.location.origin;
}

export const API_BASE_URL = (envApiBase || getLocalDevApiBase()).replace(/\/+$/, '');

export function resolveApiUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) {
    return path;
  }
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${API_BASE_URL}${normalizedPath}`;
}
