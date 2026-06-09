/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { motion } from 'motion/react';
import { User, UserRole } from '../types';
import { Briefcase, Lock, Mail, User as UserIcon, ArrowRight, ShieldCheck, Sparkles, Building2, CheckCircle } from 'lucide-react';
import { CareerFlowBackground, GlassCard, AnimatedButton } from './motion';
import { tokens } from '../tokens';

interface AuthScreenProps {
  onLoginSuccess: (user: User) => void;
  apiFetch: (url: string, options?: RequestInit) => Promise<any>;
}

export default function AuthScreen({ onLoginSuccess, apiFetch }: AuthScreenProps) {
  const [isRegistering, setIsRegistering] = useState(false);
  const [role, setRole] = useState<UserRole>('candidate');
  
  // Form fields
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  // Preset demo accounts for quick testing
  const presets = [
    { name: 'Olivia (Persevex Admin)', email: 'admin@persevex.com', role: 'admin', desc: 'Verify companies, moderate jobs & screen candidate match metrics.' },
    { name: 'Sarah (AWS Recruiter)', email: 'hr@amazon.com', role: 'company', desc: 'Create technical specifications & hire candidate deliverables.' },
    { name: 'Alex (Full-Stack Engineer)', email: 'candidate@persevex.com', role: 'candidate', desc: 'Simulate text-matched profiles against live tech standards.' },
    { name: 'Monica (Frontend Designer)', email: 'monica@persevex.com', role: 'candidate', desc: 'Test profile creation with low keyword coverage to see score variations.' }
  ];

  const handlePresetLogin = async (presetEmail: string) => {
    setError('');
    setLoading(true);
    try {
      const response = await apiFetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: presetEmail, password: 'password123' }),
      });
      if (response.error) {
        setError(response.error);
      } else if (response.user) {
        onLoginSuccess(response.user);
      }
    } catch (err: any) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    
    if (!email || !password || (isRegistering && !name)) {
      setError('Please fill in all required fields.');
      return;
    }

    setLoading(true);
    const endpoint = isRegistering ? '/api/auth/register' : '/api/auth/login';
    const payload = isRegistering 
      ? { name, email, password, role }
      : { email, password };

    try {
      const response = await apiFetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (response.error) {
        setError(response.error);
      } else if (response.user) {
        if (isRegistering) {
          setSuccess('Registration successful! Logging you in...');
          setTimeout(() => {
            onLoginSuccess(response.user);
          }, 1200);
        } else {
          onLoginSuccess(response.user);
        }
      }
    } catch (err: any) {
      setError(err.message || 'Authentication error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Career Flow Background */}
      <CareerFlowBackground />

      <div className="relative z-10 flex items-center justify-center min-h-screen py-10 px-4 sm:px-6 lg:px-8">
        <motion.div
          className="max-w-6xl w-full grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
        >
          
          {/* Left Panel: App marketing benefits */}
          <GlassCard className="lg:col-span-5 bg-slate-900/80 backdrop-blur-xl p-8 sm:p-10 text-white flex flex-col justify-between">
            <motion.div
              className="space-y-6"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
            >
              <motion.div
                className="inline-flex items-center space-x-2 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 rounded-full"
                whileHover={{ scale: 1.05 }}
                transition={{ duration: 0.2 }}
              >
                <Sparkles className="h-4 w-4 text-emerald-400" />
                <span className="text-xs font-semibold text-emerald-300 uppercase tracking-wider">Quality First Hiring</span>
              </motion.div>
              
              <h1 className="text-3xl sm:text-4xl font-display font-bold leading-tight">
                Ecosystem for <span className="text-emerald-400">Verified</span> Talent Partnerships
              </h1>
              
              <p className="text-slate-400 text-sm leading-relaxed">
                We vet companies, screen requirements, and rank candidate profiles side-by-side using real-time resume keyword parsers. No spam, no dead ends.
              </p>

              <div className="space-y-4 pt-4">
                {[
                  { icon: CheckCircle, title: 'Weighted Skill Scores', desc: 'Instantly rank applicants based on primary and preferred technology stacks.' },
                  { icon: CheckCircle, title: 'Employer Verification KYC', desc: 'Prevent fake job postings. Only authorized clients can access talent databases.' },
                  { icon: CheckCircle, title: 'Persevex HR Gatekeepers', desc: 'Our administration screens candidates and provides verified referral statuses.' },
                ].map((item, idx) => (
                  <motion.div
                    key={idx}
                    className="flex items-start space-x-3"
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.4, delay: 0.3 + idx * 0.1 }}
                  >
                    <item.icon className="h-5 w-5 text-emerald-400 shrink-0 mt-0.5" />
                    <p className="text-slate-300 text-xs">
                      <strong className="text-white block font-medium">{item.title}</strong>
                      {item.desc}
                    </p>
                  </motion.div>
                ))}
              </div>
            </motion.div>

            <motion.div
              className="border-t border-slate-800 pt-6 mt-8"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.4, delay: 0.6 }}
            >
              <div className="flex items-center space-x-3">
                <div className="bg-slate-800 p-2 rounded-lg">
                  <ShieldCheck className="h-5 w-5 text-emerald-400" />
                </div>
                <span className="text-xs text-slate-400 font-mono">
                  Trusted by enterprise software partners.
                </span>
              </div>
            </motion.div>
          </GlassCard>

          {/* Right Panel: Auth forms */}
          <div className="lg:col-span-7 flex flex-col justify-between space-y-6">
            <GlassCard levitate>
              <motion.div
                className="flex justify-between items-center mb-8 border-b border-slate-100 pb-4"
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.3 }}
              >
                <span className="font-display text-xl font-bold text-slate-800">
                  {isRegistering ? 'Create Portal Account' : 'Sign In To Portal'}
                </span>
                <motion.button
                  onClick={() => {
                    setIsRegistering(!isRegistering);
                    setError('');
                    setSuccess('');
                  }}
                  className="text-xs font-semibold text-emerald-600 hover:text-emerald-700"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  {isRegistering ? 'Already have an account?' : 'Need to join the ecosystem?'}
                </motion.button>
              </motion.div>

              {error && (
                <motion.div
                  className="p-3 bg-red-50 border-l-4 border-red-500 rounded text-red-700 text-xs mb-6"
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                >
                  {error}
                </motion.div>
              )}

              {success && (
                <motion.div
                  className="p-3 bg-emerald-50 border-l-4 border-emerald-500 rounded text-emerald-800 text-xs mb-6"
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                >
                  {success}
                </motion.div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                {isRegistering && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3 }}
                  >
                    <label className="block text-xs font-semibold text-slate-600 tracking-wide uppercase mb-1">
                      Full Name / Contact Person
                    </label>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                        <UserIcon className="h-4 w-4" />
                      </span>
                      <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-slate-800 transition-all"
                        placeholder="e.g. Robert Downey"
                      />
                    </div>
                  </motion.div>
                )}

                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: isRegistering ? 0.1 : 0 }}
                >
                  <label className="block text-xs font-semibold text-slate-600 tracking-wide uppercase mb-1">
                    Email Address
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                      <Mail className="h-4 w-4" />
                    </span>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-slate-800 transition-all"
                      placeholder="you@corporate.com"
                    />
                  </div>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: isRegistering ? 0.2 : 0.1 }}
                >
                  <div className="flex justify-between items-center mb-1">
                    <label className="block text-xs font-semibold text-slate-600 tracking-wide uppercase">
                      Security Password
                    </label>
                    {!isRegistering && (
                      <span className="text-[11px] text-slate-400">Any password works for developer demo</span>
                    )}
                  </div>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                      <Lock className="h-4 w-4" />
                    </span>
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-slate-800 transition-all"
                      placeholder="••••••••"
                    />
                  </div>
                </motion.div>

                {isRegistering && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: 0.3 }}
                  >
                    <label className="block text-xs font-semibold text-slate-600 tracking-wide uppercase mb-2">
                      I want to sign up as a:
                    </label>
                    <div className="grid grid-cols-2 gap-4">
                      <motion.button
                        type="button"
                        onClick={() => setRole('candidate')}
                        className={`p-3 rounded-xl border text-center transition-all flex flex-col items-center justify-center space-y-1 ${
                          role === 'candidate'
                            ? 'border-emerald-500 bg-emerald-50/50 text-emerald-900 ring-2 ring-emerald-500/10 font-medium'
                            : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                        }`}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                      >
                        <UserIcon className="h-5 w-5" />
                        <span className="text-xs">Job Candidate</span>
                      </motion.button>
                      <motion.button
                        type="button"
                        onClick={() => setRole('company')}
                        className={`p-3 rounded-xl border text-center transition-all flex flex-col items-center justify-center space-y-1 ${
                          role === 'company'
                            ? 'border-emerald-500 bg-emerald-50/50 text-emerald-900 ring-2 ring-emerald-500/10 font-medium'
                            : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                        }`}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                      >
                        <Building2 className="h-5 w-5" />
                        <span className="text-xs">Corporate Employer</span>
                      </motion.button>
                    </div>
                  </motion.div>
                )}

                <AnimatedButton
                  type="submit"
                  disabled={loading}
                  variant="primary"
                  size="md"
                  className="w-full mt-2"
                >
                  {loading ? (
                    <span>Processing...</span>
                  ) : (
                    <>
                      <span>{isRegistering ? 'Register Portal Account' : 'Authenticate Credentials'}</span>
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </AnimatedButton>
              </form>
            </GlassCard>

            {/* Quick Demo Pre-set logins */}
            <GlassCard>
              <motion.h3
                className="text-xs font-bold text-slate-500 tracking-widest uppercase mb-4 text-center"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.4, delay: 0.5 }}
              >
                💡 Stakeholder Demonstration Fast-Login Presets
              </motion.h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {presets.map((p, idx) => (
                  <motion.button
                    key={idx}
                    type="button"
                    id={`preset-${p.role}-${idx}`}
                    disabled={loading}
                    onClick={() => handlePresetLogin(p.email)}
                    className="p-3 text-left bg-slate-50 hover:bg-emerald-50/40 hover:border-emerald-200 border border-slate-150 rounded-2xl transition-all cursor-pointer block group text-xs"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: 0.6 + idx * 0.1 }}
                    whileHover={{ scale: 1.02, y: -2 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <div className="flex justify-between items-center mb-1">
                      <span className="font-semibold text-slate-800 text-[11px] group-hover:text-emerald-700 transition-colors">
                        {p.name}
                      </span>
                      <span className="px-1.5 py-0.5 bg-slate-200 group-hover:bg-emerald-100 text-[9px] font-medium rounded text-slate-600 group-hover:text-emerald-800 uppercase scale-95 font-mono transition-colors">
                        {p.role}
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-500 leading-normal">
                      {p.desc}
                    </p>
                  </motion.button>
                ))}
              </div>
            </GlassCard>
          </div>
          
        </motion.div>
      </div>
    </div>
  );
}
