import { AppNotification } from '../src/types';
import { supabaseAdmin } from '../lib/supabase';

export const USE_SUPABASE_NOTIFICATIONS = true;

type JsonNotificationDB = {
  notifications: AppNotification[];
};

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

let jsonDB: JsonNotificationDB | null = null;

export function setJsonDB(db: JsonNotificationDB): void {
  jsonDB = db;
}

function requireSupabaseAdmin() {
  if (!supabaseAdmin) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is required when USE_SUPABASE_NOTIFICATIONS is true');
  }
  return supabaseAdmin;
}

function getJsonDB(): JsonNotificationDB {
  if (!jsonDB) {
    throw new Error('JSON DB not initialized');
  }
  return jsonDB;
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

export async function getNotificationsByUser(userId: string, role?: string): Promise<AppNotification[]> {
  if (USE_SUPABASE_NOTIFICATIONS) {
    const recipientIds = role === 'admin' ? ['all_admin', userId] : [userId];
    const { data, error } = await requireSupabaseAdmin()
      .from('notifications')
      .select('id,recipient_id,title,message,type,is_read,created_at')
      .in('recipient_id', recipientIds)
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    return (data || []).map(row => mapSupabaseNotification(row as SupabaseNotificationRow));
  }

  return getJsonDB().notifications.filter(notification => {
    if (role === 'admin') {
      return notification.recipientId === 'all_admin' || notification.recipientId === userId;
    }
    return notification.recipientId === userId;
  });
}

export async function createNotification(input: CreateNotificationInput): Promise<AppNotification> {
  if (USE_SUPABASE_NOTIFICATIONS) {
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
      .select('id,recipient_id,title,message,type,is_read,created_at')
      .single<SupabaseNotificationRow>();

    if (error) {
      throw error;
    }

    return mapSupabaseNotification(data);
  }

  const notification: AppNotification = {
    id: input.id || `n-${Date.now()}`,
    recipientId: input.recipientId,
    title: input.title,
    message: input.message,
    isRead: input.isRead ?? false,
    createdAt: input.createdAt || new Date().toISOString(),
  };
  getJsonDB().notifications.push(notification);
  return notification;
}

export async function markAsRead(id: string): Promise<boolean> {
  if (USE_SUPABASE_NOTIFICATIONS) {
    const { error } = await requireSupabaseAdmin()
      .from('notifications')
      .update({ is_read: true })
      .eq('id', id);

    if (error) {
      throw error;
    }

    return true;
  }

  const notification = getJsonDB().notifications.find(item => item.id === id);
  if (!notification) {
    return false;
  }
  notification.isRead = true;
  return true;
}

export async function deleteNotification(id: string): Promise<boolean> {
  if (USE_SUPABASE_NOTIFICATIONS) {
    const { error } = await requireSupabaseAdmin()
      .from('notifications')
      .delete()
      .eq('id', id);

    if (error) {
      throw error;
    }

    return true;
  }

  const notifications = getJsonDB().notifications;
  const index = notifications.findIndex(item => item.id === id);
  if (index === -1) {
    return false;
  }
  notifications.splice(index, 1);
  return true;
}

export async function getUnreadCount(userId: string, role?: string): Promise<number> {
  if (USE_SUPABASE_NOTIFICATIONS) {
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

  return (await getNotificationsByUser(userId, role)).filter(notification => !notification.isRead).length;
}
