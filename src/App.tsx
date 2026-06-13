/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { Suspense, lazy, useState, useEffect } from 'react';
import { User, AppNotification } from './types';
import Navbar from './components/Navbar';
import BrandLogo from './components/BrandLogo';

const AuthScreen = lazy(() => import('./components/AuthScreen'));
const CandidateDashboard = lazy(() => import('./components/CandidateDashboard'));
const CompanyDashboard = lazy(() => import('./components/CompanyDashboard'));
const AdminDashboard = lazy(() => import('./components/AdminDashboard'));

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [apiError, setApiError] = useState<string | null>(null);
  const [initialized, setInitialized] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const saved = localStorage.getItem('persevex_theme');
    if (saved === 'dark' || saved === 'light') {
      return saved;
    }
    if (typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      return 'dark';
    }
    return 'light';
  });

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem('persevex_theme', theme);
  }, [theme]);

  useEffect(() => {
    const saved = localStorage.getItem('persevex_session_user');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed?.user && parsed?.token) {
          fetch('/api/auth/me', {
            headers: {
              Authorization: `Bearer ${parsed.token}`,
            },
          })
            .then((response) => {
              if (!response.ok) {
                throw new Error('Session expired');
              }
              return response.json();
            })
            .then((data) => {
              setCurrentUser(data.user);
              setAuthToken(parsed.token);
            })
            .catch((err) => {
              console.error('Session validation error', err);
              localStorage.removeItem('persevex_session_user');
            })
            .finally(() => setInitialized(true));
          return;
        }
      } catch (err) {
        console.error('Session parsing error', err);
      }
    }
    setInitialized(true);
  }, []);

  useEffect(() => {
    if (!currentUser) {
      setNotifications([]);
      return;
    }

    fetchNotifications();

    const interval = setInterval(() => {
      fetchNotifications();
    }, 8000);

    return () => clearInterval(interval);
  }, [currentUser]);

  const apiFetch = async (url: string, options: RequestInit = {}, silent: boolean = false) => {
    const headers = {
      ...(options.headers || {}),
    } as Record<string, string>;

    if (authToken) {
      headers.Authorization = `Bearer ${authToken}`;
    }

    try {
      const response = await fetch(url, {
        ...options,
        headers,
      });

      if (!response.ok) {
        const errorText = await response.text();
        let errorJson;
        try {
          errorJson = JSON.parse(errorText);
        } catch {
          // Response is not JSON.
        }
        throw new Error(errorJson?.error || errorJson?.message || `Server responded with status ${response.status}`);
      }

      return await response.json();
    } catch (err: any) {
      console.error(`API Fetch Error [${url}]`, err);
      if (!silent) {
        setApiError(err.message || 'Network communication error');
      }
      throw err;
    }
  };

  const fetchNotifications = async () => {
    try {
      const data = await apiFetch('/api/notifications', {}, true);
      if (data && data.notifications) {
        const sorted = [...data.notifications].sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
        setNotifications(sorted);
      }
    } catch (err) {
      // Keep polling errors silent so transient network issues do not block the workspace.
    }
  };

  const handleLoginSuccess = (user: User, token: string) => {
    setCurrentUser(user);
    setAuthToken(token);
    localStorage.setItem('persevex_session_user', JSON.stringify({ user, token }));
    setApiError(null);
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setAuthToken(null);
    localStorage.removeItem('persevex_session_user');
    setNotifications([]);
    setApiError(null);
  };

  const handleMarkNotificationRead = async (id: string) => {
    try {
      await fetch(`/api/notifications/${id}/read`, {
        method: 'POST',
        headers: {
          Authorization: authToken ? `Bearer ${authToken}` : '',
        },
      });
      fetchNotifications();
    } catch (err) {
      console.error(err);
    }
  };

  const handleMarkAllNotificationsRead = async () => {
    try {
      await fetch('/api/notifications/read-all', {
        method: 'POST',
        headers: {
          Authorization: authToken ? `Bearer ${authToken}` : '',
        },
      });
      fetchNotifications();
    } catch (err) {
      console.error(err);
    }
  };

  if (!initialized) {
    return (
      <div className="pvx-boot-screen">
        <div className="pvx-boot-card" role="status" aria-live="polite">
          <BrandLogo subline="Hiring & Placement Engine" />
          <p>Loading verified jobs and placement routes</p>
        </div>
      </div>
    );
  }

  return (
    <div className="pvx-app-shell">
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
        theme={theme}
        onToggleTheme={() => setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'))}
      />

      <main className="pvx-main">
        <Suspense fallback={<WorkspaceLoading />}>
          {!currentUser ? (
            <AuthScreen onLoginSuccess={handleLoginSuccess} apiFetch={apiFetch} />
          ) : (
            <div className="platform-shell fade-in duration-300">
              {currentUser.role === 'admin' && (
                <AdminDashboard currentUser={currentUser} apiFetch={apiFetch} theme={theme} />
              )}
              {currentUser.role === 'company' && (
                <CompanyDashboard currentUser={currentUser} apiFetch={apiFetch} />
              )}
              {currentUser.role === 'candidate' && (
                <CandidateDashboard currentUser={currentUser} apiFetch={apiFetch} />
              )}
            </div>
          )}
        </Suspense>
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

function WorkspaceLoading() {
  return (
    <div className="pvx-workspace-loading" role="status" aria-live="polite">
      <BrandLogo subline="Hiring & Placement Engine" />
      <strong>Loading jobs</strong>
      <p>Preparing opportunities and application tracking</p>
    </div>
  );
}
