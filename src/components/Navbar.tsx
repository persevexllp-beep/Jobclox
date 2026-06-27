/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

'use client';

import React, { useEffect, useId, useRef, useState } from 'react';
import { AppNotification, User } from '../types';
import { Bell, Check, CheckCircle2, ChevronDown, LogOut, Menu, Moon, ShieldAlert, Sun, Trash2, UserCheck, X } from 'lucide-react';
import BrandLogo from './BrandLogo';
import { formatNotificationPreview } from '../utils/messageFormatting';
import type { ToastTone } from './ToastViewport';
import UserAvatar from './UserAvatar';
import { useTheme } from '@/src/lib/theme';
import Button from '@/src/components/ui/Button';
import EmptyState from '@/src/components/ui/EmptyState';
import { branding } from '@/src/config/branding';

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
  const theme = useTheme();
  const [showNotifMenu, setShowNotifMenu] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const notificationMenuId = useId();
  const mobileMenuId = useId();
  const notifRef = useRef<HTMLDivElement>(null);
  const mobileMenuRef = useRef<HTMLDivElement>(null);
  const unreadNotifs = notifications.filter((n) => !n.isRead);
  const role = currentUser ? roleLabels[currentUser.role] : null;
  const RoleIcon = role?.icon;

  useEffect(() => {
    if (!showNotifMenu && !showMobileMenu) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
        setShowNotifMenu(false);
      }
      if (mobileMenuRef.current && !mobileMenuRef.current.contains(event.target as Node)) {
        setShowMobileMenu(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setShowNotifMenu(false);
        setShowMobileMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [showMobileMenu, showNotifMenu]);

  const handleLogoutClick = () => {
    onLogout();
    showToast('info', 'Signed out', 'Your session has been cleared safely.');
  };

  return (
    <header className="pvx-header" data-role={currentUser?.role}>
      <div className="pvx-header-inner">
          <div className="pvx-logo">
            <BrandLogo subline={branding.tagline} />
          </div>

          <div className="pvx-header-actions">
            <button
              type="button"
              onClick={onToggleTheme}
              className="pvx-icon-button"
              aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {theme === 'dark' ? <Sun className="h-4 w-4" style={{ color: 'var(--pvx-warning)' }} /> : <Moon className="h-4 w-4" />}
            </button>

            {currentUser && role && RoleIcon && (
              <>
                <div className="pvx-role-pill">
                  <RoleIcon className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>{role.label}</span>
                </div>

                <div className="pvx-user-lockup">
                  <UserAvatar
                    name={currentUser.name}
                    src={currentUser.profilePhotoUrl}
                    className="pvx-navbar-avatar"
                    fallbackClassName="pvx-navbar-avatar-fallback"
                  />
                  <div>
                    <span>{currentUser.name}</span>
                    <small>{currentUser.email}</small>
                  </div>
                </div>

                <div className="relative" ref={notifRef}>
                  <button
                    id="notif-bell-btn"
                    type="button"
                    onClick={() => setShowNotifMenu((prev) => !prev)}
                    className="pvx-icon-button"
                    aria-label={`Notifications${unreadNotifs.length > 0 ? `, ${unreadNotifs.length} unread` : ''}`}
                    aria-expanded={showNotifMenu}
                    aria-controls={notificationMenuId}
                    aria-haspopup="dialog"
                  >
                    <Bell className="h-4 w-4" />
                    {unreadNotifs.length > 0 && <em aria-hidden="true">{unreadNotifs.length}</em>}
                  </button>

                  {showNotifMenu && (
                    <section
                      id={notificationMenuId}
                      className="pvx-notification-menu"
                      role="dialog"
                      aria-modal="false"
                      aria-label="Notifications"
                    >
                      <div className="pvx-notification-head">
                        <span>Notifications</span>
                        <div className="flex gap-2">
                          {unreadNotifs.length > 0 && (
                            <button
                              type="button"
                              onClick={() => {
                                onMarkAllNotificationsRead();
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
                          <EmptyState
                            icon={Bell}
                            title="All caught up"
                            description="New activity about your applications, jobs, and account will appear here."
                            className="py-8"
                          />
                        ) : (
                          <ul role="list">
                            {notifications.map((n) => {
                              const preview = formatNotificationPreview(n);
                              return (
                                <li key={n.id}>
                                  <article className={!n.isRead ? 'is-unread' : ''}>
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
                                </li>
                              );
                            })}
                          </ul>
                        )}
                      </div>
                    </section>
                  )}
                </div>

                <Button
                  id="sign-out-btn"
                  variant="ghost"
                  size="sm"
                  onClick={handleLogoutClick}
                  leftIcon={<LogOut className="h-4 w-4" />}
                  className="pvx-logout"
                >
                  Logout
                </Button>

                <div className="pvx-mobile-account" ref={mobileMenuRef}>
                  <button
                    type="button"
                    className="pvx-mobile-menu-trigger"
                    onClick={() => {
                      setShowMobileMenu((open) => !open);
                      setShowNotifMenu(false);
                    }}
                    aria-label={showMobileMenu ? 'Close account menu' : 'Open account menu'}
                    aria-expanded={showMobileMenu}
                    aria-controls={mobileMenuId}
                  >
                    <UserAvatar
                      name={currentUser.name}
                      src={currentUser.profilePhotoUrl}
                      className="pvx-mobile-menu-avatar"
                      fallbackClassName="pvx-mobile-menu-avatar-fallback"
                    />
                    {showMobileMenu ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
                  </button>

                  {showMobileMenu && (
                    <section id={mobileMenuId} className="pvx-mobile-account-menu" aria-label="Account and display settings">
                      <div className="pvx-mobile-account-identity">
                        <UserAvatar
                          name={currentUser.name}
                          src={currentUser.profilePhotoUrl}
                          className="pvx-mobile-account-avatar"
                          fallbackClassName="pvx-mobile-account-avatar-fallback"
                        />
                        <span><strong>{currentUser.name}</strong><small>{currentUser.email}</small></span>
                        <span className="pvx-mobile-role"><RoleIcon className="h-3.5 w-3.5" />{role.label}</span>
                      </div>
                      <button type="button" className="pvx-mobile-menu-row" onClick={onToggleTheme}>
                        <span>{theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}<strong>Appearance</strong></span>
                        <small>{theme === 'dark' ? 'Light mode' : 'Dark mode'}</small>
                        <ChevronDown className="h-4 w-4 -rotate-90" aria-hidden="true" />
                      </button>
                      <button type="button" className="pvx-mobile-menu-row is-danger" onClick={handleLogoutClick}>
                        <span><LogOut className="h-4 w-4" /><strong>Sign out</strong></span>
                        <ChevronDown className="h-4 w-4 -rotate-90" aria-hidden="true" />
                      </button>
                    </section>
                  )}
                </div>
              </>
            )}
          </div>
      </div>
    </header>
  );
}

export default React.memo(Navbar);
