'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { User } from '@/src/types';
import AuthScreen from '@/src/components/AuthScreen';
import ToastViewport, { type ToastItem, type ToastTone } from '@/src/components/ToastViewport';
import { getDefaultDashboardPath } from '@/lib/auth/guards';
import { clearStoredSession, persistStoredSession, readStoredSession } from '@/src/lib/sessionClient';

export default function LoginPage() {
  const router = useRouter();
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [checkingSession, setCheckingSession] = useState(true);

  const dismissToast = useCallback((id: string) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const showToast = useCallback((tone: ToastTone, title: string, message?: string) => {
    setToasts((current) => [
      ...current.filter((toast) => !(toast.title === title && toast.message === message && toast.tone === tone)),
      { id: `${Date.now()}-${Math.random()}`, tone, title, message },
    ]);
  }, []);

  const apiFetch = useCallback(async (url: string, options: RequestInit = {}) => {
    const storedSession = readStoredSession();
    const headers = new Headers(options.headers || {});
    if (storedSession?.token) {
      headers.set('Authorization', `Bearer ${storedSession.token}`);
    }

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
      throw new Error(payload?.error || payload?.message || `Server responded with status ${response.status}`);
    }

    return payload;
  }, []);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    const validateSession = async () => {
      const storedSession = readStoredSession();
      try {
        const headers = new Headers();
        if (storedSession?.token) {
          headers.set('Authorization', `Bearer ${storedSession.token}`);
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
        if (!cancelled && data?.user) {
          if (storedSession?.token) {
            persistStoredSession(data.user, storedSession.token);
          }
          router.replace(getDefaultDashboardPath(data.user.role));
          return;
        }
      } catch (error: any) {
        if (error?.name === 'AbortError') {
          return;
        }
        clearStoredSession();
      }

      if (!cancelled) {
        setCheckingSession(false);
      }
    };

    validateSession();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [router]);

  const handleLoginSuccess = useCallback((user: User, token: string) => {
    persistStoredSession(user, token);
    showToast('success', user.role === 'candidate' ? 'Welcome back' : 'Signed in', 'Your workspace is ready.');
    router.replace(getDefaultDashboardPath(user.role));
  }, [router, showToast]);

  if (checkingSession) {
    return (
      <main className="pvx-boot-screen">
        <ToastViewport toasts={toasts} onDismiss={dismissToast} />
        <div className="pvx-boot-card" role="status" aria-live="polite">
          <h1>Loading workspace</h1>
          <p>Checking your Persevex session before opening the dashboard.</p>
        </div>
      </main>
    );
  }

  return (
    <>
      <ToastViewport toasts={toasts} onDismiss={dismissToast} />
      <AuthScreen onLoginSuccess={handleLoginSuccess} apiFetch={apiFetch} showToast={showToast} />
    </>
  );
}
