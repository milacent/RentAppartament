'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/store/auth';
import { authAPI } from '@/services/api';
import toast from 'react-hot-toast';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { setAuth } = useAuthStore();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data } = await authAPI.login(email, password);
      setAuth(data.access_token, data.refresh_token, {
        id: 1,
        email,
        is_active: true,
        created_at: new Date().toISOString(),
      });
      toast.success('Logged in successfully');
      router.push('/dashboard');
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#02030d] text-white">
      <div className="pointer-events-none absolute inset-0 opacity-70">
        <div className="absolute left-1/4 top-0 h-72 w-72 rounded-full bg-[#3b82f6]/20 blur-3xl" />
        <div className="absolute right-0 top-24 h-96 w-96 rounded-full bg-[#8b5cf6]/20 blur-3xl" />
      </div>

      <div className="relative z-10 flex min-h-screen items-center justify-center px-6 py-10">
        <div className="glass-card w-full max-w-lg border border-white/10 p-10 shadow-[0_40px_120px_-50px_rgba(59,130,246,0.35)]">
          <div className="mb-8 text-center">
            <div className="text-sm uppercase tracking-[0.35em] text-[#a5b4fc]">FairCost.AI</div>
            <h1 className="mt-4 text-4xl font-extrabold tracking-tight text-white">Login to your account</h1>
            <p className="mt-3 text-sm text-slate-300">Secure access to rental price forecasting and analytics.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-slate-200 mb-2">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-3xl border border-white/10 bg-white/5 px-5 py-3 text-white shadow-inner shadow-slate-900/20 outline-none transition focus:border-[#3b82f6] focus:ring-2 focus:ring-[#3b82f6]/20"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-200 mb-2">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-3xl border border-white/10 bg-white/5 px-5 py-3 text-white shadow-inner shadow-slate-900/20 outline-none transition focus:border-[#6366f1] focus:ring-2 focus:ring-[#6366f1]/20"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-full bg-gradient-to-r from-[#3b82f6] via-[#6366f1] to-[#a78bfa] px-6 py-3 text-base font-semibold text-white shadow-[0_24px_80px_-40px_rgba(59,130,246,0.7)] transition hover:brightness-110 disabled:opacity-50"
            >
              {loading ? 'Logging in...' : 'Login'}
            </button>
          </form>

          <p className="mt-8 text-center text-sm text-slate-400">
            Don&apos;t have an account?{' '}
            <Link href="/auth/register" className="font-semibold text-white hover:text-[#c7d2fe]">
              Register here
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
