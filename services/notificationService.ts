import { AppNotification } from '../src/types';
import { supabaseAdmin } from '../lib/supabase';

type NotificationType = 'info' | 'success' | 'warning' | 'error';

type SupabaseNotificationRow = {
  id: string;
  recipient_id: string;
  title: string;
  message: string;
  type: NotificationType | null;
  is_read: boolean | null;
  created_at: string | null;
};

export type CreateNotificationInput = {
  id?: string;
  recipientId: string;
  title: string;
  message: string;
  type?: NotificationType;
  isRead?: boolean;
  createdAt?: string;
};

export type NotificationQuery = {
  unreadOnly?: boolean;
  type?: NotificationType;
  limit?: number;
  offset?: number;
};

const NOTIFICATION_SELECT = 'id,recipient_id,title,message,type,is_read,created_at';

function requireSupabaseAdmin() {
  if (!supabaseAdmin) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is required for notification persistence');
  }
  return supabaseAdmin;
}

function mapSupabaseNotification(row: SupabaseNotificationRow): AppNotification {
  return {
    id: row.id,
    recipientId: row.recipient_id,
    title: row.title,
    message: row.message,
    isRead: Boolean(row.is_read),
    createdAt: row.created_at || new Date().toISOString(),
  };
}

export async function getNotificationsByUser(userId: string, role?: string, query: NotificationQuery = {}): Promise<AppNotification[]> {
  const recipientIds = role === 'admin' ? ['all_admin', userId] : [userId];
  let request = requireSupabaseAdmin()
    .from('notifications')
    .select(NOTIFICATION_SELECT)
    .in('recipient_id', recipientIds)
    .order('created_at', { ascending: false });

  if (query.unreadOnly) {
    request = request.eq('is_read', false);
  }
  if (query.type) {
    request = request.eq('type', query.type);
  }
  if (query.limit !== undefined) {
    const limit = Math.max(1, Math.min(100, query.limit));
    const offset = Math.max(0, query.offset || 0);
    request = request.range(offset, offset + limit - 1);
  }

  const { data, error } = await request;

  if (error) {
    throw error;
  }

  return (data || []).map(row => mapSupabaseNotification(row as SupabaseNotificationRow));
}

export async function getNotificationById(id: string): Promise<AppNotification | null> {
  const { data, error } = await requireSupabaseAdmin()
    .from('notifications')
    .select(NOTIFICATION_SELECT)
    .eq('id', id)
    .maybeSingle<SupabaseNotificationRow>();

  if (error) {
    throw error;
  }

  return data ? mapSupabaseNotification(data) : null;
}

export async function createNotification(input: CreateNotificationInput): Promise<AppNotification> {
  const id = input.id || `n-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  const createdAt = input.createdAt || new Date().toISOString();
  const { data, error } = await requireSupabaseAdmin()
    .from('notifications')
    .insert({
      id,
      recipient_id: input.recipientId,
      title: input.title,
      message: input.message,
      type: input.type || 'info',
      is_read: input.isRead ?? false,
      created_at: createdAt,
    })
    .select(NOTIFICATION_SELECT)
    .single<SupabaseNotificationRow>();

  if (error) {
    throw error;
  }

  return mapSupabaseNotification(data);
}

export async function markAsRead(id: string): Promise<boolean> {
  const { error } = await requireSupabaseAdmin()
    .from('notifications')
    .update({ is_read: true })
    .eq('id', id);

  if (error) {
    throw error;
  }

  return true;
}

export async function deleteNotification(id: string): Promise<boolean> {
  const { error } = await requireSupabaseAdmin()
    .from('notifications')
    .delete()
    .eq('id', id);

  if (error) {
    throw error;
  }

  return true;
}

export async function getUnreadCount(userId: string, role?: string): Promise<number> {
  const recipientIds = role === 'admin' ? ['all_admin', userId] : [userId];
  const { count, error } = await requireSupabaseAdmin()
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .in('recipient_id', recipientIds)
    .eq('is_read', false);

  if (error) {
    throw error;
  }

  return count || 0;
}
