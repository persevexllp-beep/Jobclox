/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
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

interface AuthScreenProps {
  onLoginSuccess: (user: User, token: string) => void;
  apiFetch: (url: string, options?: RequestInit) => Promise<any>;
}

type AuthMode = 'login' | 'register' | 'forgot';

const journey = [
  { label: 'Jobs', icon: Briefcase },
  { label: 'Internship', icon: Briefcase },
  { label: 'Placement', icon: CheckCircle2 },
  { label: 'Career Growth', icon: Award },
];

export default function AuthScreen({ onLoginSuccess, apiFetch }: AuthScreenProps) {
  const [mode, setMode] = useState<AuthMode>('login');
  const [role, setRole] = useState<UserRole>('candidate');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

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
        setSuccess('If this email exists, a recovery workflow will be sent by the Persevex team.');
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
          setTimeout(() => onLoginSuccess(response.user, response.token), 700);
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
      <CareerFlowBackground particleCount={14} />
      <main className="auth-product-grid">
        <motion.section
          className="auth-hero-panel"
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <div className="auth-brand-lockup">
            <BrandLogo subline="Hiring & Placement Engine" />
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

          {error && <div className="auth-alert danger">{error}</div>}
          {success && <div className="auth-alert success">{success}</div>}

          <form onSubmit={handleSubmit} className="auth-form">
            {mode === 'register' && (
              <AuthField icon={UserIcon} label="Full name" value={name} onChange={setName} placeholder="Alex Mercer" />
            )}

            <AuthField icon={Mail} label="Email" type="email" value={email} onChange={setEmail} placeholder="you@company.com" />

            {mode !== 'forgot' && (
              <AuthField icon={Lock} label="Password" type="password" value={password} onChange={setPassword} placeholder="Password" />
            )}

            {mode === 'register' && (
              <div className="auth-role-grid">
                <button type="button" className={role === 'candidate' ? 'active' : ''} onClick={() => setRole('candidate')}>
                  <UserIcon className="h-4 w-4" />
                  Candidate
                </button>
                <button type="button" className={role === 'company' ? 'active' : ''} onClick={() => setRole('company')}>
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

            <button type="submit" className="auth-submit" disabled={loading}>
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

function AuthField({ icon: Icon, label, value, onChange, placeholder, type = 'text' }: {
  icon: React.ElementType;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  type?: string;
}) {
  return (
    <label className="auth-field">
      <span>{label}</span>
      <div>
        <Icon className="h-4 w-4 text-cyan-500" />
        <input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
      </div>
    </label>
  );
}
