import React, { useState } from 'react';
import { User, Mail, Lock, Phone, Sparkles, ArrowRight, CheckCircle2 } from 'lucide-react';
import { registerUser, loginUser } from '../services/api';
import { User as UserType } from '../types';

interface AuthPageProps {
  onAuthSuccess: (user: UserType) => void;
  onCancel?: () => void;
}

export const AuthPage: React.FC<AuthPageProps> = ({ onAuthSuccess, onCancel }) => {
  const [isRegister, setIsRegister] = useState(false);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mobile, setMobile] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (isRegister) {
        if (!fullName.trim()) throw new Error('Please enter your full name');
        if (!email.trim() || !email.includes('@')) throw new Error('Please enter a valid email address');
        if (password.length < 6) throw new Error('Password must be at least 6 characters');

        const res = await registerUser({
          full_name: fullName.trim(),
          email: email.trim(),
          password,
          mobile: mobile.trim() || undefined,
        });
        onAuthSuccess(res.user);
      } else {
        if (!email.trim()) throw new Error('Please enter your email');
        if (!password) throw new Error('Please enter your password');

        const res = await loginUser({
          email: email.trim(),
          password,
        });
        onAuthSuccess(res.user);
      }
    } catch (err: any) {
      setError(err.message || 'Authentication failed');
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto px-4 py-12">
      <div className="white-card p-8 border border-slate-200">
        <div className="text-center mb-6">
          <div className="w-12 h-12 bg-teal-50 text-teal-600 rounded-2xl flex items-center justify-center mx-auto mb-3 border border-teal-200 shadow-soft-sm">
            <Sparkles className="w-6 h-6" />
          </div>
          <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">
            {isRegister ? 'Create Your Account' : 'Welcome Back'}
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            {isRegister
              ? 'Track your speech progress, save personalized benchmark profiles, and access history.'
              : 'Sign in to access your speech evaluation records and custom targets.'}
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs font-medium">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {isRegister && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Full Name
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-400 absolute left-3 top-3.5" />
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Eleanor Vance"
                  className="w-full pl-9 pr-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Email Address
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3.5" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
                className="w-full pl-9 pr-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Password
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3.5" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-9 pr-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>
            {isRegister && (
              <span className="text-[11px] text-slate-400 mt-1 block">
                PBKDF2-HMAC-SHA256 hashed with 100,000 rounds.
              </span>
            )}
          </div>

          {isRegister && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Mobile Number <span className="text-slate-400 font-normal lowercase">(optional)</span>
              </label>
              <div className="relative">
                <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-3.5" />
                <input
                  type="tel"
                  value={mobile}
                  onChange={(e) => setMobile(e.target.value)}
                  placeholder="+1 (555) 234-5678"
                  className="w-full pl-9 pr-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 py-3 bg-teal-600 hover:bg-teal-700 text-white rounded-xl font-bold text-sm shadow-soft-teal transition-all flex items-center justify-center gap-2"
          >
            {loading ? (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                {isRegister ? 'Create Account' : 'Sign In'} <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        <div className="mt-6 pt-4 border-t border-slate-100 text-center">
          <button
            type="button"
            onClick={() => {
              setIsRegister(!isRegister);
              setError(null);
            }}
            className="text-xs font-semibold text-teal-700 hover:text-teal-900"
          >
            {isRegister
              ? 'Already have an account? Sign in here'
              : "Don't have an account yet? Register here"}
          </button>
        </div>
      </div>
    </div>
  );
};
