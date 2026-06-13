import crypto from 'crypto';
import { promisify } from 'util';
import { User } from '../src/types';
import { supabaseAdmin } from '../lib/supabase';
import { getUserById } from './userService';

const scryptAsync = promisify(crypto.scrypt);
const SESSION_TTL_MS = 1000 * 60 * 60 * 12;
const TOKEN_VERSION = 1;

type SessionPayload = {
  v: typeof TOKEN_VERSION;
  sub: string;
  iat: number;
  exp: number;
};

type PasswordRow = {
  password_hash: string | null;
};

function requireSupabaseAdmin() {
  if (!supabaseAdmin) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is required for production authentication');
  }
  return supabaseAdmin;
}

function getSessionSecret(): string {
  const secret = process.env.AUTH_SECRET || process.env.AUTH_SESSION_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) {
    throw new Error('AUTH_SECRET, AUTH_SESSION_SECRET, or SUPABASE_SERVICE_ROLE_KEY is required for session signing');
  }
  return secret;
}

function toBase64Url(input: Buffer | string): string {
  return Buffer.from(input).toString('base64url');
}

function fromBase64Url(input: string): string {
  return Buffer.from(input, 'base64url').toString('utf8');
}

function sign(value: string): string {
  return crypto.createHmac('sha256', getSessionSecret()).update(value).digest('base64url');
}

function timingSafeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

export function validatePasswordStrength(password: string): string | null {
  if (password.length < 8) {
    return 'Password must be at least 8 characters long';
  }
  return null;
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.randomBytes(16).toString('base64url');
  const derivedKey = (await scryptAsync(password, salt, 64)) as Buffer;
  return `scrypt:${salt}:${derivedKey.toString('base64url')}`;
}

export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  const [algorithm, salt, expected] = storedHash.split(':');
  if (algorithm !== 'scrypt' || !salt || !expected) {
    return false;
  }

  const derivedKey = (await scryptAsync(password, salt, 64)) as Buffer;
  return timingSafeEqual(derivedKey.toString('base64url'), expected);
}

export async function getPasswordHashForUser(userId: string): Promise<string | null> {
  const { data, error } = await requireSupabaseAdmin()
    .from('users')
    .select('password_hash')
    .eq('id', userId)
    .maybeSingle<PasswordRow>();

  if (error) {
    throw new Error(`Password storage is not configured: ${error.message}`);
  }

  return data?.password_hash || null;
}

export async function setPasswordHashForUser(userId: string, passwordHash: string): Promise<void> {
  const { error } = await requireSupabaseAdmin()
    .from('users')
    .update({ password_hash: passwordHash })
    .eq('id', userId);

  if (error) {
    throw new Error(`Password storage is not configured: ${error.message}`);
  }
}

export function createSessionToken(user: User): string {
  const now = Date.now();
  const payload: SessionPayload = {
    v: TOKEN_VERSION,
    sub: user.id,
    iat: now,
    exp: now + SESSION_TTL_MS,
  };
  const encodedPayload = toBase64Url(JSON.stringify(payload));
  return `${encodedPayload}.${sign(encodedPayload)}`;
}

export async function validateSessionToken(token: string): Promise<User | null> {
  const [encodedPayload, signature] = token.split('.');
  if (!encodedPayload || !signature || !timingSafeEqual(sign(encodedPayload), signature)) {
    return null;
  }

  let payload: SessionPayload;
  try {
    payload = JSON.parse(fromBase64Url(encodedPayload)) as SessionPayload;
  } catch {
    return null;
  }

  if (payload.v !== TOKEN_VERSION || !payload.sub || Date.now() > payload.exp) {
    return null;
  }

  const user = await getUserById(payload.sub);
  if (!user || user.status !== 'active') {
    return null;
  }

  return user;
}

export function getBearerToken(headerValue: unknown): string | null {
  if (typeof headerValue !== 'string') {
    return null;
  }

  const [scheme, token] = headerValue.split(' ');
  if (scheme !== 'Bearer' || !token) {
    return null;
  }

  return token;
}
