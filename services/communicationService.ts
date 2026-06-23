import type { AppNotification, EmailAlert } from '../src/types';
import { logger } from './logger';
import { branding } from '@/src/config/branding';

export const NOTIFICATION_EVENTS = [
  'WELCOME',
  'PASSWORD_RESET',
  'APPLICATION_SUBMITTED',
  'APPLICATION_REVIEWED',
  'INTERVIEW_SCHEDULED',
  'APPLICATION_REJECTED',
  'APPLICATION_ACCEPTED',
  'JOB_SUBMITTED',
  'JOB_CREATED',
  'JOB_APPROVED',
  'JOB_REJECTED',
  'JOB_PUBLISHED',
  'JOB_PAUSED',
  'JOB_CLOSED',
  'JOB_ARCHIVED',
  'JOB_DELETED',
  'OPPORTUNITY_APPLIED',
  'OPPORTUNITY_UPDATED',
  'COMPANY_APPROVED',
  'COMPANY_REJECTED',
  'PROFILE_UPDATED',
] as const;

export type NotificationEventType = typeof NOTIFICATION_EVENTS[number];

type NotificationTarget = {
  recipientId: string;
  title: string;
  message: string;
  type?: 'info' | 'success' | 'warning' | 'error';
};

type EmailTarget = {
  userId?: string;
  recipientEmail?: string;
  recipientName: string;
  subject: string;
  html: string;
};

export type CommunicationEvent = {
  eventType: NotificationEventType;
  notifications?: NotificationTarget[];
  emails?: EmailTarget[];
  metadata?: Record<string, string | number | boolean | undefined>;
};

type CommunicationResult = {
  notifications: AppNotification[];
  emails: EmailAlert[];
  failures: string[];
};

export function summarizeCommunicationEvent(event: CommunicationEvent) {
  return {
    eventType: event.eventType,
    notificationCount: event.notifications?.length || 0,
    emailCount: event.emails?.length || 0,
    hasInvalidEmail: Boolean(event.emails?.some((email) => !email.recipientEmail || !EMAIL_RE.test(email.recipientEmail))),
  };
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isEmailDeliveryEnabled(): boolean {
  return /^(1|true|yes)$/i.test(process.env.EMAIL_DELIVERY_ENABLED || '');
}

function metadataSuffix(metadata?: CommunicationEvent['metadata']): string {
  if (!metadata || Object.keys(metadata).length === 0) return '';
  return ` | metadata=${JSON.stringify(metadata)}`;
}

function templateShell(title: string, preheader: string, body: string): string {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 640px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden;">
      <div style="background:#0f172a;color:#fff;padding:22px 24px;">
        <h1 style="margin:0;font-size:20px;">${branding.productName}</h1>
        <p style="margin:6px 0 0;font-size:12px;color:#cbd5e1;">${preheader}</p>
      </div>
      <div style="padding:24px;color:#1e293b;background:#fff;line-height:1.6;">
        <h2 style="margin:0 0 12px;font-size:18px;">${title}</h2>
        ${body}
        <p style="margin:22px 0 0;font-size:12px;color:#64748b;">Sign in to ${branding.productName} for the latest workflow state.</p>
      </div>
      <div style="background:#f8fafc;padding:14px 24px;border-top:1px solid #e2e8f0;color:#94a3b8;font-size:11px;">
        Automated ${branding.productName} communication. Please do not reply to this message.
      </div>
    </div>
  `;
}

export const emailTemplates = {
  welcome: (name: string, role: string) => templateShell(
    `Welcome to ${branding.productName}`,
    'Account created',
    `<p>Hi ${name}, your ${role} workspace is ready.</p>`
  ),
  passwordReset: (email: string) => templateShell(
    'Password Reset Requested',
    'Account recovery',
    `<p>A password reset workflow was requested for ${email}. If this was not you, no action is required.</p><p>Please contact the ${branding.productName} team to complete secure recovery.</p>`
  ),
  applicationSubmitted: (candidate: string, jobTitle: string, companyName: string, score: number) => templateShell(
    'Application Submitted',
    'Candidate application received',
    `<p>${candidate} applied for <strong>${jobTitle}</strong> at <strong>${companyName}</strong>.</p><p>Match score: <strong>${score}%</strong>.</p>`
  ),
  applicationReviewed: (candidate: string, jobTitle: string, status: string, details: string) => templateShell(
    'Application Status Updated',
    'Application review update',
    `<p>Hi ${candidate}, your application for <strong>${jobTitle}</strong> moved to <strong>${status}</strong>.</p><p>${details}</p>`
  ),
  interviewInvitation: (candidate: string, jobTitle: string, companyName: string, interviewDate?: string) => templateShell(
    'Interview Scheduled',
    'Interview invitation',
    `<p>Hi ${candidate}, ${companyName} scheduled an interview for <strong>${jobTitle}</strong>.</p><p>Details: <strong>${interviewDate || 'To be communicated soon'}</strong>.</p>`
  ),
  applicationRejected: (candidate: string, jobTitle: string, reason?: string) => templateShell(
    'Application Update',
    'Application decision',
    `<p>Hi ${candidate}, your application for <strong>${jobTitle}</strong> was not selected for the next stage.</p><p>${reason || 'Your profile remains active for other matching roles.'}</p>`
  ),
  applicationAccepted: (candidate: string, jobTitle: string, companyName: string) => templateShell(
    'Application Accepted',
    'Offer workflow',
    `<p>Congratulations ${candidate}. ${companyName} selected you for <strong>${jobTitle}</strong>.</p>`
  ),
  companyDecision: (companyName: string, approved: boolean) => templateShell(
    approved ? 'Company Approved' : 'Company Registration Update',
    'Company verification',
    `<p>${companyName} has been ${approved ? 'approved. You can now publish jobs.' : 'rejected. Please review your documents and contact support.'}</p>`
  ),
  jobDecision: (jobTitle: string, approved: boolean) => templateShell(
    approved ? 'Job Approved' : 'Job Rejected',
    'Job moderation',
    `<p>Your job post <strong>${jobTitle}</strong> has been ${approved ? 'approved and is now live.' : `rejected by ${branding.productName} moderation.`}</p>`
  ),
};

async function deliverEmailIfEnabled(email: EmailTarget): Promise<{ status: EmailAlert['status']; errorMessage?: string }> {
  if (!email.recipientEmail || !EMAIL_RE.test(email.recipientEmail)) {
    return { status: 'failed', errorMessage: 'Missing or invalid recipient email' };
  }

  if (!isEmailDeliveryEnabled()) {
    return { status: 'pending', errorMessage: 'Email delivery disabled; log recorded for retry' };
  }

  const webhookUrl = process.env.EMAIL_WEBHOOK_URL?.trim();
  if (!webhookUrl) {
    return { status: 'failed', errorMessage: 'EMAIL_DELIVERY_ENABLED is true but EMAIL_WEBHOOK_URL is not configured' };
  }

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12000);
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(email),
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!response.ok) {
      return { status: 'failed', errorMessage: `Email provider responded ${response.status}` };
    }
    return { status: 'delivered' };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { status: 'failed', errorMessage: `Email delivery failed: ${message}` };
  }
}

export async function emitCommunicationEvent(event: CommunicationEvent): Promise<CommunicationResult> {
  const started = Date.now();
  const result: CommunicationResult = { notifications: [], emails: [], failures: [] };

  for (const notification of event.notifications || []) {
    try {
      const { createNotification } = await import('./notificationService');
      const created = await createNotification({
        recipientId: notification.recipientId,
        title: notification.title,
        message: notification.message,
        type: notification.type || 'info',
        isRead: false,
      });
      result.notifications.push(created);
      logger.info('notifications', 'notification created', {
        eventType: event.eventType,
        recipientId: notification.recipientId,
        title: notification.title,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      result.failures.push(`notification:${notification.recipientId}:${message}`);
      logger.error('notifications', 'notification creation failed', err, { eventType: event.eventType, recipientId: notification.recipientId });
    }
  }

  for (const email of event.emails || []) {
    const delivery = await deliverEmailIfEnabled(email);
    try {
      const { createEmailLog } = await import('./emailLogService');
      const created = await createEmailLog({
        userId: email.userId,
        recipientEmail: email.recipientEmail || '',
        recipientName: email.recipientName,
        subject: email.subject,
        body: email.html,
        status: delivery.status,
        errorMessage: delivery.errorMessage,
        triggeredByEvent: `${event.eventType}${metadataSuffix(event.metadata)}${delivery.errorMessage ? ` | retryCount=0` : ''}`,
      });
      result.emails.push(created);
      logger.info('email', 'email log recorded', {
        eventType: event.eventType,
        recipientEmail: email.recipientEmail || 'missing-recipient',
        status: delivery.status,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      result.failures.push(`email-log:${email.recipientEmail || 'missing'}:${message}`);
      logger.error('email', 'email log failed', err, { eventType: event.eventType, recipientEmail: email.recipientEmail || 'missing' });
    }
  }

  logger.info('communication', 'event completed', {
    eventType: event.eventType,
    notificationCount: result.notifications.length,
    emailCount: result.emails.length,
    failureCount: result.failures.length,
    durationMs: Date.now() - started,
  });

  return result;
}

export async function retryEmailLog(email: EmailAlert): Promise<EmailAlert | null> {
  const { updateEmailLogStatus } = await import('./emailLogService');
  const delivery = await deliverEmailIfEnabled({
    recipientEmail: email.recipientEmail,
    recipientName: email.recipientName,
    subject: email.subject,
    html: email.body,
  });
  return updateEmailLogStatus(email.id, delivery.status, delivery.errorMessage);
}
