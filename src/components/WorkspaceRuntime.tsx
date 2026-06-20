'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { AppNotification, User, UserRole } from '@/src/types';
import Navbar from '@/src/components/Navbar';
import BrandLogo from '@/src/components/BrandLogo';
import ToastViewport, { type ToastItem, type ToastTone } from '@/src/components/ToastViewport';
import { getDefaultDashboardPath } from '@/lib/auth/guards';
import { clearStoredSession, persistStoredSession, readStoredSession } from '@/src/lib/sessionClient';
import { initializeTheme, toggleTheme } from '@/src/lib/theme';

type DashboardComponentProps = {
  currentUser: User;
  apiFetch: (url: string, options?: RequestInit) => Promise<any>;
  showToast: (tone: ToastTone, title: string, message?: string) => void;
  onCurrentUserUpdate: (updates: Partial<User>) => void;
};

type WorkspaceRuntimeProps = {
  Dashboard: React.ComponentType<DashboardComponentProps>;
  requiredRole: UserRole;
};

type ComparableNotification = AppNotification & {
  updatedAt?: string;
};

function getNotificationTimestamp(notification: AppNotification): string {
  return (notification as ComparableNotification).updatedAt ?? notification.createdAt ?? '';
}

function sortNotifications(notifications: AppNotification[]): AppNotification[] {
  return [...notifications].sort(
    (a, b) => new Date(getNotificationTimestamp(b)).getTime() - new Date(getNotificationTimestamp(a)).getTime(),
  );
}

function getNotificationsSnapshot(notifications: AppNotification[]) {
  return {
    count: notifications.length,
    unreadCount: notifications.reduce((count, notification) => count + (notification.isRead ? 0 : 1), 0),
    ids: notifications.map((notification) => notification.id).join('|'),
    timestamps: notifications.map((notification) => getNotificationTimestamp(notification)).join('|'),
  };
}

function areNotificationsEquivalent(current: AppNotification[], next: AppNotification[]): boolean {
  if (current.length !== next.length) return false;

  let currentUnreadCount = 0;
  let nextUnreadCount = 0;

  for (let index = 0; index < current.length; index += 1) {
    const currentItem = current[index];
    const nextItem = next[index];

    if (!currentItem.isRead) currentUnreadCount += 1;
    if (!nextItem.isRead) nextUnreadCount += 1;

    if (currentItem.id !== nextItem.id) return false;
    if (getNotificationTimestamp(currentItem) !== getNotificationTimestamp(nextItem)) return false;
    if (currentItem.isRead !== nextItem.isRead) return false;
  }

  return currentUnreadCount === nextUnreadCount;
}

export default function WorkspaceRuntime({ Dashboard, requiredRole }: WorkspaceRuntimeProps) {
  const router = useRouter();
  const MemoDashboard = useMemo(() => React.memo(Dashboard), [Dashboard]);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [apiError, setApiError] = useState<string | null>(null);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [checkingSession, setCheckingSession] = useState(true);
  const notificationsSnapshotRef = useRef<{ count: number; unreadCount: number; ids: string; timestamps: string }>({
    count: 0,
    unreadCount: 0,
    ids: '',
    timestamps: '',
  });

  const dismissToast = useCallback((id: string) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const showToast = useCallback((tone: ToastTone, title: string, message?: string) => {
    setToasts((current) => [
      ...current.filter((toast) => !(toast.title === title && toast.message === message && toast.tone === tone)),
      { id: `${Date.now()}-${Math.random()}`, tone, title, message },
    ]);
  }, []);

  const handleLogout = useCallback(async () => {
    const storedSession = readStoredSession();
    const token = authToken || storedSession?.token || null;
    try {
      const headers = new Headers();
      if (token) {
        headers.set('Authorization', `Bearer ${token}`);
      }
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers,
        credentials: 'include',
      });
    } catch {
      // Ignore logout transport failures; client cleanup still proceeds.
    }

    setCurrentUser(null);
    setAuthToken(null);
    setNotifications([]);
    setApiError(null);
    clearStoredSession();
    router.replace('/login');
  }, [authToken, router]);

  const patchCurrentUser = useCallback((updates: Partial<User>) => {
    setCurrentUser((current) => {
      if (!current) return current;
      const nextUser = { ...current, ...updates };
      if (authToken) {
        persistStoredSession(nextUser, authToken);
      }
      return nextUser;
    });
  }, [authToken]);

  const handleToggleTheme = useCallback(() => {
    toggleTheme();
  }, []);

  useEffect(() => {
    initializeTheme();
  }, []);

  const apiFetch = useCallback(async (url: string, options: RequestInit = {}, silent = false) => {
    const storedSession = readStoredSession();
    const token = authToken || storedSession?.token || null;
    const headers = new Headers(options.headers || {});
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }

    try {
      const response = await fetch(url, {
        ...options,
        headers,
        credentials: 'include',
      });

      const responseText = await response.text();
      let payload: any = null;
      try {
        payload = responseText ? JSON.parse(responseText) : null;
      } catch {
        payload = null;
      }

      if (!response.ok) {
        const message = payload?.error || payload?.message || `Server responded with status ${response.status}`;
        if (response.status === 401) {
          await handleLogout();
          showToast('error', 'Session expired', 'Your session ended. Please sign in again.');
        }
        throw new Error(message);
      }

      setApiError(null);
      return payload;
    } catch (err: any) {
      if (!silent) {
        setApiError(err.message || 'Network communication error');
        showToast('error', 'Request failed', err.message || 'Network communication error');
      }
      throw err;
    }
  }, [authToken, handleLogout, showToast]);

  const fetchNotifications = useCallback(async (signal?: AbortSignal) => {
    try {
      const data = await apiFetch('/api/notifications', signal ? { signal } : {}, true);
      if (data?.notifications) {
        const sorted = sortNotifications(data.notifications);
        const nextSnapshot = getNotificationsSnapshot(sorted);
        const previousSnapshot = notificationsSnapshotRef.current;
        const snapshotChanged = previousSnapshot.count !== nextSnapshot.count
          || previousSnapshot.unreadCount !== nextSnapshot.unreadCount
          || previousSnapshot.ids !== nextSnapshot.ids
          || previousSnapshot.timestamps !== nextSnapshot.timestamps;

        setNotifications((current) => {
          if (!snapshotChanged && areNotificationsEquivalent(current, sorted)) {
            return current;
          }
          notificationsSnapshotRef.current = nextSnapshot;
          return sorted;
        });
      }
    } catch {
      // Keep polling failures silent.
    }
  }, [apiFetch]);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    const validateSession = async () => {
      const storedSession = readStoredSession();
      const token = storedSession?.token || null;

      try {
        const headers = new Headers();
        if (token) {
          headers.set('Authorization', `Bearer ${token}`);
        }

        const response = await fetch('/api/auth/me', {
          headers,
          credentials: 'include',
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error('Unauthenticated');
        }

        const data = await response.json();
        const user = data?.user as User | undefined;
        if (!user) {
          throw new Error('Unauthenticated');
        }

        if (user.role !== requiredRole) {
          if (!cancelled) {
            router.replace(getDefaultDashboardPath(user.role));
          }
          return;
        }

        if (!cancelled) {
          setCurrentUser(user);
          setAuthToken(token);
          if (token) {
            persistStoredSession(user, token);
          }
        }
      } catch (error: any) {
        if (error?.name === 'AbortError') {
          return;
        }
        clearStoredSession();
        if (!cancelled) {
          router.replace('/login');
        }
      } finally {
        if (!cancelled) {
          setCheckingSession(false);
        }
      }
    };

    validateSession();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [requiredRole, router]);

  useEffect(() => {
    if (!currentUser) {
      notificationsSnapshotRef.current = {
        count: 0,
        unreadCount: 0,
        ids: '',
        timestamps: '',
      };
      setNotifications((current) => (current.length ? [] : current));
      return;
    }

    const controller = new AbortController();
    void fetchNotifications(controller.signal);
    const interval = window.setInterval(() => {
      void fetchNotifications();
    }, 8000);
    return () => {
      controller.abort();
      window.clearInterval(interval);
    };
  }, [currentUser, fetchNotifications]);

  const handleMarkNotificationRead = useCallback(async (id: string) => {
    try {
      await apiFetch(`/api/notifications/${id}/read`, {
        method: 'POST',
      }, true);
      setNotifications((current) => {
        const next = current.map((notification) => (
          notification.id === id ? { ...notification, isRead: true } : notification
        ));
        notificationsSnapshotRef.current = getNotificationsSnapshot(next);
        return next;
      });
    } catch (err: any) {
      showToast('error', 'Notification update failed', err.message || 'Could not mark notification as read.');
    }
  }, [apiFetch, showToast]);

  const handleMarkAllNotificationsRead = useCallback(async () => {
    try {
      await apiFetch('/api/notifications/read-all', {
        method: 'POST',
      }, true);
      setNotifications((current) => {
        const next = current.map((notification) => (
          notification.isRead ? notification : { ...notification, isRead: true }
        ));
        notificationsSnapshotRef.current = getNotificationsSnapshot(next);
        return next;
      });
      showToast('success', 'Notifications updated', 'All notifications were marked as read.');
    } catch (err: any) {
      showToast('error', 'Notification update failed', err.message || 'Could not mark all notifications as read.');
    }
  }, [apiFetch, showToast]);

  const handleDeleteNotification = useCallback(async (id: string) => {
    try {
      await apiFetch(`/api/notifications/${id}`, {
        method: 'DELETE',
      }, true);
      setNotifications((current) => {
        const next = current.filter((notification) => notification.id !== id);
        notificationsSnapshotRef.current = getNotificationsSnapshot(next);
        return next;
      });
    } catch (err: any) {
      showToast('error', 'Notification delete failed', err.message || 'Could not delete notification.');
    }
  }, [apiFetch, showToast]);

  const handleClearAllNotifications = useCallback(async () => {
    try {
      await apiFetch('/api/notifications/clear-all', {
        method: 'DELETE',
      }, true);
      setNotifications([]);
      notificationsSnapshotRef.current = {
        count: 0,
        unreadCount: 0,
        ids: '',
        timestamps: '',
      };
      showToast('success', 'Notifications cleared', 'Your notification inbox has been cleaned up.');
    } catch (err: any) {
      showToast('error', 'Notification cleanup failed', err.message || 'Could not clear notifications.');
    }
  }, [apiFetch, showToast]);

  const dashboardProps = useMemo(() => ({
    currentUser,
    apiFetch: (url: string, options?: RequestInit) => apiFetch(url, options),
    showToast,
    onCurrentUserUpdate: patchCurrentUser,
  }), [apiFetch, currentUser, patchCurrentUser, showToast]);

  if (checkingSession || !currentUser) {
    return (
      <main className="pvx-boot-screen">
        <ToastViewport toasts={toasts} onDismiss={dismissToast} />
        <div className="pvx-boot-card" role="status" aria-live="polite">
          <BrandLogo subline="Hiring & Placement Engine" />
          <p>Loading verified jobs and placement routes</p>
        </div>
      </main>
    );
  }

  return (
    <div className="pvx-app-shell">
      <ToastViewport toasts={toasts} onDismiss={dismissToast} />

      {apiError && (
        <div className="pvx-error-banner" role="alert">
          <span>{apiError}</span>
          <button type="button" onClick={() => setApiError(null)} aria-label="Dismiss error">
            Close
          </button>
        </div>
      )}

      <Navbar
        currentUser={currentUser}
        notifications={notifications}
        onLogout={handleLogout}
        onMarkNotificationRead={handleMarkNotificationRead}
        onMarkAllNotificationsRead={handleMarkAllNotificationsRead}
        onDeleteNotification={handleDeleteNotification}
        onClearAllNotifications={handleClearAllNotifications}
        onToggleTheme={handleToggleTheme}
        showToast={showToast}
      />

      <main className="pvx-main">
        <div className="platform-shell fade-in duration-300">
          <MemoDashboard {...dashboardProps} />
        </div>
      </main>

      <footer className="pvx-footer">
        <div>
          <BrandLogo subline="Jobs • Internships • Placement" />
          <span>&copy; {new Date().getFullYear()} Persevex</span>
        </div>
      </footer>
    </div>
  );
}
