/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { AppNotification, User } from '../types';
import { Bell, Check, CheckCircle2, LogOut, Moon, ShieldAlert, Sun, Trash2, UserCheck } from 'lucide-react';
import BrandLogo from './BrandLogo';
import { formatNotificationPreview } from '../utils/messageFormatting';
import type { ToastTone } from './ToastViewport';
import UserAvatar from './UserAvatar';
import { useTheme } from '@/src/lib/theme';
import { trackProfilerCommit, useRenderTracker } from '@/src/lib/perfMonitor';

interface NavbarProps {
  currentUser: User | null;
  notifications: AppNotification[];
  onLogout: () => void;
  onMarkNotificationRead: (id: string) => void;
  onMarkAllNotificationsRead: () => void;
  onDeleteNotification: (id: string) => void;
  onClearAllNotifications: () => void;
  onToggleTheme: () => void;
  showToast: (tone: ToastTone, title: string, message?: string) => void;
}

const roleLabels = {
  admin: { label: 'Admin', icon: ShieldAlert },
  company: { label: 'Recruiter', icon: UserCheck },
  candidate: { label: 'Candidate', icon: CheckCircle2 },
};

function Navbar({
  currentUser,
  notifications,
  onLogout,
  onMarkNotificationRead,
  onMarkAllNotificationsRead,
  onDeleteNotification,
  onClearAllNotifications,
  onToggleTheme,
  showToast,
}: NavbarProps) {
  useRenderTracker('Navbar');
  const theme = useTheme();
  const [showNotifMenu, setShowNotifMenu] = useState(false);
  const unreadNotifs = notifications.filter((n) => !n.isRead);
  const role = currentUser ? roleLabels[currentUser.role] : null;
  const RoleIcon = role?.icon;

  const handleLogoutClick = () => {
    onLogout();
    showToast('info', 'Signed out', 'Your session has been cleared safely.');
  };

  return (
    <React.Profiler id="Navbar" onRender={(_id, phase, actualDuration) => trackProfilerCommit('Navbar', phase, actualDuration)}>
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
                <UserAvatar
                  name={currentUser.name}
                  src={currentUser.profilePhotoUrl}
                  className="pvx-navbar-avatar"
                  fallbackClassName="pvx-navbar-avatar-fallback"
                />
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
                      <div>
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
                        {notifications.length > 0 && (
                          <button
                            type="button"
                            onClick={() => {
                              onClearAllNotifications();
                              setShowNotifMenu(false);
                            }}
                          >
                            Clear all
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="pvx-notification-list">
                      {notifications.length === 0 ? (
                        <div className="pvx-notification-empty">No notifications yet.</div>
                      ) : (
                        notifications.map((n) => {
                          const preview = formatNotificationPreview(n);
                          return (
                            <article key={n.id} className={!n.isRead ? 'is-unread' : ''}>
                              <div>
                                <strong>{n.title}</strong>
                                <p>{preview.summary}</p>
                                <small>{new Date(n.createdAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}</small>
                              </div>
                              <div className="pvx-notification-actions">
                                {!n.isRead && (
                                  <button type="button" onClick={() => onMarkNotificationRead(n.id)} aria-label="Mark notification as read">
                                    <Check className="h-3.5 w-3.5" />
                                  </button>
                                )}
                                <button type="button" onClick={() => onDeleteNotification(n.id)} aria-label="Delete notification">
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            </article>
                          );
                        })
                      )}
                    </div>
                  </div>
                )}
              </div>

              <button id="sign-out-btn" type="button" onClick={handleLogoutClick} className="pvx-logout">
                <LogOut className="h-4 w-4" />
                <span>Logout</span>
              </button>
            </>
          )}
        </div>
        </div>
      </header>
    </React.Profiler>
  );
}

export default React.memo(Navbar);
