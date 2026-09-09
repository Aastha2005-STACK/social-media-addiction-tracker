"use client"

import { useState } from "react"
import { createClient } from "@/lib/supabase/client"

export default function LoginPage() {
  const supabase = createClient()

  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [isSignUp, setIsSignUp] = useState(false)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState("")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMessage("")

    if (isSignUp) {
      const { error } = await supabase.auth.signUp({
        email,
        password,
      })

      if (error) {
        setMessage(error.message)
      } else {
        setMessage("Account created! Check your email to verify your account.")
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) {
        setMessage(error.message)
      } else {
        window.location.href = "/dashboard"
      }
    }

    setLoading(false)
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-indigo-950 via-purple-900 to-slate-950 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 text-3xl mb-4">
            📱
          </div>

          <h1 className="text-3xl font-bold text-white">
            SocialTrack
          </h1>

          <p className="text-purple-200 mt-2">
            Take control of your digital habits
          </p>
        </div>

        <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-3xl p-8 shadow-2xl">
          <h2 className="text-2xl font-semibold text-white mb-2">
            {isSignUp ? "Create Account" : "Welcome Back"}
          </h2>

          <p className="text-gray-300 text-sm mb-6">
            {isSignUp
              ? "Start tracking your social media usage."
              : "Login to continue to your dashboard."}
          </p>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-200 mb-2">
                Email
              </label>

              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full rounded-xl bg-white/10 border border-white/20 px-4 py-3 text-white placeholder-gray-400 outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-400/30 transition"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-200 mb-2">
                Password
              </label>

              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded-xl bg-white/10 border border-white/20 px-4 py-3 text-white placeholder-gray-400 outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-400/30 transition"
              />
            </div>

            {message && (
              <div className="rounded-xl bg-white/10 border border-white/20 px-4 py-3 text-sm text-purple-100">
                {message}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-purple-500 hover:bg-purple-600 disabled:opacity-50 text-white font-semibold py-3 transition shadow-lg shadow-purple-500/20"
            >
              {loading
                ? "Please wait..."
                : isSignUp
                ? "Create Account"
                : "Login"}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-gray-400 text-sm">
              {isSignUp
                ? "Already have an account?"
                : "Don't have an account?"}
            </p>

            <button
              onClick={() => {
                setIsSignUp(!isSignUp)
                setMessage("")
              }}
              className="mt-2 text-purple-300 hover:text-white font-medium transition"
            >
              {isSignUp ? "Login here" : "Create an account"}
            </button>
          </div>
        </div>

        <p className="text-center text-gray-500 text-xs mt-6">
          Monitor • Analyze • Improve
        </p>
      </div>
    </main>
  )
}