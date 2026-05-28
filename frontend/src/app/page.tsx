'use client';

import { useAuthStore } from '@/store/auth';
import Link from 'next/link';

export default function Home() {
  const { user } = useAuthStore();

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#02030d] text-white">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute left-1/2 top-[-60px] h-72 w-72 -translate-x-1/2 rounded-full bg-[#3b82f6]/20 blur-3xl" />
        <div className="absolute right-[-100px] top-36 h-96 w-96 rounded-full bg-[#8b5cf6]/20 blur-3xl" />
        <div className="absolute left-[-120px] bottom-0 h-[420px] w-[420px] rounded-full bg-[#0ea5e9]/15 blur-3xl" />
        <div className="absolute inset-x-0 bottom-0 h-72 bg-[radial-gradient(circle_at_top,_rgba(99,102,241,0.14),_transparent_45%)] opacity-70" />
      </div>

      <main className="relative z-10 mx-auto flex min-h-screen max-w-7xl flex-col gap-16 px-6 py-20 lg:px-8">
        <section className="rounded-[32px] border border-white/10 bg-white/5 p-8 shadow-[0_40px_120px_-50px_rgba(56,189,248,0.45)] backdrop-blur-2xl lg:p-12">
          <div className="grid gap-10 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
            <div className="space-y-8">
              <div className="inline-flex items-center gap-3 rounded-full border border-[#3b82f6]/30 bg-[#ffffff0f] px-4 py-2 text-sm text-[#c7d2fe] shadow-[0_10px_30px_-20px_rgba(59,130,246,0.5)]">
                Premium rental analytics for modern apartments
              </div>

              <div className="space-y-5">
                <h1 className="max-w-3xl text-5xl font-semibold leading-[1.02] tracking-[-0.04em] text-white sm:text-6xl">
                  Predict apartment rental prices with AI
                </h1>
                <p className="max-w-2xl text-lg text-slate-300 sm:text-xl">
                  Helps solve apartment rental price prediction tasks
                </p>
              </div>

              <div className="flex flex-wrap gap-4">
                {!user ? (
                  <>
                    <Link
                      href="/auth/register"
                      className="inline-flex items-center justify-center rounded-full bg-gradient-to-r from-[#3b82f6] via-[#6366f1] to-[#a78bfa] px-8 py-3 text-sm font-semibold text-white shadow-[0_20px_80px_-40px_rgba(59,130,246,0.6)] transition hover:brightness-110"
                    >
                      Get Started
                    </Link>
                    <Link
                      href="/auth/login"
                      className="inline-flex items-center justify-center rounded-full border border-white/20 bg-white/5 px-8 py-3 text-sm font-semibold text-slate-100 transition hover:bg-white/10"
                    >
                      Login
                    </Link>
                  </>
                ) : (
                  <Link
                    href="/dashboard"
                    className="inline-flex items-center justify-center rounded-full bg-gradient-to-r from-[#3b82f6] via-[#6366f1] to-[#a78bfa] px-8 py-3 text-sm font-semibold text-white shadow-[0_20px_80px_-40px_rgba(59,130,246,0.6)] transition hover:brightness-110"
                  >
                    Go to Dashboard
                  </Link>
                )}
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-8 lg:grid-cols-3">
          <div className="glass-card p-8">
            <p className="mb-4 text-sm uppercase tracking-[0.3em] text-[#a5b4fc]">Why choose us</p>
            <h2 className="text-2xl font-semibold text-white">We help predict rental prices and set the optimal listing price</h2>
            <p className="mt-4 text-sm leading-7 text-slate-300">
              We help set the optimal price for a listing or determine whether a listing's price is justified
            </p>
          </div>
          <div className="glass-card p-8">
            <h3 className="mb-3 text-xl font-semibold text-white">⚡ AI-powered</h3>
            <p className="text-slate-300">Machine learning trained on real rental data delivers reliable forecasts</p>
          </div>
          <div className="glass-card p-8">
            <h3 className="mb-3 text-xl font-semibold text-white">🎯 Accurate</h3>
            <p className="text-slate-300">It combines location, square, metro access, house prestige and text-based description features that capture the main price drivers</p>
          </div>
        </section>

        <section className="grid gap-8 lg:grid-cols-3">
          <div className="glass-card p-8">
            <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-[#1e293b]/80 text-2xl text-[#93c5fd]">1</div>
            <h3 className="mt-6 text-xl font-semibold text-white">Add property details</h3>
            <p className="mt-3 text-slate-300">Enter the address, flat area, number of rooms, floor and other description</p>
          </div>
          <div className="glass-card p-8">
            <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-[#1e293b]/80 text-2xl text-[#c4b5fd]">2</div>
            <h3 className="mt-6 text-xl font-semibold text-white">Get your estimate</h3>
            <p className="mt-3 text-slate-300">Get precise rental price estimates with our prediction tool in just a second</p>
          </div>
          <div className="glass-card p-8">
            <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-[#1e293b]/80 text-2xl text-[#a5f3fc]">3</div>
            <h3 className="mt-6 text-xl font-semibold text-white">View analytics</h3>
            <p className="mt-3 text-slate-300">View analytics for all your predictions and uncover dependencies</p>
          </div>
        </section>
      </main>
    </div>
  );
}
