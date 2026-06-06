/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { User, AppNotification } from './types';
import Navbar from './components/Navbar';
import AuthScreen from './components/AuthScreen';
import CandidateDashboard from './components/CandidateDashboard';
import CompanyDashboard from './components/CompanyDashboard';
import AdminDashboard from './components/AdminDashboard';

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
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

  // Track and persist theme to document class list & local storage
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem('persevex_theme', theme);
  }, [theme]);

  // Load user session from local storage on bootstrap
  useEffect(() => {
    const saved = localStorage.getItem('persevex_session_user');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setCurrentUser(parsed);
      } catch (err) {
        console.error('Session parsing error', err);
      }
    }
    setInitialized(true);
  }, []);

  // Poll for notifications periodically if a user is logged in
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

  // General server API request proxy wrapper
  // Automatically appends our authorized header "x-user-id" to make sandbox state robust and clean!
  const apiFetch = async (url: string, options: RequestInit = {}, silent: boolean = false) => {
    const headers = {
      ...(options.headers || {}),
    } as Record<string, string>;

    if (currentUser) {
      headers['x-user-id'] = currentUser.id;
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
          // not json
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
        // Sort notifications descending by date
        const sorted = [...data.notifications].sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
        setNotifications(sorted);
      }
    } catch (err) {
      // Slidely silence network polls errors to prevent blocking screen
    }
  };

  const handleLoginSuccess = (user: User) => {
    setCurrentUser(user);
    localStorage.setItem('persevex_session_user', JSON.stringify(user));
    setApiError(null);
  };

  const handleLogout = () => {
    setCurrentUser(null);
    localStorage.removeItem('persevex_session_user');
    setNotifications([]);
    setApiError(null);
  };

  const handleMarkNotificationRead = async (id: string) => {
    try {
      await fetch(`/api/notifications/${id}/read`, {
        method: 'POST',
        headers: {
          'x-user-id': currentUser?.id || '',
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
          'x-user-id': currentUser?.id || '',
        },
      });
      fetchNotifications();
    } catch (err) {
      console.error(err);
    }
  };

  if (!initialized) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600 mx-auto"></div>
          <p className="text-xs text-slate-500 mt-2 font-mono uppercase tracking-wider">
            Loading Persevex Workspace...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      {/* Alert Banner for network glitches */}
      {apiError && (
        <div className="bg-red-650 bg-red-600 text-white text-xs px-4 py-2 text-center relative flex items-center justify-center font-semibold">
          <span>Communication Exception: {apiError}</span>
          <button
            onClick={() => setApiError(null)}
            className="absolute right-4 font-bold text-sm cursor-pointer hover:opacity-80"
          >
            ✕
          </button>
        </div>
      )}

      {/* Main Navigation Header */}
      <Navbar
        currentUser={currentUser}
        notifications={notifications}
        onLogout={handleLogout}
        onMarkNotificationRead={handleMarkNotificationRead}
        onMarkAllNotificationsRead={handleMarkAllNotificationsRead}
        theme={theme}
        onToggleTheme={() => setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'))}
      />

      <main className="flex-grow">
        {!currentUser ? (
          <AuthScreen onLoginSuccess={handleLoginSuccess} apiFetch={apiFetch} />
        ) : (
          <div className="fade-in duration-300">
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
      </main>

      {/* Humble Footer */}
      <footer className="bg-slate-900 border-t border-slate-800 py-6 text-center text-slate-500 text-xs mt-auto">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row justify-between items-center gap-2">
          <span>&copy; {new Date().getFullYear()} Persevex Ltd. All rights reserved.</span>
          <span className="font-mono text-[10px] text-slate-600">
            Production Build Gateway: 18-Day MVP Solution Sandbox
          </span>
        </div>
      </footer>
    </div>
  );
}
