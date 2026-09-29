import Link from "next/link"

export default function Home() {
  return (
    <main className="min-h-screen bg-slate-950 text-white flex flex-col selection:bg-purple-500 selection:text-white">
      {/* Navigation */}
      <header className="border-b border-white/10 bg-slate-950/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2">
            <span className="text-2xl">📱</span>
            <span className="text-xl font-bold tracking-tight text-white">SocialTrack</span>
          </div>

          <div className="flex items-center gap-4">
            <Link
              href="/login"
              className="text-sm font-medium text-slate-300 hover:text-white transition"
            >
              Sign In
            </Link>
            <Link
              href="/login"
              className="rounded-xl bg-purple-500 hover:bg-purple-600 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-purple-500/25 transition"
            >
              Get Started
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden py-24 sm:py-32 px-6">
        <div className="absolute inset-0 bg-gradient-to-b from-purple-600/10 via-transparent to-transparent pointer-events-none" />
        <div className="mx-auto max-w-4xl text-center relative z-10">
          <div className="inline-flex items-center gap-2 rounded-full border border-purple-500/30 bg-purple-500/10 px-4 py-1.5 text-xs font-semibold text-purple-300 mb-6">
            ✨ Take Control of Your Digital Attention
          </div>

          <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-white leading-tight">
            Stop Doomscrolling. <br />
            <span className="bg-gradient-to-r from-purple-400 via-pink-400 to-indigo-400 bg-clip-text text-transparent">
              Master Your Screen Time.
            </span>
          </h1>

          <p className="mt-6 text-base sm:text-lg text-slate-300 max-w-2xl mx-auto leading-relaxed">
            SocialTrack provides deep visibility into your digital habits, detects compulsive app usage, computes algorithmic addiction risks, and empowers parents and counselors to support mindful wellness.
          </p>

          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            <Link
              href="/login"
              className="rounded-2xl bg-purple-500 hover:bg-purple-600 px-8 py-3.5 text-base font-semibold text-white shadow-xl shadow-purple-500/30 transition transform hover:-translate-y-0.5"
            >
              Start Tracking Now →
            </Link>
            <Link
              href="/dashboard"
              className="rounded-2xl border border-white/15 bg-white/5 hover:bg-white/10 px-8 py-3.5 text-base font-semibold text-white backdrop-blur-xl transition"
            >
              Live Dashboard
            </Link>
          </div>
        </div>
      </section>

      {/* Feature Pillars */}
      <section className="py-16 px-6 border-t border-white/10 bg-white/[0.02]">
        <div className="mx-auto max-w-7xl">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <h2 className="text-xs font-bold uppercase tracking-widest text-purple-400">
              Complete Multi-Role Architecture
            </h2>
            <h3 className="mt-2 text-3xl font-bold text-white">
              Built for Individuals, Guardians &amp; Healthcare Pros
            </h3>
          </div>

          <div className="grid gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-xl hover:border-purple-500/40 transition">
              <div className="text-3xl mb-4">👤</div>
              <h4 className="text-lg font-bold text-white">User Wellness</h4>
              <p className="mt-2 text-xs text-slate-400 leading-relaxed">
                Log app sessions, track daily limits, view weekly charts, and receive instant behavioral AI insights.
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-xl hover:border-emerald-500/40 transition">
              <div className="text-3xl mb-4">👨‍👩‍👧</div>
              <h4 className="text-lg font-bold text-white">Parental Supervision</h4>
              <p className="mt-2 text-xs text-slate-400 leading-relaxed">
                Link children accounts by email, monitor usage telemetry, configure remote limits, and get breach alerts.
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-xl hover:border-sky-500/40 transition">
              <div className="text-3xl mb-4">🩺</div>
              <h4 className="text-lg font-bold text-white">Counselor Advisory</h4>
              <p className="mt-2 text-xs text-slate-400 leading-relaxed">
                Review assigned client addiction metrics, evaluate risk drivers, and transmit direct clinical action plans.
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-xl hover:border-rose-500/40 transition">
              <div className="text-3xl mb-4">⚡</div>
              <h4 className="text-lg font-bold text-white">Admin Governance</h4>
              <p className="mt-2 text-xs text-slate-400 leading-relaxed">
                Manage all registered users, reassign role permissions, and audit platform-wide screen time telemetry.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="mt-auto border-t border-white/10 py-8 px-6 text-center text-xs text-slate-500">
        <p>© {new Date().getFullYear()} SocialTrack. Digital Wellness &amp; Addiction Tracking Platform.</p>
      </footer>
    </main>
  )
}
