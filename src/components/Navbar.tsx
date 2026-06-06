/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { User, AppNotification } from '../types';
import { Briefcase, Bell, LogOut, CheckCircle2, UserCheck, ShieldAlert, Check, Sun, Moon } from 'lucide-react';

interface NavbarProps {
  currentUser: User | null;
  notifications: AppNotification[];
  onLogout: () => void;
  onMarkNotificationRead: (id: string) => void;
  onMarkAllNotificationsRead: () => void;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
}

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

  return (
    <header className="bg-slate-900 text-white border-b border-slate-800 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <div className="flex items-center space-x-3">
            <div className="bg-emerald-500 text-slate-950 p-2 rounded-lg flex items-center justify-center shadow-lg shadow-emerald-500/10">
              <Briefcase className="h-5 w-5 stroke-[2.5]" />
            </div>
            <div>
              <span className="font-display font-bold text-lg tracking-tight select-none">
                PERSEVEX
              </span>
              <span className="text-xs text-emerald-400 font-mono tracking-widest block -mt-1 font-semibold">
                PORTAL
              </span>
            </div>
          </div>

          {/* User information / actions */}
          <div className="flex items-center space-x-3">
            {/* Theme Toggle Button */}
            <button
              onClick={onToggleTheme}
              className="p-2 text-slate-300 hover:text-white hover:bg-slate-800 bg-slate-800/45 border border-slate-700/50 rounded-xl transition-all cursor-pointer flex items-center justify-center focus:outline-none"
              title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            >
              {theme === 'dark' ? (
                <Sun className="h-4.5 w-4.5 text-amber-400" />
              ) : (
                <Moon className="h-4.5 w-4.5 text-slate-300" />
              )}
            </button>

            {currentUser && (
              <div className="flex items-center space-x-4">
                {/* Role badge */}
                <div className="hidden sm:flex items-center space-x-1 px-3 py-1 bg-slate-800 border border-slate-700 rounded-full text-xs font-medium">
                  {currentUser.role === 'admin' && (
                    <>
                      <ShieldAlert className="h-3 w-3 text-red-400 mr-0.5" />
                      <span className="text-red-300">Persevex Admin</span>
                    </>
                  )}
                  {currentUser.role === 'company' && (
                    <>
                      <UserCheck className="h-3 w-3 text-emerald-400 mr-0.5" />
                      <span className="text-emerald-300">Corporate Recruiter</span>
                    </>
                  )}
                  {currentUser.role === 'candidate' && (
                    <>
                      <CheckCircle2 className="h-3 w-3 text-blue-400 mr-0.5" />
                      <span className="text-blue-300">Verified Candidate</span>
                    </>
                  )}
                </div>

                {/* Greeting */}
                <div className="hidden md:block text-right">
                  <span className="text-xs text-slate-400 block -mb-0.5">Signed in as</span>
                  <span className="text-sm font-semibold text-slate-100">{currentUser.name}</span>
                </div>

                {/* Notification bell */}
                <div className="relative">
                  <button
                    id="notif-bell-btn"
                    onClick={() => setShowNotifMenu(!showNotifMenu)}
                    className="p-2 text-slate-300 hover:text-white hover:bg-slate-800 rounded-full transition-colors relative"
                    title="Notifications"
                  >
                    <Bell className="h-5 w-5" />
                    {unreadNotifs.length > 0 && (
                      <span className="absolute top-1 right-1 h-4 w-4 bg-red-500 text-[10px] font-bold text-white rounded-full flex items-center justify-center animate-pulse">
                        {unreadNotifs.length}
                      </span>
                    )}
                  </button>

                  {/* Notifications dropdown list */}
                  {showNotifMenu && (
                    <div className="absolute right-0 mt-3 w-80 bg-white text-slate-900 rounded-xl shadow-2xl border border-slate-200 overflow-hidden z-50">
                      <div className="px-4 py-3 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                        <span className="text-xs font-semibold text-slate-700 tracking-wider uppercase">
                          Recent Notifications
                        </span>
                        {unreadNotifs.length > 0 && (
                          <button
                            onClick={() => {
                              onMarkAllNotificationsRead();
                              setShowNotifMenu(false);
                            }}
                            className="text-[11px] font-medium text-emerald-600 hover:text-emerald-700 hover:underline"
                          >
                            Mark all read
                          </button>
                        )}
                      </div>

                      <div className="max-h-72 overflow-y-auto divide-y divide-slate-100">
                        {notifications.length === 0 ? (
                          <div className="p-6 text-center text-xs text-slate-400">
                            No notifications at present.
                          </div>
                        ) : (
                          notifications.map((n) => (
                            <div
                              key={n.id}
                              className={`p-3 text-left hover:bg-slate-50 transition-colors ${
                                !n.isRead ? 'bg-slate-50/70 font-medium' : ''
                              }`}
                            >
                              <div className="flex justify-between items-start">
                                <span className="text-xs font-semibold text-slate-800">
                                  {n.title}
                                </span>
                                {!n.isRead && (
                                  <button
                                    onClick={() => onMarkNotificationRead(n.id)}
                                    className="text-slate-400 hover:text-emerald-600 p-0.5 rounded"
                                    title="Mark as read"
                                  >
                                    <Check className="h-3 w-3" />
                                  </button>
                                )}
                              </div>
                              <p className="text-xs text-slate-500 mt-1 leading-snug">
                                {n.message}
                              </p>
                              <span className="text-[10px] text-slate-400 mt-1 block">
                                {new Date(n.createdAt).toLocaleTimeString([], {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </span>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Logout button */}
                <button
                  id="sign-out-btn"
                  onClick={onLogout}
                  className="flex items-center justify-center space-x-1 px-3 py-2 text-slate-300 hover:text-white bg-slate-800 hover:bg-red-950/40 hover:border-red-900 border border-slate-700 rounded-lg text-sm font-medium transition-all"
                  title="Sign Out"
                >
                  <LogOut className="h-4 w-4" />
                  <span className="hidden sm:inline">Logout</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
