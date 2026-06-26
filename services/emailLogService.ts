import { EmailAlert } from '../src/types';
import { supabaseAdmin } from '../lib/supabase';

type SupabaseEmailLogRow = {
  id: string;
  user_id: string | null;
  recipient: string;
  subject: string;
  template: string;
  status: EmailAlert['status'] | null;
  error_message: string | null;
  created_at: string | null;
  recipient_name: string | null;
  triggered_by_event: string | null;
  is_read: boolean | null;
};

export type CreateEmailLogInput = {
  id?: string;
  userId?: string;
  recipientEmail: string;
  recipientName: string;
  subject: string;
  body: string;
  status?: EmailAlert['status'];
  errorMessage?: string;
  triggeredByEvent: string;
  createdAt?: string;
  isRead?: boolean;
};

const EMAIL_LOG_SELECT =
  'id,user_id,recipient,subject,template,status,error_message,created_at,recipient_name,triggered_by_event,is_read';

function requireSupabaseAdmin() {
  if (!supabaseAdmin) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is required for email log persistence');
  }
  return supabaseAdmin;
}

function mapSupabaseEmailLog(row: SupabaseEmailLogRow): EmailAlert {
  return {
    id: row.id,
    recipientEmail: row.recipient,
    recipientName: row.recipient_name || row.recipient,
    subject: row.subject,
    body: row.template,
    status: row.status || 'pending',
    triggeredByEvent: row.triggered_by_event || row.error_message || 'Email log event',
    createdAt: row.created_at || new Date().toISOString(),
    isRead: Boolean(row.is_read),
  };
}

export async function getEmailLogs(): Promise<EmailAlert[]> {
  const { data, error } = await requireSupabaseAdmin()
    .from('email_logs')
    .select(EMAIL_LOG_SELECT)
    .order('created_at', { ascending: false });

  if (error) {
    throw error;
  }

  return (data || []).map(row => mapSupabaseEmailLog(row as SupabaseEmailLogRow));
}

export async function getEmailLogById(id: string): Promise<EmailAlert | null> {
  const { data, error } = await requireSupabaseAdmin()
    .from('email_logs')
    .select(EMAIL_LOG_SELECT)
    .eq('id', id)
    .maybeSingle<SupabaseEmailLogRow>();

  if (error) {
    throw error;
  }

  return data ? mapSupabaseEmailLog(data) : null;
}

export async function createEmailLog(input: CreateEmailLogInput): Promise<EmailAlert> {
  const id = input.id || `email-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  const createdAt = input.createdAt || new Date().toISOString();
  const { data, error } = await requireSupabaseAdmin()
    .from('email_logs')
    .insert({
      id,
      user_id: input.userId || null,
      recipient: input.recipientEmail,
      subject: input.subject,
      template: input.body,
      status: input.status || 'delivered',
      error_message: input.errorMessage || null,
      created_at: createdAt,
      recipient_name: input.recipientName,
      triggered_by_event: input.triggeredByEvent,
      is_read: input.isRead ?? false,
    })
    .select(EMAIL_LOG_SELECT)
    .single<SupabaseEmailLogRow>();

  if (error) {
    throw error;
  }

  return mapSupabaseEmailLog(data);
}

export async function updateEmailLogStatus(
  id: string,
  status: EmailAlert['status'],
  errorMessage?: string
): Promise<EmailAlert | null> {
  const { data, error } = await requireSupabaseAdmin()
    .from('email_logs')
    .update({ status, error_message: errorMessage || null })
    .eq('id', id)
    .select(EMAIL_LOG_SELECT)
    .maybeSingle<SupabaseEmailLogRow>();

  if (error) {
    throw error;
  }

  return data ? mapSupabaseEmailLog(data) : null;
}

export async function getEmailLogsByUser(userId: string): Promise<EmailAlert[]> {
  const { data, error } = await requireSupabaseAdmin()
    .from('email_logs')
    .select(EMAIL_LOG_SELECT)
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    throw error;
  }

  return (data || []).map(row => mapSupabaseEmailLog(row as SupabaseEmailLogRow));
}

export async function deleteEmailLog(id: string): Promise<boolean> {
  const { error } = await requireSupabaseAdmin()
    .from('email_logs')
    .delete()
    .eq('id', id);

  if (error) {
    throw error;
  }

  return true;
}

export async function updateEmailLogsReadStatus(
  ids: string[],
  isRead: boolean,
  allowedRecipients?: string[],
): Promise<EmailAlert[]> {
  const normalizedIds = Array.from(new Set(ids.map((id) => id.trim()).filter(Boolean)));
  if (normalizedIds.length === 0) return [];

  let request = requireSupabaseAdmin()
    .from('email_logs')
    .update({ is_read: isRead })
    .in('id', normalizedIds);

  const recipients = normalizeRecipients(allowedRecipients);
  if (recipients.length) {
    request = request.in('recipient', recipients);
  }

  const { data, error } = await request
    .select(EMAIL_LOG_SELECT);

  if (error) {
    throw error;
  }

  return (data || []).map(row => mapSupabaseEmailLog(row as SupabaseEmailLogRow));
}

export async function deleteEmailLogs(
  ids: string[],
  allowedRecipients?: string[],
): Promise<string[]> {
  const normalizedIds = Array.from(new Set(ids.map((id) => id.trim()).filter(Boolean)));
  if (normalizedIds.length === 0) return [];

  let request = requireSupabaseAdmin()
    .from('email_logs')
    .delete()
    .in('id', normalizedIds);

  const recipients = normalizeRecipients(allowedRecipients);
  if (recipients.length) {
    request = request.in('recipient', recipients);
  }

  const { data, error } = await request.select('id');

  if (error) {
    throw error;
  }

  return (data || []).map((row) => String(row.id));
}

function normalizeRecipients(recipients?: string[]) {
  return Array.from(new Set((recipients || []).map((recipient) => recipient.trim().toLowerCase()).filter(Boolean)));
}
