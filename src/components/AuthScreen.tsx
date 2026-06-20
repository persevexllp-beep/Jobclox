/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import Link from 'next/link';
import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import {
  ArrowRight,
  Award,
  Briefcase,
  Building2,
  CheckCircle2,
  Lock,
  Mail,
  RotateCcw,
  ShieldCheck,
  User as UserIcon,
} from 'lucide-react';
import { User, UserRole } from '../types';
import { CareerFlowBackground } from './motion';
import BrandLogo from './BrandLogo';
import type { ToastTone } from './ToastViewport';

interface AuthScreenProps {
  onLoginSuccess: (user: User, token: string) => void;
  apiFetch: (url: string, options?: RequestInit) => Promise<any>;
  showToast: (tone: ToastTone, title: string, message?: string) => void;
}

type AuthMode = 'login' | 'register' | 'forgot';

const journey = [
  { label: 'Jobs', icon: Briefcase },
  { label: 'Internship', icon: Briefcase },
  { label: 'Placement', icon: CheckCircle2 },
  { label: 'Career Growth', icon: Award },
];

export default function AuthScreen({ onLoginSuccess, apiFetch, showToast }: AuthScreenProps) {
  const loginSuccessTimerRef = useRef<number | null>(null);
  const [mode, setMode] = useState<AuthMode>('login');
  const [role, setRole] = useState<UserRole>('candidate');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => () => {
    if (loginSuccessTimerRef.current !== null) {
      window.clearTimeout(loginSuccessTimerRef.current);
    }
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const requestedMode = params.get('mode');
    const requestedRole = params.get('role');
    if (requestedMode === 'register' || requestedMode === 'forgot') setMode(requestedMode);
    if (requestedRole === 'candidate' || requestedRole === 'company') setRole(requestedRole);
  }, []);

  const resetFeedback = () => {
    setError('');
    setSuccess('');
  };

  const switchMode = (nextMode: AuthMode) => {
    resetFeedback();
    setMode(nextMode);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    resetFeedback();

    if (mode === 'forgot') {
      if (!email) {
        setError('Enter your email address to continue.');
        return;
      }
      setLoading(true);
      try {
        await apiFetch('/api/auth/forgot-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email }),
        });
        const message = 'If this email exists, a recovery workflow will be sent by the Persevex team.';
        setSuccess(message);
        showToast('info', 'Recovery requested', message);
      } catch (err: any) {
        setError(err.message || 'Recovery workflow could not be started.');
      } finally {
        setLoading(false);
      }
      return;
    }

    if (!email || !password || (mode === 'register' && !name)) {
      setError('Please complete all required fields.');
      return;
    }

    setLoading(true);
    try {
      const response = await apiFetch(mode === 'register' ? '/api/auth/register' : '/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(mode === 'register' ? { name, email, password, role } : { email, password }),
      });

      if (response.user) {
        if (mode === 'register') {
          setSuccess('Account created. Opening your workspace...');
          showToast('success', 'Account created', 'Opening your workspace now.');
          loginSuccessTimerRef.current = window.setTimeout(() => onLoginSuccess(response.user, response.token), 700);
        } else {
          onLoginSuccess(response.user, response.token);
        }
      }
    } catch (err: any) {
      setError(err.message || 'Authentication error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-product-shell">
      <a className="pvx-skip-link" href="#auth-form">Skip to sign in</a>
      <CareerFlowBackground particleCount={14} />
      <main className="auth-product-grid">
        <motion.section
          className="auth-hero-panel"
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <div className="auth-brand-lockup">
            <Link href="/" aria-label="Back to Persevex home"><BrandLogo subline="Hiring & Placement Engine" /></Link>
          </div>

          <div>
            <p className="auth-eyebrow">Jobs, internships, placement</p>
            <h1>Find verified jobs and internships through Persevex.</h1>
            <p className="auth-hero-copy">
              The Persevex hiring engine helps freshers, final-year students, and early-career talent apply faster, track applications clearly, and grow toward placement.
            </p>
          </div>

          <div className="auth-journey">
            {journey.map((item, index) => {
              const Icon = item.icon;
              return (
                <div key={item.label}>
                  <span><Icon className="h-4 w-4" /></span>
                  <strong>{item.label}</strong>
                  {index < journey.length - 1 && <i />}
                </div>
              );
            })}
          </div>
        </motion.section>

        <motion.section
          className="auth-card"
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.06 }}
        >
          <div className="auth-card-head">
            <div>
              <p className="auth-eyebrow">{mode === 'register' ? 'Create account' : mode === 'forgot' ? 'Account recovery' : 'Welcome back'}</p>
              <h2>{mode === 'register' ? 'Join Persevex' : mode === 'forgot' ? 'Reset access' : 'Sign in'}</h2>
            </div>
            <button type="button" onClick={() => switchMode(mode === 'register' ? 'login' : 'register')}>
              {mode === 'register' ? 'Sign in' : 'Register'}
            </button>
          </div>

          {error && <div className="auth-alert danger" role="alert">{error}</div>}
          {success && <div className="auth-alert success" role="status">{success}</div>}

          <form id="auth-form" onSubmit={handleSubmit} className="auth-form">
            {mode === 'register' && (
              <AuthField icon={UserIcon} label="Full name" value={name} onChange={setName} placeholder="Your name" autoComplete="name" />
            )}

            <AuthField icon={Mail} label="Email" type="email" value={email} onChange={setEmail} placeholder="Email address" autoComplete="email" inputMode="email" />

            {mode !== 'forgot' && (
              <AuthField icon={Lock} label="Password" type="password" value={password} onChange={setPassword} placeholder="Password" autoComplete={mode === 'register' ? 'new-password' : 'current-password'} />
            )}

            {mode === 'register' && (
              <div className="auth-role-grid" role="group" aria-label="Choose account type">
                <button type="button" aria-pressed={role === 'candidate'} className={role === 'candidate' ? 'active' : ''} onClick={() => setRole('candidate')}>
                  <UserIcon className="h-4 w-4" />
                  Candidate
                </button>
                <button type="button" aria-pressed={role === 'company'} className={role === 'company' ? 'active' : ''} onClick={() => setRole('company')}>
                  <Building2 className="h-4 w-4" />
                  Employer
                </button>
              </div>
            )}

            {mode === 'login' && (
              <button type="button" className="auth-forgot" onClick={() => switchMode('forgot')}>
                Forgot password?
              </button>
            )}

            <button type="submit" className="auth-submit" disabled={loading} aria-busy={loading || undefined}>
              {loading ? 'Processing...' : mode === 'register' ? 'Create account' : mode === 'forgot' ? 'Send recovery instructions' : 'Enter workspace'}
              <ArrowRight className="h-4 w-4" />
            </button>

            {mode === 'forgot' && (
              <button type="button" className="auth-secondary-action" onClick={() => switchMode('login')}>
                <RotateCcw className="h-4 w-4" />
                Back to sign in
              </button>
            )}
          </form>

          <div className="auth-security-note">
            <ShieldCheck className="h-4 w-4" />
            <span>Use your verified Persevex account to access jobs, internships, applications, and placement updates.</span>
          </div>
        </motion.section>
      </main>
    </div>
  );
}

function AuthField({ icon: Icon, label, value, onChange, placeholder, type = 'text', autoComplete, inputMode }: {
  icon: React.ElementType;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  type?: string;
  autoComplete?: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>['inputMode'];
}) {
  return (
    <label className="auth-field">
      <span>{label}</span>
      <div>
        <Icon className="h-4 w-4 text-cyan-500" />
        <input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} autoComplete={autoComplete} inputMode={inputMode} required />
      </div>
    </label>
  );
}
