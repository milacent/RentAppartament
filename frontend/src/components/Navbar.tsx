'use client';

import { useAuthStore } from '@/store/auth';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { authAPI } from '@/services/api';
import { useEffect, useState } from 'react';

export default function Navbar() {
  const router = useRouter();
  const { user, logout, initializeAuth } = useAuthStore();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    initializeAuth();
  }, [initializeAuth]);

  const handleLogout = async () => {
    try {
      await authAPI.logout();
      logout();
      toast.success('Logged out successfully');
      router.push('/');
    } catch {
      toast.error('Logout failed');
    }
  };

  return (
    <nav className="glass fixed left-0 right-0 top-0 z-50 border-b border-white/6">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <Link href="/" className="inline-flex items-center gap-3">
            <div className="text-left">
              <div className="text-2xl font-extrabold tracking-tight text-white">
                FairCost<span className="text-[#a78bfa]">.AI</span>
              </div>
              <div className="text-[11px] uppercase tracking-[0.35em] text-slate-400">Rental forecast</div>
            </div>
          </Link>

          <div className="hidden md:flex items-center gap-4">
            {user ? (
              <>
                <Link href="/dashboard" className="text-slate-100 hover:text-[#c7d2fe] transition">
                  Dashboard
                </Link>
                <Link href="/analytics" className="text-slate-100 hover:text-[#c7d2fe] transition">
                  Analytics
                </Link>
                <div className="flex items-center gap-3">
                  <span className="text-sm text-slate-200 truncate max-w-[180px]">{user.email}</span>
                  <button
                    onClick={handleLogout}
                    className="inline-flex items-center rounded-full border border-white/10 bg-gradient-to-r from-[#3b82f6]/90 via-[#6366f1]/90 to-[#a78bfa]/90 px-4 py-2 text-sm font-semibold text-white shadow-[0_20px_50px_-25px_rgba(59,130,246,0.7)] transition hover:brightness-110"
                  >
                    Logout
                  </button>
                </div>
              </>
            ) : (
              <>
                <Link
                  href="/auth/login"
                  className="text-slate-100 hover:text-[#c7d2fe] transition"
                >
                  Login
                </Link>
                <Link
                  href="/auth/register"
                  className="inline-flex items-center rounded-full border border-white/10 bg-gradient-to-r from-[#3b82f6]/90 via-[#6366f1]/90 to-[#a78bfa]/90 px-4 py-2 text-sm font-semibold text-white shadow-[0_20px_50px_-25px_rgba(59,130,246,0.7)] transition hover:brightness-110"
                >
                  Register
                </Link>
              </>
            )}
          </div>

          {/* Mobile menu button */}
          <div className="md:hidden flex items-center">
            <button
              aria-label="Toggle menu"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((s) => !s)}
              className="inline-flex items-center justify-center p-2 rounded-md text-slate-100 hover:bg-white/5 focus:outline-none"
            >
              {menuOpen ? (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              )}
            </button>
          </div>
        </div>
      </div>
      {/* Mobile dropdown */}
      <div className={`md:hidden absolute left-0 right-0 top-full z-40 transition ${menuOpen ? 'block' : 'hidden'}`}>
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="mt-2 rounded-b-xl navbar-mobile-dropdown border-t border-white/6 backdrop-blur-md p-4">
            {user ? (
              <div className="space-y-3">
                <div className="text-sm text-slate-200">{user.email}</div>
                <Link href="/dashboard" onClick={() => setMenuOpen(false)} className="block text-white font-medium">Dashboard</Link>
                <Link href="/analytics" onClick={() => setMenuOpen(false)} className="block text-white font-medium">Analytics</Link>
                <button onClick={() => { setMenuOpen(false); handleLogout(); }} className="w-full mt-2 inline-flex items-center justify-center rounded-full border border-white/10 bg-gradient-to-r from-[#3b82f6]/90 via-[#6366f1]/90 to-[#a78bfa]/90 px-4 py-2 text-sm font-semibold text-white">
                  Logout
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <Link href="/auth/login" onClick={() => setMenuOpen(false)} className="block text-white font-medium">Login</Link>
                <Link href="/auth/register" onClick={() => setMenuOpen(false)} className="block text-white font-medium">Register</Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
