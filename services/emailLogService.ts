import { EmailAlert } from '../src/types';
import { supabaseAdmin } from '../lib/supabase';

export const USE_SUPABASE_EMAIL_LOGS = true;

type JsonEmailLogDB = {
  emailAlerts: EmailAlert[];
};

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
};

let jsonDB: JsonEmailLogDB | null = null;

export function setJsonDB(db: JsonEmailLogDB): void {
  jsonDB = db;
}

function requireSupabaseAdmin() {
  if (!supabaseAdmin) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is required when USE_SUPABASE_EMAIL_LOGS is true');
  }
  return supabaseAdmin;
}

function getJsonDB(): JsonEmailLogDB {
  if (!jsonDB) {
    throw new Error('JSON DB not initialized');
  }
  if (!jsonDB.emailAlerts) {
    jsonDB.emailAlerts = [];
  }
  return jsonDB;
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
  };
}

export async function getEmailLogs(): Promise<EmailAlert[]> {
  if (USE_SUPABASE_EMAIL_LOGS) {
    const { data, error } = await requireSupabaseAdmin()
      .from('email_logs')
      .select('id,user_id,recipient,subject,template,status,error_message,created_at,recipient_name,triggered_by_event')
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    return (data || []).map(row => mapSupabaseEmailLog(row as SupabaseEmailLogRow));
  }

  return [...getJsonDB().emailAlerts];
}

export async function createEmailLog(input: CreateEmailLogInput): Promise<EmailAlert> {
  if (USE_SUPABASE_EMAIL_LOGS) {
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
      })
      .select('id,user_id,recipient,subject,template,status,error_message,created_at,recipient_name,triggered_by_event')
      .single<SupabaseEmailLogRow>();

    if (error) {
      throw error;
    }

    return mapSupabaseEmailLog(data);
  }

  const emailLog: EmailAlert = {
    id: input.id || `email-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    recipientEmail: input.recipientEmail,
    recipientName: input.recipientName,
    subject: input.subject,
    body: input.body,
    status: input.status || 'delivered',
    triggeredByEvent: input.triggeredByEvent,
    createdAt: input.createdAt || new Date().toISOString(),
  };
  getJsonDB().emailAlerts.push(emailLog);
  return emailLog;
}

export async function updateEmailLogStatus(
  id: string,
  status: EmailAlert['status'],
  errorMessage?: string
): Promise<EmailAlert | null> {
  if (USE_SUPABASE_EMAIL_LOGS) {
    const { data, error } = await requireSupabaseAdmin()
      .from('email_logs')
      .update({ status, error_message: errorMessage || null })
      .eq('id', id)
      .select('id,user_id,recipient,subject,template,status,error_message,created_at,recipient_name,triggered_by_event')
      .maybeSingle<SupabaseEmailLogRow>();

    if (error) {
      throw error;
    }

    return data ? mapSupabaseEmailLog(data) : null;
  }

  const emailLog = getJsonDB().emailAlerts.find(item => item.id === id);
  if (!emailLog) {
    return null;
  }
  emailLog.status = status;
  return emailLog;
}

export async function getEmailLogsByUser(userId: string): Promise<EmailAlert[]> {
  if (USE_SUPABASE_EMAIL_LOGS) {
    const { data, error } = await requireSupabaseAdmin()
      .from('email_logs')
      .select('id,user_id,recipient,subject,template,status,error_message,created_at,recipient_name,triggered_by_event')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    return (data || []).map(row => mapSupabaseEmailLog(row as SupabaseEmailLogRow));
  }

  return [...getJsonDB().emailAlerts];
}
