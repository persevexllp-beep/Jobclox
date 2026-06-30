/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import Link from 'next/link';
import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import {
  ArrowRight,
  Award,
  Briefcase,
  Building2,
  CheckCircle2,
  Clock3,
  FileCheck2,
  FileText,
  Lock,
  Mail,
  RotateCcw,
  ShieldCheck,
  UploadCloud,
  User as UserIcon,
} from 'lucide-react';
import { User, UserRole } from '../types';
import { CareerFlowBackground } from './motion';
import BrandLogo from './BrandLogo';
import type { ToastTone } from './ToastViewport';
import { branding } from '@/src/config/branding';

interface AuthScreenProps {
  onLoginSuccess: (user: User, token: string) => void;
  apiFetch: (url: string, options?: RequestInit) => Promise<any>;
  showToast: (tone: ToastTone, title: string, message?: string) => void;
}

type AuthMode = 'login' | 'register' | 'forgot';
type AuthAudience = 'candidate' | 'company';
type ApprovalState = 'pending' | 'rejected' | null;

const journey = [
  { label: 'Jobs', icon: Briefcase },
  { label: 'Internship', icon: Briefcase },
  { label: 'Placement', icon: CheckCircle2 },
  { label: 'Career Growth', icon: Award },
];

export default function AuthScreen({ onLoginSuccess, apiFetch, showToast }: AuthScreenProps) {
  const [mode, setMode] = useState<AuthMode>('login');
  const [role] = useState<UserRole>('company');
  const [audience, setAudience] = useState<AuthAudience>('candidate');
  const [name, setName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [companyDocument, setCompanyDocument] = useState<File | null>(null);
  const [approvalState, setApprovalState] = useState<ApprovalState>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const requestedMode = params.get('mode');
    const requestedRole = params.get('role');
    if (requestedMode === 'forgot') setMode('forgot');
    if (requestedMode === 'register') {
      setMode(requestedRole === 'candidate' ? 'login' : 'register');
      setAudience(requestedRole === 'candidate' ? 'candidate' : 'company');
    } else if (requestedRole === 'company') {
      setAudience('company');
    }
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
        const message = `If this email exists, a recovery workflow will be sent by the ${branding.productName} team.`;
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

    if (mode === 'register' && (!companyName.trim() || !companyDocument)) {
      setError('Add your company name and verification document to continue.');
      return;
    }

    if (mode === 'register' && companyDocument) {
      const allowedDocumentTypes = ['application/pdf', 'image/png', 'image/jpeg', 'image/webp'];
      if (!allowedDocumentTypes.includes(companyDocument.type)) {
        setError('Company document must be PDF, PNG, JPG, or WebP.');
        return;
      }
      if (companyDocument.size > 6 * 1024 * 1024) {
        setError('Company document must be 6MB or smaller.');
        return;
      }
    }

    setLoading(true);
    try {
      const registrationDocument = mode === 'register' && companyDocument
        ? await readFileAsDataUrl(companyDocument)
        : null;
      const response = await apiFetch(mode === 'register' ? '/api/auth/register' : '/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(mode === 'register' ? {
          name,
          companyName: companyName.trim(),
          email,
          password,
          role,
          document: {
            base64: registrationDocument,
            fileName: companyDocument?.name,
            mimeType: companyDocument?.type,
          },
        } : { email, password }),
      });

      if (response.approvalRequired) {
        setApprovalState(response.verificationStatus === 'rejected' ? 'rejected' : 'pending');
        showToast(
          'info',
          response.verificationStatus === 'rejected' ? 'Registration needs attention' : 'Verification request sent',
          response.message,
        );
        return;
      }

      if (response.user) {
        onLoginSuccess(response.user, response.token);
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
            <Link href="/" aria-label={`Back to ${branding.productName} home`}><BrandLogo subline={branding.tagline} /></Link>
          </div>

          <div>
            <p className="auth-eyebrow">Jobs, internships, placement</p>
            <h1>Find verified jobs and internships through {branding.productName}.</h1>
            <p className="auth-hero-copy">
              {branding.productName} helps freshers, final-year students, and early-career talent apply faster, track applications clearly, and grow toward placement.
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
          {approvalState ? (
            <ApprovalNotice status={approvalState} />
          ) : (
            <>
              <div className="auth-card-head">
                <div>
                  <p className="auth-eyebrow">{mode === 'register' ? 'Recruiter access' : mode === 'forgot' ? 'Account recovery' : audience === 'company' ? 'Recruiter access' : 'Student access'}</p>
                  <h2>{mode === 'register' ? 'Register as admin' : mode === 'forgot' ? 'Reset access' : audience === 'company' ? 'Recruiter login' : 'Student login'}</h2>
                </div>
              </div>

              {error && <div className="auth-alert danger" role="alert">{error}</div>}
              {success && <div className="auth-alert success" role="status">{success}</div>}

              <form id="auth-form" onSubmit={handleSubmit} className="auth-form">
                {mode === 'register' && (
                  <>
                    <AuthField icon={UserIcon} label="Full name" value={name} onChange={setName} placeholder="Your name" autoComplete="name" />
                    <AuthField icon={Building2} label="Company name" value={companyName} onChange={setCompanyName} placeholder="Registered company name" autoComplete="organization" />
                  </>
                )}

                <AuthField icon={Mail} label="Email" type="email" value={email} onChange={setEmail} placeholder="Email address" autoComplete="email" inputMode="email" />

                {mode !== 'forgot' && (
                  <AuthField icon={Lock} label="Password" type="password" value={password} onChange={setPassword} placeholder="Password" autoComplete={mode === 'register' ? 'new-password' : 'current-password'} />
                )}

                {mode === 'register' && (
                  <>
                    <CompanyDocumentField file={companyDocument} onChange={setCompanyDocument} />
                    <div className="auth-register-note">
                      <ShieldCheck className="h-4 w-4" />
                      <span>Your account stays locked until the Persevex admin verifies your company document.</span>
                    </div>
                  </>
                )}

                {mode === 'login' && (
                  <button type="button" className="auth-forgot" onClick={() => switchMode('forgot')}>
                    Forgot password?
                  </button>
                )}

                <button type="submit" className="auth-submit" disabled={loading} aria-busy={loading || undefined}>
                  {loading ? 'Processing...' : mode === 'register' ? 'Submit for verification' : mode === 'forgot' ? 'Send recovery instructions' : 'Enter workspace'}
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
                <span>Use your verified {branding.productName} account to access jobs, internships, applications, and placement updates.</span>
              </div>
            </>
          )}
        </motion.section>
      </main>
      <footer className="auth-footer">
        <small>{branding.footer}</small>
      </footer>
    </div>
  );
}

function CompanyDocumentField({ file, onChange }: { file: File | null; onChange: (file: File | null) => void }) {
  return (
    <label className="auth-document-field">
      <span>Company verification document</span>
      <div className={file ? 'has-file' : undefined}>
        {file ? <FileCheck2 className="h-5 w-5" /> : <UploadCloud className="h-5 w-5" />}
        <span>
          <strong>{file?.name || 'Upload company document'}</strong>
          <small>{file ? 'Ready for admin review' : 'PDF, PNG, JPG or WebP · up to 6MB'}</small>
        </span>
        <input
          type="file"
          accept="application/pdf,image/png,image/jpeg,image/webp"
          onChange={(event) => onChange(event.target.files?.[0] || null)}
          required
        />
      </div>
    </label>
  );
}

function ApprovalNotice({ status }: { status: Exclude<ApprovalState, null> }) {
  const rejected = status === 'rejected';
  return (
    <div className="auth-approval-state" role="status" aria-live="polite">
      <span className={rejected ? 'is-rejected' : undefined}>
        {rejected ? <FileText className="h-7 w-7" /> : <Clock3 className="h-7 w-7" />}
      </span>
      <p className="auth-eyebrow">{rejected ? 'Verification update' : 'Verification pending'}</p>
      <h2>{rejected ? 'Your registration needs attention' : 'Your request has been forwarded'}</h2>
      <p>
        {rejected
          ? 'Your company profile was not approved. Please contact the Persevex admin team for the next verification step.'
          : 'Your request has been forwarded to the Persevex admin. You will get access when your company profile is verified.'}
      </p>
      {!rejected && (
        <div>
          <CheckCircle2 className="h-4 w-4" />
          <span>Company document received</span>
        </div>
      )}
    </div>
  );
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('The company document could not be read.'));
    reader.readAsDataURL(file);
  });
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
