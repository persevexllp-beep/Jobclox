/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { AppNotification, User } from '../types';
import { Bell, Check, CheckCircle2, LogOut, Moon, ShieldAlert, Sun, UserCheck } from 'lucide-react';
import BrandLogo from './BrandLogo';

interface NavbarProps {
  currentUser: User | null;
  notifications: AppNotification[];
  onLogout: () => void;
  onMarkNotificationRead: (id: string) => void;
  onMarkAllNotificationsRead: () => void;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
}

const roleLabels = {
  admin: { label: 'Admin', icon: ShieldAlert },
  company: { label: 'Recruiter', icon: UserCheck },
  candidate: { label: 'Candidate', icon: CheckCircle2 },
};

export default function Navbar({
  currentUser,
  notifications,
  onLogout,
  onMarkNotificationRead,
  onMarkAllNotificationsRead,
  theme,
  onToggleTheme,
}: NavbarProps) {
  const [showNotifMenu, setShowNotifMenu] = useState(false);
  const unreadNotifs = notifications.filter((n) => !n.isRead);
  const role = currentUser ? roleLabels[currentUser.role] : null;
  const RoleIcon = role?.icon;

  return (
    <header className="pvx-header">
      <div className="pvx-header-inner">
        <div className="pvx-logo">
          <BrandLogo subline="Hiring & Placement Engine" />
        </div>

        <div className="pvx-header-actions">
          <button
            type="button"
            onClick={onToggleTheme}
            className="pvx-icon-button"
            aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {theme === 'dark' ? <Sun className="h-4 w-4 text-amber-500" /> : <Moon className="h-4 w-4" />}
          </button>

          {currentUser && role && RoleIcon && (
            <>
              <div className="pvx-role-pill">
                <RoleIcon className="h-3.5 w-3.5" />
                <span>{role.label}</span>
              </div>

              <div className="pvx-user-lockup">
                <span>{currentUser.name}</span>
                <small>{currentUser.email}</small>
              </div>

              <div className="relative">
                <button
                  id="notif-bell-btn"
                  type="button"
                  onClick={() => setShowNotifMenu((prev) => !prev)}
                  className="pvx-icon-button"
                  aria-label="Notifications"
                >
                  <Bell className="h-4 w-4" />
                  {unreadNotifs.length > 0 && <em>{unreadNotifs.length}</em>}
                </button>

                {showNotifMenu && (
                  <div className="pvx-notification-menu">
                    <div className="pvx-notification-head">
                      <span>Notifications</span>
                      {unreadNotifs.length > 0 && (
                        <button
                          type="button"
                          onClick={() => {
                            onMarkAllNotificationsRead();
                            setShowNotifMenu(false);
                          }}
                        >
                          Mark all read
                        </button>
                      )}
                    </div>
                    <div className="pvx-notification-list">
                      {notifications.length === 0 ? (
                        <div className="pvx-notification-empty">No notifications yet.</div>
                      ) : (
                        notifications.map((n) => (
                          <article key={n.id} className={!n.isRead ? 'is-unread' : ''}>
                            <div>
                              <strong>{n.title}</strong>
                              <p>{n.message}</p>
                              <small>{new Date(n.createdAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}</small>
                            </div>
                            {!n.isRead && (
                              <button type="button" onClick={() => onMarkNotificationRead(n.id)} aria-label="Mark notification as read">
                                <Check className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </article>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>

              <button id="sign-out-btn" type="button" onClick={onLogout} className="pvx-logout">
                <LogOut className="h-4 w-4" />
                <span>Logout</span>
              </button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
