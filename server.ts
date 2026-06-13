/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import "dotenv/config";
import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { User, Company, Job, Application, CandidateProfile, AppNotification, ApplicationStatus } from "./src/types";
import { GoogleGenAI } from "@google/genai";
import { supabaseAdmin } from "./lib/supabase";
import { createUser, getAllUsers, getUserByEmail } from "./services/userService";
import {
  createCompany,
  getAllCompanies,
  getCompanyById,
  getCompanyByUserId,
  updateCompany,
  updateVerificationStatus,
} from "./services/companyService";
import {
  createProfile,
  getProfileById,
  getProfileByUserId,
  updateProfile,
} from "./services/candidateProfileService";
import {
  createJob,
  deleteJob,
  getAllJobs,
  getJobById,
  getJobsByCompanyId,
  getJobsByStatus,
  getPersevexInternalCompanyId,
  incrementViewCount,
  updateJob,
  updateJobStatus,
} from "./services/jobService";
import {
  createNotification,
  getNotificationById,
  getNotificationsByUser,
  getUnreadCount,
  markAsRead,
} from "./services/notificationService";
import {
  getEmailLogById,
  getEmailLogs,
} from "./services/emailLogService";
import {
  emailTemplates,
  emitCommunicationEvent,
  retryEmailLog,
} from "./services/communicationService";
import {
  createApplication,
  deleteApplicationsByCandidateAndJob,
  getAllApplications,
  getApplicationById,
  getApplicationsByCandidate,
  getApplicationsByCompany,
  updateApplicationNotes,
  updateApplicationStatus,
} from "./services/applicationService";
import {
  createSessionToken,
  getBearerToken,
  getPasswordHashForUser,
  hashPassword,
  setPasswordHashForUser,
  validatePasswordStrength,
  validateSessionToken,
  verifyPassword,
} from "./services/authService";
import { runResumeIntelligencePipeline } from "./services/resumeIntelligenceService";
import { validateStartupEnvironment } from "./services/configService";
import { logger } from "./services/logger";

const PORT = 3000;
const HOST = process.env.NODE_ENV === "production" ? "0.0.0.0" : "127.0.0.1";
const STARTED_AT = Date.now();

type RateLimitBucket = {
  count: number;
  resetAt: number;
};

const rateLimitBuckets = new Map<string, RateLimitBucket>();

function getClientIp(req: express.Request): string {
  const forwardedFor = req.header("x-forwarded-for")?.split(",")[0]?.trim();
  return forwardedFor || req.socket.remoteAddress || "unknown";
}

function rateLimit(options: { windowMs: number; max: number; keyPrefix: string }) {
  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const now = Date.now();
    const key = `${options.keyPrefix}:${getClientIp(req)}`;
    const current = rateLimitBuckets.get(key);
    if (!current || current.resetAt <= now) {
      rateLimitBuckets.set(key, { count: 1, resetAt: now + options.windowMs });
      return next();
    }
    current.count += 1;
    if (current.count > options.max) {
      res.setHeader("Retry-After", Math.ceil((current.resetAt - now) / 1000));
      logger.warn("rate-limit", "request rejected", {
        requestId: String(res.locals.requestId || ''),
        path: req.path,
        ip: getClientIp(req),
      });
      return res.status(429).json({ error: "Too many requests. Please retry later." });
    }
    next();
  };
}

async function triggerEmailAlert(
  recipientEmail: string,
  recipientName: string,
  subject: string,
  bodyHtml: string,
  triggeredEvent: string
) {
  const result = await emitCommunicationEvent({
    eventType: "APPLICATION_REVIEWED",
    emails: [{ recipientEmail, recipientName, subject, html: bodyHtml }],
    metadata: { legacyTrigger: triggeredEvent },
  });

  logger.info("email", "legacy email alert emitted", {
    recipientEmail,
    recipientName,
    subject,
    triggeredEvent,
    status: result.emails[0]?.status || "not_logged",
  });

  return result.emails[0] || null;
}

let aiClient: GoogleGenAI | null = null;
type GeminiKeyStatus = "missing" | "suspicious" | "configured";

function getGeminiApiKeyStatus(): GeminiKeyStatus {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) return "missing";
  return /^AIza[0-9A-Za-z_-]{20,}$/.test(apiKey) ? "configured" : "suspicious";
}

function isGeminiAuthError(err: unknown): boolean {
  const text = err instanceof Error ? `${err.name} ${err.message}` : String(err);
  return /API_KEY_INVALID|API key not valid|invalid api key|permission_denied|unauthenticated/i.test(text);
}

function isGeminiQuotaError(err: unknown): boolean {
  const text = err instanceof Error ? `${err.name} ${err.message}` : String(err);
  return /quota|rate limit|resource_exhausted/i.test(text);
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), timeoutMs);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      }
    );
  });
}

function sanitizeStorageName(fileName: string): string {
  return fileName.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120) || "resume.pdf";
}

function sanitizeImageName(fileName: string): string {
  return fileName.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120) || "profile-photo.jpg";
}

function getResumeBucket(): string {
  return process.env.RESUME_STORAGE_BUCKET?.trim() || "resumes";
}

function getProfilePhotoBucket(): string {
  return process.env.PROFILE_PHOTO_STORAGE_BUCKET?.trim() || "avatars";
}

function getCompanyDocumentBucket(): string {
  return process.env.COMPANY_DOCUMENT_STORAGE_BUCKET?.trim() || "company-documents";
}

type RequiredStorageBucket = {
  name: string;
  isPublic: boolean;
  allowedMimeTypes?: string[];
};

const requiredStorageBuckets: RequiredStorageBucket[] = [
  {
    name: getResumeBucket(),
    isPublic: false,
    allowedMimeTypes: ["application/pdf"],
  },
  {
    name: getProfilePhotoBucket(),
    isPublic: false,
    allowedMimeTypes: ["image/png", "image/jpeg", "image/webp", "image/avif"],
  },
  {
    name: getCompanyDocumentBucket(),
    isPublic: false,
    allowedMimeTypes: ["application/pdf", "image/png", "image/jpeg", "image/webp"],
  },
];

function buildStorageReference(bucket: string, storagePath: string): string {
  return `${bucket}/${storagePath}`;
}

function splitStorageReference(reference: string): { bucket: string; path: string } | null {
  if (!reference || /^https?:\/\//i.test(reference)) {
    return null;
  }
  const [bucket, ...rest] = reference.split("/");
  const pathValue = rest.join("/");
  if (!bucket || !pathValue) {
    return null;
  }
  return { bucket, path: pathValue };
}

async function ensureStorageBucket(bucket: RequiredStorageBucket): Promise<void> {
  if (!supabaseAdmin) {
    throw new Error("Supabase storage is not configured");
  }

  const { data, error } = await supabaseAdmin.storage.listBuckets();
  if (error) {
    throw error;
  }

  if (data?.some((item) => item.name === bucket.name)) {
    return;
  }

  const { error: createError } = await supabaseAdmin.storage.createBucket(bucket.name, {
    public: bucket.isPublic,
    allowedMimeTypes: bucket.allowedMimeTypes,
  });
  if (createError) {
    throw createError;
  }
  logger.info("storage", "created missing storage bucket", { bucket: bucket.name });
}

async function ensureRequiredStorageBuckets(): Promise<void> {
  for (const bucket of requiredStorageBuckets) {
    await ensureStorageBucket(bucket);
  }
}

async function uploadBufferToStorage(bucket: string, storagePath: string, buffer: Buffer, contentType: string): Promise<string> {
  if (!supabaseAdmin) {
    throw new Error("Supabase storage is not configured");
  }
  const { error } = await supabaseAdmin.storage.from(bucket).upload(storagePath, buffer, {
    contentType,
    upsert: true,
  });
  if (error) {
    throw error;
  }
  return buildStorageReference(bucket, storagePath);
}

async function resolveStorageUrl(reference: string): Promise<string> {
  if (!reference) return "";
  if (/^https?:\/\//i.test(reference)) return reference;
  if (!supabaseAdmin) return "";

  const parsed = splitStorageReference(reference);
  if (!parsed) return "";

  const signed = await supabaseAdmin.storage.from(parsed.bucket).createSignedUrl(parsed.path, 60 * 60);
  if (!signed.error && signed.data?.signedUrl) {
    return signed.data.signedUrl;
  }

  const { data } = supabaseAdmin.storage.from(parsed.bucket).getPublicUrl(parsed.path);
  return data.publicUrl || "";
}

async function listStorageObjects(bucket: string, prefix: string, limit = 100) {
  if (!supabaseAdmin) {
    return [];
  }
  const { data, error } = await supabaseAdmin.storage.from(bucket).list(prefix, {
    limit,
    sortBy: { column: "created_at", order: "desc" },
  });
  if (error || !data?.length) {
    return [];
  }
  return data.filter((item) => item.name && !item.name.endsWith("/"));
}

async function uploadResumeToStorage(userId: string, profileId: string, fileName: string, buffer: Buffer): Promise<string> {
  const bucket = getResumeBucket();
  const storagePath = `${userId}/${profileId}/${Date.now()}-${sanitizeStorageName(fileName)}`;
  return uploadBufferToStorage(bucket, storagePath, buffer, "application/pdf");
}

async function getProfilePhotoUrlByPrefix(bucket: string, prefix: string): Promise<string> {
  const files = await listStorageObjects(bucket, prefix, 10);
  const latest = files[0];
  if (!latest?.name) return "";
  const objectPath = `${prefix}/${latest.name}`;
  if (bucket === "avatars" && supabaseAdmin) {
    const { data } = supabaseAdmin.storage.from(bucket).getPublicUrl(objectPath);
    if (data.publicUrl) {
      return data.publicUrl;
    }
  }
  return resolveStorageUrl(buildStorageReference(bucket, objectPath));
}

async function getProfilePhotoUrl(userId: string, profileId: string): Promise<string> {
  const bucket = getProfilePhotoBucket();
  return getProfilePhotoUrlByPrefix(bucket, `${userId}/${profileId}`);
}

async function getUserProfilePhotoUrl(userId: string, legacyProfileId?: string): Promise<string> {
  const bucket = getProfilePhotoBucket();
  const currentUrl = await getProfilePhotoUrlByPrefix(bucket, `${userId}/profile`);
  if (currentUrl) return currentUrl;
  if (legacyProfileId) {
    return getProfilePhotoUrl(userId, legacyProfileId);
  }
  return "";
}

async function removeProfilePhotos(userId: string, profileId: string): Promise<void> {
  if (!supabaseAdmin) return;
  const bucket = getProfilePhotoBucket();
  const prefix = `${userId}/${profileId}`;
  const files = await listStorageObjects(bucket, prefix);
  const paths = files.map((item) => `${prefix}/${item.name}`);
  if (paths.length) {
    await supabaseAdmin.storage.from(bucket).remove(paths);
  }
}

async function removeUserProfilePhotos(userId: string, legacyProfileId?: string): Promise<void> {
  if (!supabaseAdmin) return;
  const bucket = getProfilePhotoBucket();
  const prefixes = [`${userId}/profile`, ...(legacyProfileId ? [`${userId}/${legacyProfileId}`] : [])];
  for (const prefix of prefixes) {
    const files = await listStorageObjects(bucket, prefix);
    const paths = files.map((item) => `${prefix}/${item.name}`);
    if (paths.length) {
      await supabaseAdmin.storage.from(bucket).remove(paths);
    }
  }
}

async function uploadProfilePhotoToStorage(userId: string, profileId: string, fileName: string, mimeType: string, buffer: Buffer): Promise<string> {
  if (!/^image\/(png|jpe?g|webp|avif)$/i.test(mimeType)) {
    throw Object.assign(new Error("Profile photo must be PNG, JPG, WebP, or AVIF."), { statusCode: 400 });
  }
  if (buffer.length > 3 * 1024 * 1024) {
    throw Object.assign(new Error("Profile photo must be 3MB or smaller."), { statusCode: 400 });
  }

  const bucket = getProfilePhotoBucket();
  await removeProfilePhotos(userId, profileId);
  const storagePath = `${userId}/${profileId}/${Date.now()}-${sanitizeImageName(fileName)}`;
  await uploadBufferToStorage(bucket, storagePath, buffer, mimeType);
  return getProfilePhotoUrl(userId, profileId);
}

async function uploadUserProfilePhotoToStorage(userId: string, fileName: string, mimeType: string, buffer: Buffer, legacyProfileId?: string): Promise<string> {
  if (!/^image\/(png|jpe?g|webp|avif)$/i.test(mimeType)) {
    throw Object.assign(new Error("Profile photo must be PNG, JPG, WebP, or AVIF."), { statusCode: 400 });
  }
  if (buffer.length > 3 * 1024 * 1024) {
    throw Object.assign(new Error("Profile photo must be 3MB or smaller."), { statusCode: 400 });
  }

  const bucket = getProfilePhotoBucket();
  await removeUserProfilePhotos(userId, legacyProfileId);
  const storagePath = `${userId}/profile/${Date.now()}-${sanitizeImageName(fileName)}`;
  await uploadBufferToStorage(bucket, storagePath, buffer, mimeType);
  return getUserProfilePhotoUrl(userId, legacyProfileId);
}

async function hydrateUserProfilePhoto(user: User): Promise<User> {
  const legacyProfileId = user.role === "candidate" ? (await getProfileByUserId(user.id))?.id : undefined;
  return {
    ...user,
    profilePhotoUrl: await getUserProfilePhotoUrl(user.id, legacyProfileId),
  };
}

async function hydrateUsersProfilePhotos(users: User[]): Promise<User[]> {
  return Promise.all(users.map((user) => hydrateUserProfilePhoto(user)));
}

async function hydrateApplicationsWithProfilePhotos(applications: Application[]): Promise<Application[]> {
  const cache = new Map<string, string>();
  return Promise.all(applications.map(async (application) => {
    if (!application.candidateId) return application;
    if (!cache.has(application.candidateId)) {
      const profile = await getProfileById(application.candidateId).catch(() => null);
      const photoUrl = profile ? await getUserProfilePhotoUrl(profile.userId, profile.id) : "";
      cache.set(application.candidateId, photoUrl);
    }
    const photoUrl = cache.get(application.candidateId) || "";
    return photoUrl ? { ...application, candidateProfilePhotoUrl: photoUrl } : application;
  }));
}

async function uploadCompanyDocumentToStorage(userId: string, companyId: string, fileName: string, mimeType: string, buffer: Buffer): Promise<Company["documents"][number]> {
  if (!/^application\/pdf$|^image\/(png|jpe?g|webp)$/i.test(mimeType)) {
    throw Object.assign(new Error("Verification document must be PDF, PNG, JPG, or WebP."), { statusCode: 400 });
  }
  if (buffer.length > 6 * 1024 * 1024) {
    throw Object.assign(new Error("Verification document must be 6MB or smaller."), { statusCode: 400 });
  }

  const bucket = getCompanyDocumentBucket();
  const storagePath = `${userId}/${companyId}/${Date.now()}-${sanitizeStorageName(fileName)}`;
  const reference = await uploadBufferToStorage(bucket, storagePath, buffer, mimeType);
  const signedUrl = await resolveStorageUrl(reference);
  return {
    name: fileName,
    path: storagePath,
    url: signedUrl || reference,
    mimeType,
    uploadedAt: new Date().toISOString(),
  };
}

async function hydrateCompanyDocuments(documents: Company["documents"]): Promise<Company["documents"]> {
  return Promise.all(
    (documents || []).map(async (document) => {
      const reference = document.path
        ? buildStorageReference(getCompanyDocumentBucket(), document.path)
        : document.url || "";
      const resolvedUrl = reference ? await resolveStorageUrl(reference) : "";
      return {
        ...document,
        url: resolvedUrl || document.url,
      };
    })
  );
}

async function hydrateCompanyStorage(company: Company | null): Promise<Company | null> {
  if (!company) return null;
  return {
    ...company,
    documents: await hydrateCompanyDocuments(company.documents || []),
  };
}

function getGeminiClient(): GoogleGenAI {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY?.trim();
    if (!apiKey) {
      throw new Error("Gemini API key missing");
    }
    aiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
  }
  return aiClient;
}

function logGeminiStartupStatus() {
  const status = getGeminiApiKeyStatus();
  if (status === "missing") {
    logger.warn("resume-parser", "Gemini API key missing; local fallback remains active");
  } else if (status === "suspicious") {
    logger.warn("resume-parser", "Gemini API key format is suspicious; local fallback remains active");
  } else {
    logger.info("resume-parser", "Gemini API key detected");
  }
}

async function startServer() {
  const runtimeConfig = validateStartupEnvironment();
  logger.info("startup", "environment validated", {
    nodeEnv: runtimeConfig.nodeEnv,
    version: runtimeConfig.version,
    optionalConfigured: runtimeConfig.optionalConfigured.join(","),
    optionalMissing: runtimeConfig.optionalMissing.join(","),
  });
  logGeminiStartupStatus();
  await ensureRequiredStorageBuckets();

  const app = express();
  app.disable("x-powered-by");

  app.use((req, res, next) => {
    const requestId = req.header("x-request-id") || `req-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
    const started = Date.now();
    res.locals.requestId = requestId;
    res.setHeader("X-Request-Id", requestId);
    res.on("finish", () => {
      logger.info("http", "request completed", {
        requestId,
        method: req.method,
        path: req.path,
        statusCode: res.statusCode,
        durationMs: Date.now() - started,
      });
    });
    next();
  });

  app.use(express.json({ limit: "12mb" }));

  // CORS headers
  app.use((req, res, next) => {
    const configuredOrigin = process.env.CORS_ORIGIN?.trim();
    const origin = configuredOrigin || (process.env.NODE_ENV === "production" ? "https://persevex.com" : "*");
    res.header("Access-Control-Allow-Origin", origin);
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization");
    res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    res.header("Cross-Origin-Resource-Policy", "same-site");
    res.header("Referrer-Policy", "no-referrer");
    res.header("X-Content-Type-Options", "nosniff");
    res.header("X-Frame-Options", "DENY");
    res.header("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
    const devConnect = process.env.NODE_ENV === "production" ? "" : " http://localhost:* http://127.0.0.1:* ws://localhost:* ws://127.0.0.1:*";
    res.header("Content-Security-Policy", `default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: blob:; connect-src 'self' https://*.supabase.co${devConnect};`);
    if (req.method === "OPTIONS") {
      return res.sendStatus(200);
    }
    next();
  });

  // Authentication middleware helper. Production requests must carry a signed bearer session.
  const handleUserServiceError = (res: express.Response, err: unknown) => {
    logger.error("users", "service error", err, { requestId: String(res.locals.requestId || '') });
    return res.status(500).json({ error: "User service unavailable" });
  };

  const handleCompanyServiceError = (res: express.Response, err: unknown) => {
    logger.error("companies", "service error", err, { requestId: String(res.locals.requestId || '') });
    return res.status(500).json({ error: "Company service unavailable" });
  };

  const handleCandidateProfileServiceError = (res: express.Response, err: unknown) => {
    logger.error("candidate-profiles", "service error", err, { requestId: String(res.locals.requestId || '') });
    return res.status(500).json({ error: "Candidate profile service unavailable" });
  };

  const handleJobServiceError = (res: express.Response, err: unknown) => {
    logger.error("jobs", "service error", err, { requestId: String(res.locals.requestId || '') });
    return res.status(500).json({ error: "Job service unavailable" });
  };

  const handleApplicationServiceError = (res: express.Response, err: unknown) => {
    logger.error("applications", "service error", err, { requestId: String(res.locals.requestId || '') });
    return res.status(500).json({ error: "Application service unavailable" });
  };

  const handleNotificationServiceError = (res: express.Response, err: unknown) => {
    logger.error("notifications", "service error", err, { requestId: String(res.locals.requestId || '') });
    return res.status(500).json({ error: "Notification service unavailable" });
  };

  const handleEmailLogServiceError = (res: express.Response, err: unknown) => {
    logger.error("email", "service error", err, { requestId: String(res.locals.requestId || '') });
    return res.status(500).json({ error: "Email log service unavailable" });
  };

  const recordNotification = async (notification: AppNotification) => {
    await createNotification(notification);
  };

  const getActiveUser = async (req: express.Request): Promise<User | null> => {
    const token = getBearerToken(req.headers.authorization);
    if (!token) return null;
    try {
      return await validateSessionToken(token);
    } catch (err) {
      logger.error("auth", "failed to validate session", err);
      return null;
    }
  };

  const canAccessNotification = (user: User, notification: AppNotification): boolean => {
    return notification.recipientId === user.id || (user.role === "admin" && notification.recipientId === "all_admin");
  };

  app.get("/health", (_req, res) => {
    res.json({
      status: "ok",
      version: runtimeConfig.version,
      uptimeSeconds: Math.round((Date.now() - STARTED_AT) / 1000),
      timestamp: new Date().toISOString(),
    });
  });

  app.get("/ready", async (_req, res) => {
    const started = Date.now();
    const checks: Record<string, { status: "ok" | "error" | "disabled"; detail?: string; durationMs?: number }> = {
      database: { status: "disabled", detail: "supabase admin client unavailable" },
      gemini: { status: getGeminiApiKeyStatus() === "configured" ? "ok" : "disabled", detail: getGeminiApiKeyStatus() },
      email: {
        status: process.env.EMAIL_DELIVERY_ENABLED ? (process.env.EMAIL_WEBHOOK_URL ? "ok" : "error") : "disabled",
        detail: process.env.EMAIL_DELIVERY_ENABLED ? "delivery flag enabled" : "delivery flag disabled",
      },
    };

    if (supabaseAdmin) {
      const dbStarted = Date.now();
      try {
        const { error } = await supabaseAdmin.from("users").select("id").limit(1);
        checks.database = {
          status: error ? "error" : "ok",
          detail: error?.message,
          durationMs: Date.now() - dbStarted,
        };
      } catch (err) {
        checks.database = {
          status: "error",
          detail: err instanceof Error ? err.message : String(err),
          durationMs: Date.now() - dbStarted,
        };
      }
    }

    const ready = Object.values(checks).every((check) => check.status !== "error");
    res.status(ready ? 200 : 503).json({
      status: ready ? "ready" : "not_ready",
      version: runtimeConfig.version,
      uptimeSeconds: Math.round((Date.now() - STARTED_AT) / 1000),
      durationMs: Date.now() - started,
      checks,
    });
  });

  const tryBootstrapPassword = async (user: User, password: string): Promise<string | null> => {
    const bootstrapEmail = process.env.AUTH_BOOTSTRAP_EMAIL?.trim().toLowerCase();
    const bootstrapPassword = process.env.AUTH_BOOTSTRAP_PASSWORD;
    if (!bootstrapEmail || !bootstrapPassword) {
      return null;
    }
    if (user.email.toLowerCase() !== bootstrapEmail || password !== bootstrapPassword) {
      return null;
    }

    const passwordHash = await hashPassword(password);
    await setPasswordHashForUser(user.id, passwordHash);
    return passwordHash;
  };

  const ensureLoginProfile = async (user: User): Promise<boolean> => {
    if (user.role === "candidate") {
      try {
        const existingProfile = await getProfileByUserId(user.id);
        if (!existingProfile) {
          await createProfile({
            userId: user.id,
            education: "Not set",
            skills: [],
            experience: "",
            resumeText: "",
            resumeFileName: "",
          });
          return true;
        }
      } catch (err) {
        logger.error("candidate-profiles", "failed to ensure login profile", err, { userId: user.id });
      }
    }

    if (user.role === "company") {
      try {
        const existingCompany = await getCompanyByUserId(user.id);
        if (!existingCompany) {
          await createCompany({
            userId: user.id,
            companyName: user.name,
            website: "",
            linkedin: "",
            industry: "",
            companyEmail: user.email.toLowerCase(),
            contactPerson: user.name,
            phone: "",
            verificationStatus: "pending",
            documents: [],
          });
          return true;
        }
      } catch (err) {
        logger.error("companies", "failed to ensure login company", err, { userId: user.id });
      }
    }

    return false;
  };

  // --- AUTH ENDPOINTS ---

  app.post("/api/auth/login", rateLimit({ keyPrefix: "login", windowMs: 15 * 60 * 1000, max: 20 }), async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    let user: User | null;
    try {
      user = await getUserByEmail(email);
    } catch (err) {
      return handleUserServiceError(res, err);
    }

    if (!user) {
      logger.warn("auth", "login failed: user not found", { requestId: String(res.locals.requestId || ''), email });
      return res.status(401).json({ error: "Invalid email or password" });
    }

    if (user.status !== "active") {
      logger.warn("auth", "login blocked: inactive user", { requestId: String(res.locals.requestId || ''), userId: user.id });
      return res.status(403).json({ error: "Account is inactive" });
    }

    let passwordHash: string | null;
    try {
      passwordHash = await getPasswordHashForUser(user.id);
    } catch (err) {
      logger.error("auth", "password storage unavailable", err, { requestId: String(res.locals.requestId || '') });
      return res.status(500).json({ error: "Authentication storage is not configured" });
    }

    if (!passwordHash) {
      try {
        passwordHash = await tryBootstrapPassword(user, password);
      } catch (err) {
        logger.error("auth", "failed to bootstrap password", err, { requestId: String(res.locals.requestId || '') });
        return res.status(500).json({ error: "Authentication storage is not configured" });
      }
      if (!passwordHash) {
        return res.status(403).json({ error: "Password has not been configured for this account" });
      }
    }

    const passwordMatches = await verifyPassword(password, passwordHash);
    if (!passwordMatches) {
      logger.warn("auth", "login failed: password mismatch", { requestId: String(res.locals.requestId || ''), userId: user.id });
      return res.status(401).json({ error: "Invalid email or password" });
    }

    await ensureLoginProfile(user);

    const hydratedUser = await hydrateUserProfilePhoto(user);
    logger.info("auth", "login succeeded", { requestId: String(res.locals.requestId || ''), userId: user.id, role: user.role });
    res.json({ user: hydratedUser, token: createSessionToken(hydratedUser) });
  });

  app.post("/api/auth/register", rateLimit({ keyPrefix: "register", windowMs: 60 * 60 * 1000, max: 10 }), async (req, res) => {
    const { name, email, password, role } = req.body;
    if (!name || !email || !password || !role) {
      return res.status(400).json({ error: "All profile fields are required" });
    }

    if (!["candidate", "company"].includes(role)) {
      return res.status(400).json({ error: "Registration role must be candidate or company" });
    }

    const passwordError = validatePasswordStrength(password);
    if (passwordError) {
      return res.status(400).json({ error: passwordError });
    }

    let exists: boolean;
    try {
      exists = Boolean(await getUserByEmail(email));
    } catch (err) {
      return handleUserServiceError(res, err);
    }
    if (exists) {
      logger.warn("auth", "registration rejected: duplicate email", { requestId: String(res.locals.requestId || ''), email });
      return res.status(400).json({ error: "A user with this email already exists" });
    }

    const newUserInput: User = {
      id: `u-${Date.now()}`,
      name,
      email: email.toLowerCase(),
      role: role as "candidate" | "company",
      status: "active",
      createdAt: new Date().toISOString()
    };

    let newUser: User;
    try {
      newUser = await createUser(newUserInput);
    } catch (err) {
      return handleUserServiceError(res, err);
    }

    try {
      await setPasswordHashForUser(newUser.id, await hashPassword(password));
    } catch (err) {
      logger.error("auth", "failed to store password hash", err, { requestId: String(res.locals.requestId || '') });
      return res.status(500).json({ error: "Authentication storage is not configured" });
    }

    // If role is company, create a draft company profile
    let newCompany: Company | null = null;
    if (role === "company") {
      try {
        newCompany = await createCompany({
          userId: newUser.id,
          companyName: `${name}'s Firm`,
          website: "",
          linkedin: "",
          industry: "",
          companyEmail: email,
          contactPerson: name,
          phone: "",
          verificationStatus: "pending",
          documents: [],
        });
      } catch (err) {
        return handleCompanyServiceError(res, err);
      }
    }

    // If role is candidate, create empty profile
    if (role === "candidate") {
      try {
        await createProfile({
          userId: newUser.id,
          education: "",
          skills: [],
          experience: "",
          resumeText: "",
          resumeFileName: "",
        });
      } catch (err) {
        return handleCandidateProfileServiceError(res, err);
      }
    }

    await emitCommunicationEvent({
      eventType: "WELCOME",
      notifications: role === "company" && newCompany ? [{
        recipientId: "all_admin",
        title: "New Company Signup",
        message: `${newUser.name} created a new employer account for ${newCompany.companyName}.`,
        type: "info",
      }] : [{
        recipientId: newUser.id,
        title: "Welcome to Persevex",
        message: "Your candidate workspace is ready. Complete your profile and upload a resume to improve matching.",
        type: "success",
      }],
      emails: [{
        userId: newUser.id,
        recipientEmail: newUser.email,
        recipientName: newUser.name,
        subject: "Welcome to Persevex",
        html: emailTemplates.welcome(newUser.name, newUser.role),
      }],
      metadata: { role: newUser.role },
    });

    const hydratedUser = await hydrateUserProfilePhoto(newUser);
    logger.info("auth", "registration succeeded", { requestId: String(res.locals.requestId || ''), userId: newUser.id, role: newUser.role });
    res.json({ user: hydratedUser, token: createSessionToken(hydratedUser) });
  });

  app.get("/api/auth/me", async (req, res) => {
    const user = await getActiveUser(req);
    if (!user) {
      return res.status(401).json({ error: "Unauthenticated" });
    }
    res.json({ user: await hydrateUserProfilePhoto(user) });
  });

  app.post("/api/auth/forgot-password", rateLimit({ keyPrefix: "forgot-password", windowMs: 60 * 60 * 1000, max: 8 }), async (req, res) => {
    const email = String(req.body?.email || '').trim().toLowerCase();
    if (!email) {
      return res.status(400).json({ error: "Email is required" });
    }

    let user: User | null = null;
    try {
      user = await getUserByEmail(email);
    } catch (err) {
      logger.error("auth", "password reset user lookup failed", err, { requestId: String(res.locals.requestId || '') });
    }

    await emitCommunicationEvent({
      eventType: "PASSWORD_RESET",
      notifications: user ? [{
        recipientId: user.id,
        title: "Password Reset Requested",
        message: "A password reset workflow was requested for your Persevex account.",
        type: "warning",
      }] : [],
      emails: [{
        userId: user?.id,
        recipientEmail: email,
        recipientName: user?.name || email,
        subject: "Persevex password reset request",
        html: emailTemplates.passwordReset(email),
      }],
      metadata: { accountFound: Boolean(user) },
    });

    logger.info("auth", "password reset workflow recorded", { requestId: String(res.locals.requestId || ''), accountFound: Boolean(user) });
    res.json({ ok: true, message: "If this email exists, a recovery workflow has been recorded." });
  });

  // --- COMPANIES ENDPOINTS ---

  app.get("/api/companies", async (req, res) => {
    const user = await getActiveUser(req);
    if (!user || user.role !== "admin") {
      return res.status(403).json({ error: "Requires administrator access" });
    }

    try {
      const companies = await getAllCompanies();
      const hydratedCompanies = (await Promise.all(companies.map((company) => hydrateCompanyStorage(company))))
        .filter((company): company is Company => Boolean(company));
      res.json({ companies: hydratedCompanies });
    } catch (err) {
      return handleCompanyServiceError(res, err);
    }
  });

  app.get("/api/companies/my", async (req, res) => {
    const user = await getActiveUser(req);
    if (!user || user.role !== "company") {
      return res.status(403).json({ error: "Unauthorized" });
    }

    try {
      const company = await getCompanyByUserId(user.id);
      if (!company) {
        return res.status(404).json({ error: "Company profile not found" });
      }
      res.json({ company: await hydrateCompanyStorage(company) });
    } catch (err) {
      return handleCompanyServiceError(res, err);
    }
  });

  app.post("/api/companies/documents", async (req, res) => {
    const user = await getActiveUser(req);
    if (!user || user.role !== "company") {
      return res.status(403).json({ error: "Unauthorized" });
    }

    try {
      const currentComp = await getCompanyByUserId(user.id);
      if (!currentComp) {
        return res.status(404).json({ error: "Company profile not found" });
      }

      const { base64, fileName, mimeType } = req.body as { base64?: string; fileName?: string; mimeType?: string };
      if (!base64 || !fileName) {
        return res.status(400).json({ error: "Verification document payload is missing." });
      }

      const base64Data = base64.includes(",") ? base64.split(",")[1] : base64;
      const document = await uploadCompanyDocumentToStorage(
        user.id,
        currentComp.id,
        fileName,
        mimeType || "application/pdf",
        Buffer.from(base64Data, "base64")
      );

      const updated = await updateCompany(currentComp.id, {
        documents: [...(currentComp.documents || []), document],
        verificationStatus: currentComp.verificationStatus === "rejected" ? "pending" : currentComp.verificationStatus,
      });
      if (!updated) {
        return res.status(404).json({ error: "Company profile not found" });
      }

      res.json({ company: await hydrateCompanyStorage(updated), document });
    } catch (err: unknown) {
      const errorLike = err as { message?: string; statusCode?: unknown };
      const status = typeof errorLike.statusCode === "number" ? errorLike.statusCode : 500;
      logger.error("companies", "document upload failed", err, { requestId: String(res.locals.requestId || "") });
      res.status(status).json({ error: errorLike.message || "Company document upload failed" });
    }
  });

  app.post("/api/companies/update", async (req, res) => {
    const user = await getActiveUser(req);
    if (!user || user.role !== "company") {
      return res.status(403).json({ error: "Unauthorized" });
    }

    try {
      const currentComp = await getCompanyByUserId(user.id);
      if (!currentComp) {
        return res.status(404).json({ error: "Company profile not found" });
      }

      const { companyName, website, linkedin, industry, companyEmail, contactPerson, phone } = req.body;

      const updated = await updateCompany(currentComp.id, {
        companyName: companyName || currentComp.companyName,
        website: website || currentComp.website,
        linkedin: linkedin || currentComp.linkedin,
        industry: industry || currentComp.industry,
        companyEmail: companyEmail || currentComp.companyEmail,
        contactPerson: contactPerson || currentComp.contactPerson,
        phone: phone || currentComp.phone,
        verificationStatus: currentComp.verificationStatus === "rejected" ? "pending" : currentComp.verificationStatus,
      });

      if (!updated) {
        return res.status(404).json({ error: "Company profile not found" });
      }

      if (currentComp.companyName !== updated.companyName) {
        await recordNotification({
          id: `n-${Date.now()}`,
          recipientId: "all_admin",
          title: "Company Profile Updated",
          message: `${user.name} updated profile for "${updated.companyName}". Verification is pending.`,
          isRead: false,
          createdAt: new Date().toISOString()
        });
      }

      res.json({ company: await hydrateCompanyStorage(updated) });
    } catch (err) {
      return handleCompanyServiceError(res, err);
    }
  });

  // Admin approves/rejects corporate status
  app.post("/api/companies/:id/status", async (req, res) => {
    const user = await getActiveUser(req);
    if (!user || user.role !== "admin") {
      return res.status(403).json({ error: "Requires administrator access" });
    }

    const { id } = req.params;
    const { status } = req.body; // 'approved' | 'rejected' | 'pending'

    try {
      const existingCompany = await getCompanyById(id);
      if (!existingCompany) {
        return res.status(404).json({ error: "Company not found" });
      }

      const updatedCompany = await updateVerificationStatus(id, status);
      if (!updatedCompany) {
        return res.status(404).json({ error: "Company not found" });
      }

      const approved = status === "approved";
      await emitCommunicationEvent({
        eventType: approved ? "COMPANY_APPROVED" : "COMPANY_REJECTED",
        notifications: [{
          recipientId: updatedCompany.userId,
          title: approved ? "Company Account Approved" : "Company Registration Update",
          message: approved
            ? "Congratulations! Your corporate profile has been verified and approved by Persevex Admin. You can now publish job opportunities."
            : "Your company credentials verification has been rejected. Please review your credentials or contact support.",
          type: approved ? "success" : "warning",
        }],
        emails: [{
          userId: updatedCompany.userId,
          recipientEmail: updatedCompany.companyEmail,
          recipientName: updatedCompany.contactPerson || updatedCompany.companyName,
          subject: approved ? "Persevex company account approved" : "Persevex company registration update",
          html: emailTemplates.companyDecision(updatedCompany.companyName, approved),
        }],
        metadata: { companyId: updatedCompany.id, status },
      });

      res.json({ company: updatedCompany });
    } catch (err) {
      return handleCompanyServiceError(res, err);
    }
  });

  // --- JOB MANAGEMENT ENDPOINTS ---

  const parseStringList = (value: unknown): string[] => {
    if (Array.isArray(value)) {
      return value.map((item) => String(item).trim()).filter(Boolean);
    }
    if (typeof value === "string") {
      return value.split(",").map((item) => item.trim()).filter(Boolean);
    }
    return [];
  };

  const getPublicJobsRanked = (jobs: Job[]): Job[] => {
    return [...jobs]
      .filter((job) => job.visibility !== "private")
      .sort((a, b) => {
        const score = (job: Job) =>
          (job.sponsored ? 300 : 0)
          + (job.featured ? 180 : 0)
          + (job.priority ? 120 : 0)
          + (new Date(job.createdAt).getTime() / 100000000000);
        return score(b) - score(a);
      });
  };

  const getAdminCompanyForJobRequest = async (req: express.Request, user: User): Promise<{ companyId: string; companyName: string } | null> => {
    const { companyMode, companyId, companyName, newCompanyName, newCompanyEmail, newCompanyIndustry } = req.body as {
      companyMode?: "existing" | "new" | "platform";
      companyId?: string;
      companyName?: string;
      newCompanyName?: string;
      newCompanyEmail?: string;
      newCompanyIndustry?: string;
    };

    if (companyMode === "existing" && companyId) {
      const existing = await getCompanyById(companyId);
      if (!existing) {
        throw Object.assign(new Error("Selected company was not found"), { statusCode: 404 });
      }
      return { companyId: existing.id, companyName: existing.companyName };
    }

    if (companyMode === "new" && newCompanyName) {
      const created = await createCompany({
        userId: user.id,
        companyName: newCompanyName,
        companyEmail: newCompanyEmail || user.email,
        contactPerson: user.name,
        industry: newCompanyIndustry || "",
        verificationStatus: "approved",
        documents: [],
      });
      return { companyId: created.id, companyName: created.companyName };
    }

    if (companyId) {
      const existing = await getCompanyById(companyId);
      if (existing) return { companyId: existing.id, companyName: existing.companyName };
    }

    const internalId = await getPersevexInternalCompanyId();
    if (!internalId) {
      throw Object.assign(new Error("Persevex Internal company is not configured in Supabase"), { statusCode: 500 });
    }
    return { companyId: internalId, companyName: companyName || "Persevex Internal" };
  };

  const emitJobActionNotification = async (job: Job, action: string, actor: User) => {
    const titleByAction: Record<string, string> = {
      created: "Job Created",
      published: "Job Published",
      paused: "Job Paused",
      resumed: "Job Resumed",
      closed: "Job Closed",
      archived: "Job Archived",
      deleted: "Job Deleted",
      featured: "Job Featured",
      sponsored: "Job Sponsored",
      flagged: "Job Flagged",
      suspended: "Job Suspended",
      rejected: "Job Rejected",
    };
    const eventByAction: Record<string, Parameters<typeof emitCommunicationEvent>[0]["eventType"]> = {
      created: "JOB_CREATED",
      published: "JOB_PUBLISHED",
      paused: "JOB_PAUSED",
      resumed: "JOB_PUBLISHED",
      closed: "JOB_CLOSED",
      archived: "JOB_ARCHIVED",
      deleted: "JOB_DELETED",
      featured: "OPPORTUNITY_UPDATED",
      sponsored: "OPPORTUNITY_UPDATED",
      flagged: "JOB_REJECTED",
      suspended: "JOB_REJECTED",
      rejected: "JOB_REJECTED",
    };

    let company: Company | null = null;
    try {
      company = await getCompanyById(job.companyId);
    } catch (err) {
      logger.error("jobs", "failed to load company for job action notification", err, { jobId: job.id });
    }

    await emitCommunicationEvent({
      eventType: eventByAction[action] || "OPPORTUNITY_UPDATED",
      notifications: [
        {
          recipientId: "all_admin",
          title: titleByAction[action] || "Job Updated",
          message: `${actor.name} ${action} "${job.title}" for ${job.companyName}.`,
          type: action === "rejected" || action === "suspended" ? "warning" : "info",
        },
        ...(company?.userId ? [{
          recipientId: company.userId,
          title: titleByAction[action] || "Job Updated",
          message: `Your job "${job.title}" was ${action} by Persevex Admin.`,
          type: action === "rejected" || action === "suspended" ? "warning" as const : "info" as const,
        }] : []),
      ],
      metadata: { jobId: job.id, action, actorId: actor.id },
    });
  };

  // Get active/approved public jobs for candidates
  app.get("/api/jobs", async (req, res) => {
    const user = await getActiveUser(req);

    try {
      if (user && user.role === "admin") {
        const jobs = await getAllJobs();
        return res.json({ jobs });
      }

      if (user && user.role === "company") {
        let company: Company | null = null;
        try {
          company = await getCompanyByUserId(user.id);
        } catch (err) {
          return handleCompanyServiceError(res, err);
        }
        if (!company) {
          return res.json({ jobs: [] });
        }
        const jobs = await getJobsByCompanyId(company.id);
        return res.json({ jobs });
      }

      const jobs = getPublicJobsRanked(await getJobsByStatus("approved"));
      return res.json({ jobs });
    } catch (err) {
      return handleJobServiceError(res, err);
    }
  });

  // Job view tracking
  app.post("/api/jobs/:id/view", async (req, res) => {
    const { id } = req.params;

    try {
      await incrementViewCount(id);
      res.sendStatus(200);
    } catch (err) {
      return handleJobServiceError(res, err);
    }
  });

  app.post("/api/jobs/:id/report", async (req, res) => {
    const user = await getActiveUser(req);
    if (!user) {
      return res.status(401).json({ error: "Authentication required to report a job" });
    }

    const { id } = req.params;
    const { reason } = req.body as { reason?: string };
    try {
      const job = await getJobById(id);
      if (!job) {
        return res.status(404).json({ error: "Job opening not found" });
      }
      await emitCommunicationEvent({
        eventType: "OPPORTUNITY_UPDATED",
        notifications: [{
          recipientId: "all_admin",
          title: "Opportunity Reported",
          message: `${user.name} reported "${job.title}" at ${job.companyName}.${reason ? ` Reason: ${reason}` : ""}`,
          type: "warning",
        }],
        metadata: { jobId: job.id, reporterId: user.id, reason: reason || "unspecified" },
      });
      res.json({ ok: true });
    } catch (err) {
      return handleJobServiceError(res, err);
    }
  });

  // Create Job
  app.post("/api/jobs/create", async (req, res) => {
    const user = await getActiveUser(req);
    if (!user || user.role === "candidate") {
      return res.status(403).json({ error: "Candidates cannot publish jobs" });
    }

    const {
      title,
      department,
      location,
      jobType,
      workMode,
      experience,
      education,
      salary,
      benefits,
      equity,
      description,
      requirements,
      preferredSkills,
      deadline,
      openings,
      hiringManager,
      visibility,
      featured,
      sponsored,
      priority,
      status: requestedStatus,
    } = req.body;

    const requiredSkills = parseStringList(requirements);
    const preferredSkillList = parseStringList(preferredSkills);

    if (!title || !description || requiredSkills.length === 0) {
      return res.status(400).json({ error: "Missing required job specification fields" });
    }

    let companyId: string | null = null;
    let companyName = "Persevex Internal";
    let status: Job["status"] = "approved";

    if (user.role === "company") {
      let company: Company | null = null;
      try {
        company = await getCompanyByUserId(user.id);
      } catch (err) {
        return handleCompanyServiceError(res, err);
      }
      if (!company) {
        return res.status(404).json({ error: "Please configure your corporate registration first" });
      }
      if (company.verificationStatus !== "approved") {
        return res.status(403).json({ error: "Company verification must be approved before publishing" });
      }
      companyId = company.id;
      companyName = company.companyName;
      status = "submitted";
    } else {
      try {
        const adminCompany = await getAdminCompanyForJobRequest(req, user);
        companyId = adminCompany?.companyId || null;
        companyName = adminCompany?.companyName || "Persevex Internal";
      } catch (err) {
        const errorLike = err as { statusCode?: unknown; message?: string };
        const code = typeof errorLike.statusCode === "number" ? errorLike.statusCode : 500;
        return res.status(code).json({ error: errorLike.message || "Unable to assign company to job" });
      }
      if (!companyId) {
        return res.status(500).json({ error: "Persevex Internal company is not configured in Supabase" });
      }
      status = ["draft", "submitted", "approved", "paused", "closed"].includes(requestedStatus) ? requestedStatus : "approved";
    }

    let newJob: Job;
    try {
      newJob = await createJob({
        companyId,
        companyName,
        title,
        department: department || "Operations",
        location: location || "Remote",
        jobType: jobType || "Full-time",
        workMode: ["remote", "hybrid", "onsite"].includes(workMode) ? workMode : undefined,
        experience: experience || "Not Specified",
        education: education || "",
        salary: salary || "Discussable",
        benefits: benefits || "",
        equity: equity || "",
        description,
        requirements: requiredSkills,
        preferredSkills: preferredSkillList,
        status,
        openings: Number(openings) > 0 ? Number(openings) : 1,
        hiringManager: hiringManager || "",
        visibility: visibility === "private" ? "private" : "public",
        featured: Boolean(featured),
        sponsored: Boolean(sponsored),
        priority: Boolean(priority),
        viewCount: 0,
        deadline: deadline || "",
      });
    } catch (err) {
      return handleJobServiceError(res, err);
    }

    if (user.role === "company") {
      await emitCommunicationEvent({
        eventType: "JOB_SUBMITTED",
        notifications: [{
          recipientId: "all_admin",
          title: "New Job Review Required",
          message: `${companyName} posted a new job "${title}" and requests verification.`,
          type: "info",
        }],
        metadata: { jobId: newJob.id, status: "submitted" },
      });
    } else {
      await emitJobActionNotification(newJob, "created", user);
    }

    res.json({ job: newJob });
  });

  // Admin approves/rejects job post
  app.post("/api/jobs/:id/status", async (req, res) => {
    const user = await getActiveUser(req);
    if (!user || user.role !== "admin") {
      return res.status(403).json({ error: "Access Denied" });
    }

    const { id } = req.params;
    const { status } = req.body;

    let currentJob: Job | null = null;
    try {
      currentJob = await getJobById(id);
      if (!currentJob) {
        return res.status(404).json({ error: "Job opening not found" });
      }

      const updatedJob = await updateJobStatus(id, status);
      if (!updatedJob) {
        return res.status(404).json({ error: "Job opening not found" });
      }
      currentJob = updatedJob;
    } catch (err) {
      return handleJobServiceError(res, err);
    }

    let compProfile: Company | null = null;
    try {
      compProfile = await getCompanyById(currentJob.companyId);
    } catch (err) {
      logger.error("companies", "failed to load company for job status notification", err);
    }
    if (compProfile) {
      const approved = status === "approved";
      await emitCommunicationEvent({
        eventType: approved ? "JOB_APPROVED" : "JOB_REJECTED",
        notifications: [{
          recipientId: compProfile.userId,
          title: approved ? "Job Request Approved" : "Job Request Feedback",
          message: approved
            ? `Your job post for "${currentJob.title}" has been reviewed, approved, and is now live for candidates!`
            : `Your job post request for "${currentJob.title}" was rejected or deactivated by Persevex HR.`,
          type: approved ? "success" : "warning",
        }],
        emails: [{
          userId: compProfile.userId,
          recipientEmail: compProfile.companyEmail,
          recipientName: compProfile.contactPerson || compProfile.companyName,
          subject: approved ? `Job approved: ${currentJob.title}` : `Job moderation update: ${currentJob.title}`,
          html: emailTemplates.jobDecision(currentJob.title, approved),
        }],
        metadata: { jobId: currentJob.id, status },
      });
    }

    res.json({ job: currentJob });
  });

  app.patch("/api/jobs/:id", async (req, res) => {
    const user = await getActiveUser(req);
    if (!user || user.role === "candidate") {
      return res.status(403).json({ error: "Candidates cannot manage jobs" });
    }

    const { id } = req.params;
    let existing: Job | null = null;
    try {
      existing = await getJobById(id);
    } catch (err) {
      return handleJobServiceError(res, err);
    }
    if (!existing) {
      return res.status(404).json({ error: "Job opening not found" });
    }

    if (user.role === "company") {
      const company = await getCompanyByUserId(user.id);
      if (!company || company.id !== existing.companyId) {
        return res.status(403).json({ error: "Recruiters can only manage jobs owned by their company" });
      }
    }

    let companyPatch: { companyId?: string; companyName?: string } = {};
    if (user.role === "admin" && (req.body.companyMode || req.body.companyId || req.body.newCompanyName)) {
      try {
        const assignedCompany = await getAdminCompanyForJobRequest(req, user);
        if (assignedCompany) companyPatch = assignedCompany;
      } catch (err) {
        const errorLike = err as { statusCode?: unknown; message?: string };
        const code = typeof errorLike.statusCode === "number" ? errorLike.statusCode : 500;
        return res.status(code).json({ error: errorLike.message || "Unable to assign company to job" });
      }
    }

    const requirements = req.body.requirements !== undefined ? parseStringList(req.body.requirements) : undefined;
    const preferredSkills = req.body.preferredSkills !== undefined ? parseStringList(req.body.preferredSkills) : undefined;

    try {
      const updated = await updateJob(id, {
        ...companyPatch,
        title: req.body.title,
        department: req.body.department,
        location: req.body.location,
        jobType: req.body.jobType,
        workMode: req.body.workMode,
        experience: req.body.experience,
        education: req.body.education,
        salary: req.body.salary,
        benefits: req.body.benefits,
        equity: req.body.equity,
        description: req.body.description,
        requirements,
        preferredSkills,
        deadline: req.body.deadline,
        openings: req.body.openings !== undefined ? Number(req.body.openings) : undefined,
        hiringManager: req.body.hiringManager,
        visibility: req.body.visibility,
        featured: req.body.featured,
        sponsored: req.body.sponsored,
        priority: req.body.priority,
        moderationReason: req.body.moderationReason,
      });
      if (!updated) {
        return res.status(404).json({ error: "Job opening not found" });
      }
      await emitJobActionNotification(updated, "updated", user);
      res.json({ job: updated });
    } catch (err) {
      return handleJobServiceError(res, err);
    }
  });

  app.post("/api/jobs/:id/action", async (req, res) => {
    const user = await getActiveUser(req);
    if (!user || user.role === "candidate") {
      return res.status(403).json({ error: "Candidates cannot manage jobs" });
    }

    const { id } = req.params;
    const { action, reason } = req.body as { action?: string; reason?: string };
    const actionStatus: Record<string, Job["status"]> = {
      publish: "approved",
      pause: "paused",
      resume: "approved",
      close: "closed",
      archive: "archived",
      flag: "flagged",
      suspend: "suspended",
      reject: "rejected",
    };
    const flagPatch: Record<string, Partial<Job>> = {
      feature: { featured: true },
      unfeature: { featured: false },
      sponsor: { sponsored: true, priority: true },
      unsponsor: { sponsored: false },
      boost: { priority: true },
      unboost: { priority: false },
    };

    if (!action || (!actionStatus[action] && !flagPatch[action])) {
      return res.status(400).json({ error: "Unsupported job action" });
    }

    let existing: Job | null = null;
    try {
      existing = await getJobById(id);
    } catch (err) {
      return handleJobServiceError(res, err);
    }
    if (!existing) {
      return res.status(404).json({ error: "Job opening not found" });
    }

    if (user.role === "company") {
      const company = await getCompanyByUserId(user.id);
      if (!company || company.id !== existing.companyId) {
        return res.status(403).json({ error: "Recruiters can only manage jobs owned by their company" });
      }
      if (!["pause", "resume", "close"].includes(action)) {
        return res.status(403).json({ error: "Recruiters can pause, resume, or close owned jobs only" });
      }
    }

    try {
      const updated = await updateJob(id, {
        ...(actionStatus[action] ? { status: actionStatus[action] } : {}),
        ...(flagPatch[action] || {}),
        moderationReason: reason || existing.moderationReason || "",
      });
      if (!updated) {
        return res.status(404).json({ error: "Job opening not found" });
      }
      const notificationAction = action === "publish" ? "published" : action === "pause" ? "paused" : action === "resume" ? "resumed" : action;
      await emitJobActionNotification(updated, notificationAction, user);
      res.json({ job: updated });
    } catch (err) {
      return handleJobServiceError(res, err);
    }
  });

  app.delete("/api/jobs/:id", async (req, res) => {
    const user = await getActiveUser(req);
    if (!user || user.role !== "admin") {
      return res.status(403).json({ error: "Only admins can delete jobs" });
    }

    const { id } = req.params;
    let existing: Job | null = null;
    try {
      existing = await getJobById(id);
      if (!existing) {
        return res.status(404).json({ error: "Job opening not found" });
      }
      await deleteJob(id);
      await emitJobActionNotification(existing, "deleted", user);
      res.json({ ok: true });
    } catch (err) {
      return handleJobServiceError(res, err);
    }
  });

  // --- CANDIDATE PROFILE ENDPOINTS ---

  app.get("/api/candidates/:userId", async (req, res) => {
    const user = await getActiveUser(req);
    if (!user || user.role !== "candidate" || user.id !== req.params.userId) {
      return res.status(403).json({ error: "Candidate profile access denied" });
    }

    const { userId } = req.params;

    try {
      const profile = await getProfileByUserId(userId);
      if (!profile) {
        return res.status(404).json({ error: "Candidate profile dataset not found" });
      }
      profile.profilePhotoUrl = await getUserProfilePhotoUrl(user.id, profile.id);
      if (profile.resumeUrl) {
        profile.resumeUrl = await resolveStorageUrl(profile.resumeUrl) || profile.resumeUrl;
      }
      res.json({ profile });
    } catch (err) {
      return handleCandidateProfileServiceError(res, err);
    }
  });

  app.post("/api/candidates/profile/photo", async (req, res) => {
    const user = await getActiveUser(req);
    if (!user || user.role !== "candidate") {
      return res.status(403).json({ error: "Candidate identity required" });
    }

    try {
      const profile = await getProfileByUserId(user.id)
        || await createProfile({ userId: user.id, education: "", skills: [], experience: "", resumeText: "", resumeFileName: "", resumeUrl: "" });

      const { base64, fileName, mimeType } = req.body as { base64?: string; fileName?: string; mimeType?: string };
      if (!base64) {
        return res.status(400).json({ error: "Profile photo payload is missing." });
      }
      const base64Data = base64.includes(",") ? base64.split(",")[1] : base64;
      const photoUrl = await uploadUserProfilePhotoToStorage(
        user.id,
        fileName || "profile-photo.jpg",
        mimeType || "image/jpeg",
        Buffer.from(base64Data, "base64"),
        profile.id
      );
      profile.profilePhotoUrl = photoUrl;
      res.json({ profilePhotoUrl: photoUrl, profile });
    } catch (err: unknown) {
      const errorLike = err as { message?: string; statusCode?: unknown };
      const status = typeof errorLike.statusCode === "number" ? errorLike.statusCode : 500;
      logger.error("candidate-profiles", "profile photo upload failed", err, { requestId: String(res.locals.requestId || '') });
      res.status(status).json({ error: errorLike.message || "Profile photo upload failed" });
    }
  });

  app.delete("/api/candidates/profile/photo", async (_req, res) => {
    const user = await getActiveUser(_req);
    if (!user || user.role !== "candidate") {
      return res.status(403).json({ error: "Candidate identity required" });
    }

    try {
      const profile = await getProfileByUserId(user.id);
      if (!profile) {
        return res.status(404).json({ error: "Profile node absent" });
      }
      await removeUserProfilePhotos(user.id, profile.id);
      res.json({ profilePhotoUrl: "" });
    } catch (err) {
      logger.error("candidate-profiles", "profile photo removal failed", err, { requestId: String(res.locals.requestId || '') });
      return handleCandidateProfileServiceError(res, err);
    }
  });

  app.post("/api/users/profile/photo", async (req, res) => {
    const user = await getActiveUser(req);
    if (!user) {
      return res.status(403).json({ error: "Authenticated user required" });
    }

    try {
      const legacyProfileId = user.role === "candidate" ? (await getProfileByUserId(user.id))?.id : undefined;
      const { base64, fileName, mimeType } = req.body as { base64?: string; fileName?: string; mimeType?: string };
      if (!base64) {
        return res.status(400).json({ error: "Profile photo payload is missing." });
      }
      const base64Data = base64.includes(",") ? base64.split(",")[1] : base64;
      const profilePhotoUrl = await uploadUserProfilePhotoToStorage(
        user.id,
        fileName || "profile-photo.jpg",
        mimeType || "image/jpeg",
        Buffer.from(base64Data, "base64"),
        legacyProfileId
      );

      res.json({ profilePhotoUrl, user: await hydrateUserProfilePhoto(user) });
    } catch (err: unknown) {
      const errorLike = err as { message?: string; statusCode?: unknown };
      const status = typeof errorLike.statusCode === "number" ? errorLike.statusCode : 500;
      logger.error("users", "profile photo upload failed", err, { requestId: String(res.locals.requestId || '') });
      res.status(status).json({ error: errorLike.message || "Profile photo upload failed" });
    }
  });

  app.delete("/api/users/profile/photo", async (req, res) => {
    const user = await getActiveUser(req);
    if (!user) {
      return res.status(403).json({ error: "Authenticated user required" });
    }

    try {
      const legacyProfileId = user.role === "candidate" ? (await getProfileByUserId(user.id))?.id : undefined;
      await removeUserProfilePhotos(user.id, legacyProfileId);
      res.json({ profilePhotoUrl: "", user: await hydrateUserProfilePhoto(user) });
    } catch (err) {
      logger.error("users", "profile photo removal failed", err, { requestId: String(res.locals.requestId || '') });
      return handleUserServiceError(res, err);
    }
  });

  app.post("/api/candidates/profile/update", async (req, res) => {
    const user = await getActiveUser(req);
    if (!user || user.role !== "candidate") {
      return res.status(403).json({ error: "Candidate identity required" });
    }

    try {
      const currentProfile = await getProfileByUserId(user.id);
      if (!currentProfile) {
        return res.status(404).json({ error: "Profile node absent" });
      }

      const { education, experience, skills, resumeText, resumeFileName } = req.body;
      let finalSkills = skills;
      if (typeof skills === "string") {
        finalSkills = skills.split(",").map((s: string) => s.trim()).filter(Boolean);
      }

      const updated = await updateProfile(currentProfile.id, {
        education: education !== undefined ? education : currentProfile.education,
        experience: experience !== undefined ? experience : currentProfile.experience,
        skills: Array.isArray(finalSkills) ? finalSkills : currentProfile.skills,
        resumeText: resumeText !== undefined ? resumeText : currentProfile.resumeText,
        resumeFileName: resumeFileName !== undefined ? resumeFileName : currentProfile.resumeFileName,
      });

      if (!updated) {
        return res.status(404).json({ error: "Profile node absent" });
      }

      res.json({ profile: updated });
    } catch (err) {
      return handleCandidateProfileServiceError(res, err);
    }
  });

  // --- PDF RESUME EXTRACTION PROTOCOL ---
  app.post("/api/parser/pdf", rateLimit({ keyPrefix: "resume-parser", windowMs: 15 * 60 * 1000, max: 12 }), async (req, res) => {
    try {
      const user = await getActiveUser(req);
      if (!user || user.role !== "candidate") {
        return res.status(401).json({ error: "Candidate identity required to parse files" });
      }

      const { base64, fileName } = req.body;
      if (!base64) {
        return res.status(400).json({ error: "PDF base64 stream is missing." });
      }
      const parseStarted = Date.now();

      // Extract binary base64
      const base64Data = base64.includes(",") ? base64.split(",")[1] : base64;

      const keyStatus = getGeminiApiKeyStatus();
      const currentProfile = await getProfileByUserId(user.id)
        || await createProfile({ userId: user.id, education: "", skills: [], experience: "", resumeText: "", resumeFileName: "", resumeUrl: "" });
      const geminiGenerate = keyStatus === "configured"
        ? async (pdfData: string) => {
          const ai = getGeminiClient();
          const response = await withTimeout(ai.models.generateContent({
            model: "gemini-3.5-flash",
            contents: [
              {
                inlineData: {
                  mimeType: "application/pdf",
                  data: pdfData
                }
              },
              `Extract this candidate resume into strict JSON only. Use this exact shape:
{
  "name": "",
  "email": "",
  "phone": "",
  "location": "",
  "skills": [],
  "education": [{ "institution": "", "degree": "", "field": "", "startDate": "", "endDate": "" }],
  "experience": [{ "company": "", "role": "", "startDate": "", "endDate": "", "summary": "" }],
  "certifications": [],
  "projects": [{ "name": "", "description": "", "technologies": [] }],
  "links": { "linkedin": "", "github": "", "portfolio": "" }
}
Return no markdown, comments, or prose.`
            ]
          }), 18000, "Gemini resume parsing timed out");
          return response.text || "";
        }
        : undefined;

      if (keyStatus !== "configured") {
        logger.warn("resume-parser", "Gemini layer skipped; local parsing will continue", { keyStatus });
      }

      const result = await runResumeIntelligencePipeline({
        base64Data,
        fileName: fileName || "resume.pdf",
        currentProfile,
        geminiGenerate,
      });

      let resumeUrl = "";
      try {
        resumeUrl = await uploadResumeToStorage(
          user.id,
          currentProfile.id,
          fileName || "resume.pdf",
          Buffer.from(base64Data, "base64")
        );
        result.autofill = result.autofill || { applied: {}, suggestions: {} };
        result.autofill.applied.resumeUrl = resumeUrl;
      } catch (storageErr) {
        logger.error("resume-parser", "resume storage upload failed", storageErr, {
          requestId: String(res.locals.requestId || ''),
          bucket: getResumeBucket(),
          fileName: fileName || "resume.pdf",
        });
        result.parser.warnings.push("Resume parsed, but PDF storage upload could not be completed.");
      }

      if (result.autofill && Object.keys(result.autofill.applied).length > 0) {
        try {
          const updatedProfile = await updateProfile(currentProfile.id, result.autofill.applied);
          if (updatedProfile) {
            result.autofill.applied = {
              education: result.autofill.applied.education,
              experience: result.autofill.applied.experience,
              skills: result.autofill.applied.skills,
              resumeText: result.autofill.applied.resumeText,
              resumeFileName: result.autofill.applied.resumeFileName,
              resumeUrl: result.autofill.applied.resumeUrl,
            };
          }
        } catch (profileErr) {
          logger.error("resume-parser", "profile autofill failed after parse", profileErr, { requestId: String(res.locals.requestId || '') });
          result.parser.warnings.push("Resume parsed, but profile autofill could not be saved.");
        }
      }
      logger.info("resume-parser", "resume parsed", {
        requestId: String(res.locals.requestId || ''),
        primaryLayer: result.parser.primaryLayer,
        confidence: result.confidence.overallConfidence,
        warningCount: result.parser.warnings.length,
        durationMs: Date.now() - parseStarted,
      });
      res.json(result);
    } catch (e: unknown) {
      logger.error("resume-parser", "PDF parser request failed", e, { requestId: String(res.locals.requestId || '') });
      const errorLike = e as { message?: string; statusCode?: unknown; warnings?: unknown; errors?: unknown };
      const message = errorLike.message || "Failed to process the PDF.";
      const status = typeof errorLike.statusCode === "number" ? errorLike.statusCode : 500;
      res.status(status).json({
        error: message,
        warnings: Array.isArray(errorLike.warnings) ? errorLike.warnings : undefined,
        errors: Array.isArray(errorLike.errors) ? errorLike.errors : undefined,
      });
    }
  });

  // --- CANDIDATE RECRUTIMENT / APPLICATIONS PIPELINE ---

  app.get("/api/applications", async (req, res) => {
    const user = await getActiveUser(req);
    if (!user) {
      return res.status(401).json({ error: "Unauthorized access" });
    }

    if (user.role === "admin") {
      // Admin sees everything
      try {
        const applications = await hydrateApplicationsWithProfilePhotos(await getAllApplications());
        return res.json({ applications });
      } catch (err) {
        return handleApplicationServiceError(res, err);
      }
    } else if (user.role === "candidate") {
      // Find candidate profile
      let candProfile: CandidateProfile | null = null;
      try {
        candProfile = await getProfileByUserId(user.id);
      } catch (err) {
        return handleCandidateProfileServiceError(res, err);
      }
      if (!candProfile) {
        return res.json({ applications: [] });
      }
      try {
        const applications = await hydrateApplicationsWithProfilePhotos(await getApplicationsByCandidate(candProfile.id));
        return res.json({ applications });
      } catch (err) {
        return handleApplicationServiceError(res, err);
      }
    } else if (user.role === "company") {
      // Company HR sees only application records that are "forwarded" to their company
      let company: Company | null = null;
      try {
        company = await getCompanyByUserId(user.id);
      } catch (err) {
        return handleCompanyServiceError(res, err);
      }
      if (!company) {
        return res.json({ applications: [] });
      }
      // CRITICAL PRD rule: "Company HR sees only forwarded candidates"
      try {
        const applications = await hydrateApplicationsWithProfilePhotos(await getApplicationsByCompany(company.id));
        return res.json({ applications });
      } catch (err) {
        return handleApplicationServiceError(res, err);
      }
    }

    res.json({ applications: [] });
  });

  // Smart matching and application trigger
  app.post("/api/applications/apply", async (req, res) => {
    const user = await getActiveUser(req);
    if (!user || user.role !== "candidate") {
      return res.status(403).json({ error: "Access limited to Job Candidates" });
    }

    const { jobId, uploadedResumeText, uploadedResumeName } = req.body;
    if (!jobId) {
      return res.status(400).json({ error: "Job ID identifier is required" });
    }

    let targetJob: Job | null = null;
    try {
      targetJob = await getJobById(jobId);
    } catch (err) {
      return handleJobServiceError(res, err);
    }
    if (!targetJob) {
      return res.status(404).json({ error: "Job specification mismatch" });
    }

    let candProfile: CandidateProfile | null = null;
    try {
      candProfile = await getProfileByUserId(user.id);
    } catch (err) {
      return handleCandidateProfileServiceError(res, err);
    }
    if (!candProfile) {
      return res.status(404).json({ error: "Please complete profile configuration before applying" });
    }

    // Is there already an application for this candidate to this job? Let's remove the old one first so they can re-apply and update their resume/score.
    try {
      await deleteApplicationsByCandidateAndJob(candProfile.id, targetJob.id);
    } catch (err) {
      return handleApplicationServiceError(res, err);
    }

    // Determine target resume text to parsing
    const textToParse = (uploadedResumeText || candProfile.resumeText || candProfile.experience + " " + candProfile.education).trim();
    const fileName = uploadedResumeName || candProfile.resumeFileName || "profile_summary_info.pdf";

    if (!textToParse) {
      return res.status(400).json({ error: "Please upload a resume or fill out your profile details with skills." });
    }

    // Parse skills from text using weighted match score
    // Case-insensitive substring match with boundary checks
    const targetSkills = targetJob.requirements.concat(targetJob.preferredSkills || []);
    const matchedSkills: string[] = [];
    const missingSkills: string[] = [];

    // Simple robust keyword finder
    targetJob.requirements.forEach(skill => {
      const escaped = skill.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
      // Create a regex to match the skill. Avoid internal sub-word mismatches by asserting string boundaries, or clean sub-words for technical terms
      const regex = new RegExp(`(?:\\b|\\s|\\W)${escaped}(?:\\b|\\s|\\W)`, 'gi');
      
      if (regex.test(textToParse) || candProfile.skills.some(s => s.toLowerCase() === skill.toLowerCase())) {
        matchedSkills.push(skill);
      } else {
        missingSkills.push(skill);
      }
    });

    // Score based on mandatory requirements
    let matchScore = 0;
    if (targetJob.requirements.length > 0) {
      matchScore = Math.round((matchedSkills.length / targetJob.requirements.length) * 100);
      if (matchScore > 92) matchScore = 92;
    } else {
      matchScore = 0;
    }

    // Update candidate profile auto-skills with matched skills if empty
    const profileUpdates: {
      skills?: string[];
      resumeText?: string;
      resumeFileName?: string;
    } = {};
    if (candProfile.skills.length === 0) {
      profileUpdates.skills = matchedSkills;
    }
    if (uploadedResumeText) {
      profileUpdates.resumeText = uploadedResumeText;
      profileUpdates.resumeFileName = fileName;
    }
    if (Object.keys(profileUpdates).length > 0) {
      try {
        const updatedProfile = await updateProfile(candProfile.id, profileUpdates);
        if (updatedProfile) {
          candProfile = updatedProfile;
        }
      } catch (err) {
        return handleCandidateProfileServiceError(res, err);
      }
    }

    const newAppInput: Application = {
      id: `a-${Date.now()}`,
      candidateId: candProfile.id,
      candidateName: user.name,
      candidateEmail: user.email,
      jobId: targetJob.id,
      jobTitle: targetJob.title,
      companyId: targetJob.companyId,
      companyName: targetJob.companyName,
      score: matchScore,
      matchedSkills,
      missingSkills,
      status: "applied",
      notes: "",
      appliedAt: new Date().toISOString()
    };

    let newApp: Application;
    try {
      newApp = await createApplication(newAppInput);
    } catch (err) {
      return handleApplicationServiceError(res, err);
    }

    let applicationCompany: Company | null = null;
    try {
      applicationCompany = await getCompanyById(targetJob.companyId);
    } catch (err) {
      logger.error("communication", "failed to load company for application notification", err);
    }

    const communication = await emitCommunicationEvent({
      eventType: "OPPORTUNITY_APPLIED",
      notifications: [
        {
          recipientId: "all_admin",
          title: "New Application Received",
          message: `${user.name} applied for "${targetJob.title}" at ${targetJob.companyName} (Match Scored: ${matchScore}%).`,
          type: "info",
        },
        {
          recipientId: user.id,
          title: "Application Submitted",
          message: `Your application for "${targetJob.title}" at ${targetJob.companyName} was submitted with ${matchScore}% alignment.`,
          type: "success",
        },
        ...(applicationCompany?.userId ? [{
          recipientId: applicationCompany.userId,
          title: "New Candidate Application",
          message: `${user.name} applied for "${targetJob.title}" with ${matchScore}% alignment. Persevex review will route qualified profiles.`,
          type: "info" as const,
        }] : []),
      ],
      emails: [
        {
          userId: user.id,
          recipientEmail: user.email,
          recipientName: user.name,
          subject: `Application submitted: ${targetJob.title}`,
          html: emailTemplates.applicationSubmitted(user.name, targetJob.title, targetJob.companyName, matchScore),
        },
        ...(applicationCompany?.companyEmail ? [{
          userId: applicationCompany.userId,
          recipientEmail: applicationCompany.companyEmail,
          recipientName: applicationCompany.contactPerson || applicationCompany.companyName,
          subject: `New application received: ${targetJob.title}`,
          html: emailTemplates.applicationSubmitted(user.name, targetJob.title, targetJob.companyName, matchScore),
        }] : []),
      ],
      metadata: { applicationId: newApp.id, jobId: targetJob.id, score: matchScore },
    });

    res.json({
      application: {
        ...newApp,
        candidateProfilePhotoUrl: await getUserProfilePhotoUrl(user.id, candProfile.id),
      },
      score: matchScore,
      matchedSkills,
      missingSkills,
      communication: {
        notificationCount: communication.notifications.length,
        emailCount: communication.emails.length,
        failures: communication.failures,
      },
      activityHistory: [
        { label: "Application created", timestamp: newApp.appliedAt, detail: `Application ID ${newApp.id}` },
        { label: "Notification queued", timestamp: new Date().toISOString(), detail: `${communication.notifications.length} notification(s) recorded` },
        { label: "Email event logged", timestamp: new Date().toISOString(), detail: `${communication.emails.length} email log(s) recorded` },
      ],
    });
  });

  // Update application status (Admin screen candidate OR Company schedule Interview/Result)
  app.post("/api/applications/:id/status", async (req, res) => {
    const user = await getActiveUser(req);
    if (!user) {
      return res.status(401).json({ error: "Access token missing" });
    }

    const { id } = req.params;
    const { status, interviewDate, finalResult, rejectionReason } = req.body as { 
      status: ApplicationStatus; 
      interviewDate?: string; 
      finalResult?: "hired" | "rejected" | "withdrawn"; 
      rejectionReason?: string 
    };

    let currentApp: Application | null = null;
    try {
      currentApp = await getApplicationById(id);
    } catch (err) {
      return handleApplicationServiceError(res, err);
    }
    if (!currentApp) {
      return res.status(404).json({ error: "Application file not found" });
    }

    const validStatuses: ApplicationStatus[] = ["applied", "under_review", "shortlisted", "forwarded", "interviewing", "selected", "rejected"];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: "Invalid application status" });
    }

    // Authorization checks
    if (user.role === "candidate") {
      return res.status(403).json({ error: "Candidates are forbidden from updating status hierarchies." });
    }

    if (user.role === "company") {
      let company: Company | null = null;
      try {
        company = await getCompanyByUserId(user.id);
      } catch (err) {
        return handleCompanyServiceError(res, err);
      }
      if (!company || company.id !== currentApp.companyId) {
        return res.status(403).json({ error: "Application does not belong to your company" });
      }
      // Company can only change status once it is already forwarded, and only to interview, reject or hire
      if (!["forwarded", "interviewing", "selected", "rejected"].includes(currentApp.status)) {
        return res.status(403).json({ error: "Candidate must be forwarded by Persevex before company reviews" });
      }
      if (!["interviewing", "selected", "rejected"].includes(status)) {
        return res.status(400).json({ error: "Invalid status option for Company HR role." });
      }
    } else if (user.role !== "admin") {
      return res.status(403).json({ error: "Unauthorized application workflow role" });
    }

    const previousStatus = currentApp.status;
    try {
      const updatedApplication = await updateApplicationStatus(id, {
        status,
        interviewDate,
        finalResult,
        rejectionReason,
      });
      if (!updatedApplication) {
        return res.status(404).json({ error: "Application file not found" });
      }
      currentApp = updatedApplication;
    } catch (err) {
      return handleApplicationServiceError(res, err);
    }

    // Trigger Candidate notifications & Automated Email Alerts
    let targetUserId: string | undefined;
    try {
      targetUserId = (await getProfileById(currentApp.candidateId))?.userId;
    } catch (err) {
      logger.error("candidate-profiles", "failed to load candidate for status notification", err);
    }
    if (targetUserId) {
      let title = "Application Update";
      let msg = `Your profile status for ${currentApp.jobTitle} changed to ${status.replace("_", " ")}.`;

      if (status === "shortlisted") {
        title = "Profile Shortlisted by Persevex";
        msg = `Fantastic! The Persevex Admin team shortlisted your resume for "${currentApp.jobTitle}". It is currently undergoing final quality routing before submission.`;
      } else if (status === "forwarded") {
        title = "Profile Forwarded to Corporate HR!";
        msg = `Great news! Persevex Senior Recruiters finalized review and forwarded your credentials to the official hiring team at ${currentApp.companyName}. Keep an eye out for scheduling!`;
        
        // Also fire notification to the company HR Owner
        let targetCompany: Company | null = null;
        try {
          targetCompany = await getCompanyById(currentApp.companyId);
        } catch (err) {
          logger.error("companies", "failed to load company for forwarded application", err);
        }

        const companyOwner = targetCompany?.userId;
        if (companyOwner) {
          await emitCommunicationEvent({
            eventType: "APPLICATION_REVIEWED",
            notifications: [{
              recipientId: companyOwner,
              title: "New Qualified Candidate Forwarded",
              message: `Persevex screened and forwarded a prime match for "${currentApp.jobTitle}": ${currentApp.candidateName} (Score: ${currentApp.score}%). View candidates in your pipeline.`,
              type: "success",
            }],
            metadata: { applicationId: currentApp.id, status },
          });
        }

        // Send Corporate HR Owner an automated email notification!
        if (targetCompany && targetCompany.companyEmail) {
          const compSubject = `[Candidate Forwarded] Persevex matched a candidate for your role - ${currentApp.jobTitle}`;
          const compBody = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden;">
              <div style="background-color: #0f172a; color: white; padding: 24px; text-align: center;">
                <h1 style="margin: 0; font-size: 20px; font-weight: bold;">PERSEVEX PARTNER HUB</h1>
              </div>
              <div style="padding: 24px; color: #1e293b; background-color: #ffffff; line-height: 1.6;">
                <h3 style="margin-top: 0;">Dear ${targetCompany.contactPerson || 'Hiring Team'},</h3>
                <p>We are delighted to inform you that our Senior Recruiters have completed their screening process and forwarded a highly qualified matching candidate for your active role:</p>
                
                <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin: 20px 0;">
                  <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
                    <tr>
                      <td style="padding: 4px 0; font-weight: 600; color: #64748b; width: 120px;">Position:</td>
                      <td style="padding: 4px 0; font-weight: bold; color: #0f172a;">${currentApp.jobTitle}</td>
                    </tr>
                    <tr>
                      <td style="padding: 4px 0; font-weight: 600; color: #64748b;">Candidate:</td>
                      <td style="padding: 4px 0; font-weight: bold; color: #0f172a;">${currentApp.candidateName}</td>
                    </tr>
                    <tr>
                      <td style="padding: 4px 0; font-weight: 600; color: #64748b;">Match Index Score:</td>
                      <td style="padding: 4px 0;"><span style="background-color: #dcfce7; color: #15803d; padding: 2px 8px; border-radius: 9999px; font-weight: bold;">${currentApp.score}% Match</span></td>
                    </tr>
                    <tr>
                      <td style="padding: 4px 0; font-weight: 600; color: #64748b;">Matched Skills:</td>
                      <td style="padding: 4px 0; color: #0f172a; font-family: monospace;">${currentApp.matchedSkills.join(', ')}</td>
                    </tr>
                  </table>
                </div>
                
                <p>The candidate's credentials and analyzed resume details are now fully active on your Recruiting Dashboard. You can trigger direct scheduling, record notes, or mark final hiring decisions there.</p>
                
                <hr style="border: 0; border-top: 1px solid #f1f5f9; margin: 24px 0;" />
                <div style="text-align: center;">
                  <span style="font-size: 11px; color: #94a3b8; display: block; margin-bottom: 8px;">Triggered dynamically by Persevex Status Change System</span>
                </div>
              </div>
            </div>
          `;
          await triggerEmailAlert(
            targetCompany.companyEmail,
            targetCompany.contactPerson || "Corporate Recruiter",
            compSubject,
            compBody,
            `Application of ${currentApp.candidateName} forwarded to company`
          );
        }
      } else if (status === "interviewing") {
        title = "Interview Scheduled!";
        msg = `The hiring manager at ${currentApp.companyName} checked your profile and scheduled an interview. Details: ${interviewDate || 'To be communicated soon'}.`;
      } else if (status === "selected") {
        title = "Congratulations! Direct Job Offer!";
        msg = `Excellent news! The hiring manager at ${currentApp.companyName} selected you and marked your application as HIRED for "${currentApp.jobTitle}"!`;
      }

      // Add push notification inside platform DB
      const eventType = status === "interviewing"
        ? "INTERVIEW_SCHEDULED"
        : status === "selected"
          ? "APPLICATION_ACCEPTED"
          : status === "rejected"
            ? "APPLICATION_REJECTED"
            : "APPLICATION_REVIEWED";
      await emitCommunicationEvent({
        eventType,
        notifications: [{
          recipientId: targetUserId,
          title,
          message: msg,
          type: status === "rejected" ? "warning" : status === "selected" || status === "interviewing" ? "success" : "info",
        }],
        metadata: { applicationId: currentApp.id, previousStatus, status },
      });

      // Dispatch automated candidate email alert safely!
      if (currentApp.candidateEmail) {
        let emailSubject = `Application Update: ${currentApp.jobTitle}`;
        let emailTemplate = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
            <div style="background-color: #10b981; color: white; padding: 24px; text-align: center;">
              <h1 style="margin: 0; font-size: 20px; font-weight: bold; letter-spacing: -0.025em;">PERSEVEX CAREER HUB</h1>
              <p style="margin: 4px 0 0 0; font-size: 12px; opacity: 0.9; text-transform: uppercase; font-family: monospace;">Automated Alert System</p>
            </div>
            <div style="padding: 24px; color: #1e293b; background-color: #ffffff; line-height: 1.6;">
              <h3 style="margin-top: 0; font-size: 16px; font-weight: 600;">Dear ${currentApp.candidateName},</h3>
              <p>Your application status for the position of <strong>${currentApp.jobTitle}</strong> at <strong>${currentApp.companyName}</strong> has been updated to:</p>
              <div style="background-color: #f1f5f9; border-left: 4px solid #10b981; padding: 12px 16px; margin: 20px 0; border-radius: 0 8px 8px 0;">
                <span style="font-size: 11px; text-transform: uppercase; font-weight: bold; color: #64748b; letter-spacing: 0.1em; display: block;">New Workflow Phase</span>
                <span style="font-size: 18px; font-weight: 700; color: #0fa26e; text-transform: capitalize;">${status.replace("_", " ")}</span>
              </div>
              
              <div style="margin: 15px 0; font-size: 14px; text-align: left; background: #fafafa; border: 1px solid #eaeaea; padding: 15px; border-radius: 8px;">
                ${
                  status === "shortlisted" 
                  ? "<p style='margin:0;'>The Persevex expert team evaluated your credentials against the job parameters and verified your high qualification match score. We have shortlisted your candidacy and prepared submission folders for Corporate HR managers.</p>"
                  : status === "forwarded"
                  ? `<p style='margin:0;'>Outstanding news! We completed candidate routing and forwarded your credentials immediately to the selection committee at <strong>${currentApp.companyName}</strong>. Their HR managers can now view your structured index, experience timelines, and resume PDF fields.</p>`
                  : status === "interviewing"
                  ? `<p style='margin:0;'>Get ready! The recruiting team at <strong>${currentApp.companyName}</strong> has approved your resume and scheduled an interview event. Details listed on Persevex Portal: <em>${interviewDate || 'To be communicated soon'}</em>.</p>`
                  : status === "selected"
                  ? `<p style='margin:0;'>Congratulations! After strict corporate review, the hiring leaders at <strong>${currentApp.companyName}</strong> selected your profile and offered the role! Please visit the dashboard on the Persevex Portal to verify and check follow-up parameters.</p>`
                  : status === "rejected"
                  ? `<p style='margin:0;'>Thank you for participating in the screening pipeline. The corporate hiring managers reviewed your match indexes and decided to proceed with other matching candidates at this stage. We kept your resume active in the general pool for immediate lateral placement!</p>`
                  : `<p style='margin:0;'>Your profile is currently under reviewer evaluation for the matching pipeline in our candidate database.</p>`
                }
              </div>
              
              <hr style="border: 0; border-top: 1px solid #f1f5f9; margin: 24px 0;" />
              <p style="font-size: 12px; color: #64748b; margin-bottom: 0;">Please sign in to the Persevex portal to view real-time status details.</p>
            </div>
            <div style="background-color: #f8fafc; padding: 16px; text-align: center; border-top: 1px solid #f1f5f9; font-size: 11px; color: #94a3b8;">
              You are receiving this automated career updates pipeline alert because you are registered on Persevex.<br />
              &copy; 2026 Persevex HR Systems Inc., Seattle Corporate HQ
            </div>
          </div>
        `;

        if (status === "shortlisted") {
          emailSubject = `[Persevex Careers] Shortlisted Candidate: ${currentApp.jobTitle}`;
        } else if (status === "forwarded") {
          emailSubject = `[Persevex Careers] Profile Forwarded to HR Team at ${currentApp.companyName}`;
        } else if (status === "interviewing") {
          emailSubject = `[Interview Alert] ${currentApp.companyName} scheduled interview for ${currentApp.jobTitle}`;
        } else if (status === "selected") {
          emailSubject = `[OFFER INCOMING] Congratulations! Job Offer from ${currentApp.companyName}`;
        } else if (status === "rejected") {
          emailSubject = `[Application Status Update] ${currentApp.jobTitle}`;
        }

        await triggerEmailAlert(
          currentApp.candidateEmail,
          currentApp.candidateName,
          emailSubject,
          emailTemplate,
          `Status changed from ${previousStatus} to ${status}`
        );
      }
    }

    res.json({ application: currentApp });
  });

  // Admin writes review notes
  app.post("/api/applications/:id/notes", async (req, res) => {
    const user = await getActiveUser(req);
    if (!user || user.role !== "admin") {
      return res.status(403).json({ error: "Admin account required" });
    }

    const { id } = req.params;
    const { notes } = req.body;

    try {
      const application = await updateApplicationNotes(id, notes || "");
      if (!application) {
        return res.status(404).json({ error: "Application dossier not found" });
      }
      return res.json({ application });
    } catch (err) {
      return handleApplicationServiceError(res, err);
    }
  });

  // --- NOTIFICATIONS SYSTEM ---

  app.get("/api/notifications", async (req, res) => {
    const user = await getActiveUser(req);
    if (!user) {
      return res.status(401).json({ error: "Access token missing" });
    }

    try {
      const limit = req.query.limit ? Number(req.query.limit) : undefined;
      const offset = req.query.offset ? Number(req.query.offset) : undefined;
      const unreadOnly = req.query.unreadOnly === "true";
      const type = typeof req.query.type === "string" ? req.query.type as "info" | "success" | "warning" | "error" : undefined;
      const notifications = await getNotificationsByUser(user.id, user.role, {
        limit: Number.isFinite(limit) ? limit : undefined,
        offset: Number.isFinite(offset) ? offset : undefined,
        unreadOnly,
        type,
      });
      const unreadCount = await getUnreadCount(user.id, user.role);
      res.json({ notifications, unreadCount, pagination: { limit: limit || null, offset: offset || 0 } });
    } catch (err) {
      return handleNotificationServiceError(res, err);
    }
  });

  app.post("/api/notifications/:id/read", async (req, res) => {
    const user = await getActiveUser(req);
    if (!user) {
      return res.status(401).json({ error: "Access token missing" });
    }

    const { id } = req.params;
    try {
      const notification = await getNotificationById(id);
      if (!notification) {
        return res.status(404).json({ error: "Notification not found" });
      }
      if (!canAccessNotification(user, notification)) {
        return res.status(403).json({ error: "Notification access denied" });
      }
      await markAsRead(id);
      res.sendStatus(200);
    } catch (err) {
      return handleNotificationServiceError(res, err);
    }
  });

  app.post("/api/notifications/read-all", async (req, res) => {
    const user = await getActiveUser(req);
    if (!user) return res.sendStatus(401);

    try {
      const notifications = await getNotificationsByUser(user.id, user.role);
      for (const notification of notifications) {
        await markAsRead(notification.id);
      }
      res.sendStatus(200);
    } catch (err) {
      return handleNotificationServiceError(res, err);
    }
  });

  // --- AUTOMATED EMAIL ALERTS SERVICE ---
  app.get("/api/email-alerts", async (req, res) => {
    const user = await getActiveUser(req);
    if (!user) {
      return res.status(401).json({ error: "Access token missing" });
    }

    if (user.role === "admin") {
      try {
        const emailAlerts = await getEmailLogs();
        return res.json({ emailAlerts });
      } catch (err) {
        return handleEmailLogServiceError(res, err);
      }
    } else {
      const targetEmails = [user.email.toLowerCase()];
      
      if (user.role === "candidate") {
        try {
          const profile = await getProfileByUserId(user.id);
          if (profile) {
            const candidateApplications = await getApplicationsByCandidate(profile.id);
            const appWithCandidateEmail = candidateApplications.find(a => Boolean(a.candidateEmail));
            if (appWithCandidateEmail && appWithCandidateEmail.candidateEmail) {
              targetEmails.push(appWithCandidateEmail.candidateEmail.toLowerCase());
            }
          }
        } catch (err) {
          return handleApplicationServiceError(res, err);
        }
      } else if (user.role === "company") {
        try {
          const company = await getCompanyByUserId(user.id);
          if (company) {
            targetEmails.push(company.companyEmail.toLowerCase());
          }
        } catch (err) {
          return handleCompanyServiceError(res, err);
        }
      }

      try {
        const emailAlerts = (await getEmailLogs()).filter(e =>
          targetEmails.includes(e.recipientEmail.toLowerCase())
        );
        return res.json({ emailAlerts });
      } catch (err) {
        return handleEmailLogServiceError(res, err);
      }
    }
  });

  app.post("/api/email-alerts/:id/retry", async (req, res) => {
    const user = await getActiveUser(req);
    if (!user) {
      return res.status(401).json({ error: "Access token missing" });
    }
    if (user.role !== "admin") {
      return res.status(403).json({ error: "Requires administrator access" });
    }

    try {
      const email = await getEmailLogById(req.params.id);
      if (!email) {
        return res.status(404).json({ error: "Email log not found" });
      }
      const updated = await retryEmailLog(email);
      return res.json({ emailAlert: updated });
    } catch (err) {
      return handleEmailLogServiceError(res, err);
    }
  });

  app.get("/api/users", async (req, res) => {
    const user = await getActiveUser(req);
    if (!user) return res.status(401).json({ error: "Access token missing" });
    if (user.role !== "admin") {
      return res.status(403).json({ error: "Requires administrator access" });
    }

    try {
      const users = await hydrateUsersProfilePhotos(await getAllUsers());
      return res.json({ users });
    } catch (err) {
      return handleUserServiceError(res, err);
    }
  });

  // --- PLATFORM ANALYTICS DASHBBOARD DATA ---

  app.get("/api/analytics/summary", async (req, res) => {
    const user = await getActiveUser(req);
    if (!user) return res.status(401).json({ error: "Access token missing" });
    if (user.role !== "admin") {
      return res.status(403).json({ error: "Requires administrator access" });
    }

    let companies: Company[] = [];
    try {
      companies = await getAllCompanies();
    } catch (err) {
      return handleCompanyServiceError(res, err);
    }

    const totalCompanies = companies.length;
    const verifiedCompanies = companies.filter(c => c.verificationStatus === "approved").length;
    const pendingVerifications = companies.filter(c => c.verificationStatus === "pending").length;
    
    let allJobs: Job[] = [];
    try {
      allJobs = await getAllJobs();
    } catch (err) {
      return handleJobServiceError(res, err);
    }

    const totalJobs = allJobs.length;
    const pendingJobs = allJobs.filter(j => j.status === "submitted").length;
    const approvedJobs = allJobs.filter(j => j.status === "approved").length;

    let allApplications: Application[] = [];
    try {
      allApplications = await getAllApplications();
    } catch (err) {
      return handleApplicationServiceError(res, err);
    }

    const totalApplications = allApplications.length;
    const forwardedApplications = allApplications.filter(a => a.status === "forwarded").length;
    const interviewingApps = allApplications.filter(a => a.status === "interviewing").length;
    const selectedApps = allApplications.filter(a => a.status === "selected" || a.finalResult === "hired").length;

    const now = new Date();
    const monthBuckets = Array.from({ length: 6 }, (_, index) => {
      const date = new Date(now.getFullYear(), now.getMonth() - (5 - index), 1);
      return {
        key: `${date.getFullYear()}-${date.getMonth()}`,
        month: date.toLocaleString("en-US", { month: "short" }),
        applications: 0,
        forwarded: 0,
      };
    });
    const monthIndex = new Map(monthBuckets.map((bucket, index) => [bucket.key, index]));
    for (const application of allApplications) {
      const date = new Date(application.appliedAt);
      const key = `${date.getFullYear()}-${date.getMonth()}`;
      const index = monthIndex.get(key);
      if (index === undefined) continue;
      monthBuckets[index].applications += 1;
      if (application.status === "forwarded") {
        monthBuckets[index].forwarded += 1;
      }
    }

    const jobsByType = allJobs.reduce<Record<string, number>>((groups, job) => {
      groups[job.jobType] = (groups[job.jobType] || 0) + 1;
      return groups;
    }, {});
    const jobsTrend = Object.entries(jobsByType)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);

    const topCompanies = companies.map(c => {
      const jobCount = allJobs.filter(j => j.companyId === c.id).length;
      return { name: c.companyName, jobs: jobCount, verified: c.verificationStatus === "approved" };
    }).sort((a, b) => b.jobs - a.jobs);

    res.json({
      metrics: {
        totalCompanies,
        verifiedCompanies,
        pendingVerifications,
        totalJobs,
        pendingJobs,
        approvedJobs,
        totalApplications,
        forwardedApplications,
        interviewingApps,
        selectedApps
      },
      appsTrend: monthBuckets,
      jobsTrend,
      topCompanies
    });
  });

  // --- CORE ENGINE SPA AND SERVER INTEGRATION MIDDLEWARE ---

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, HOST, () => {
    const displayHost = HOST === "0.0.0.0" ? "localhost" : HOST;
    logger.info("startup", "server listening", { url: `http://${displayHost}:${PORT}` });
  });
}

startServer();
