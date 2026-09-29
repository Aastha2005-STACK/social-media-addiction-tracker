"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { UserRole } from "@/lib/types"

const roleRoutes: Record<UserRole, string> = {
  user: "/dashboard",
  admin: "/admin",
  parent: "/parent",
  counselor: "/counselor",
}

export default function LoginPage() {
  const router = useRouter()
  const supabase = createClient()

  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [selectedRole, setSelectedRole] = useState<UserRole>("user")
  const [isSignUp, setIsSignUp] = useState(false)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState("")
  const [messageType, setMessageType] = useState<"info" | "error" | "success">("info")

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)
    setMessage("")

    try {
      if (isSignUp) {
        // 1. Signup flow
        const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
        })

        if (signUpError) {
          setMessageType("error")
          if (signUpError.message?.toLowerCase().includes("database error saving new user")) {
            setMessage(
              "Supabase Database Error: Database trigger failed. Please execute supabase_migration_profiles_email.sql in your Supabase SQL Editor to update handle_new_user() and add the profiles.email column."
            )
          } else {
            setMessage(signUpError.message)
          }
          return
        }

        if (signUpData.user) {
          // Guarantee profile record exists in public.profiles with default 'user' role
          await supabase.from("profiles").upsert(
            {
              id: signUpData.user.id,
              email: email,
              role: "user",
            },
            { onConflict: "id" }
          )

          // Guarantee default limit exists
          await supabase.from("user_limits").upsert(
            {
              user_id: signUpData.user.id,
              daily_limit_minutes: 180,
            },
            { onConflict: "user_id" }
          )

          // If session is immediately active (email confirmation off in Supabase)
          if (signUpData.session) {
            setMessageType("success")
            setMessage("Account created! Redirecting to your dashboard...")
            router.push("/dashboard")
            router.refresh()
            return
          }
        }

        setMessageType("success")
        setMessage(
          "Account created as User! Please check your email to verify, or try logging in."
        )
        return
      }

      // 2. Login flow
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) {
        setMessageType("error")
        setMessage(error.message)
        return
      }

      if (!data.user) {
        setMessageType("error")
        setMessage("Unable to verify your account.")
        return
      }

      // 3. Fetch ACTUAL role directly from database
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", data.user.id)
        .single()

      let actualRole: UserRole = "user"

      if (!profile) {
        // Auto-heal missing profile for newly migrated accounts
        await supabase.from("profiles").insert({
          id: data.user.id,
          email: data.user.email || email,
          role: "user",
        })
        actualRole = "user"
      } else {
        actualRole = (profile.role as UserRole) || "user"
      }

      // Enforce true authorization: Redirect strictly based on database role
      setMessageType("success")
      if (selectedRole !== actualRole) {
        setMessage(
          `Authenticated! Your verified role is "${actualRole.toUpperCase()}". Redirecting to authorized portal...`
        )
      } else {
        setMessage("Login successful! Redirecting to your dashboard...")
      }

      const destination = roleRoutes[actualRole] || "/dashboard"
      setTimeout(() => {
        router.push(destination)
        router.refresh()
      }, 400)
    } catch {
      setMessageType("error")
      setMessage("Something went wrong. Please check your network and credentials.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-indigo-950 via-purple-900 to-slate-950 flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        {/* Branding */}
        <div className="text-center mb-8">
          <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 text-3xl mb-4 shadow-xl">
            📱
          </div>

          <h1 className="text-3xl font-bold text-white tracking-tight">
            SocialTrack
          </h1>

          <p className="text-purple-200 mt-2 text-sm">
            Take control of your digital habits
          </p>
        </div>

        {/* Login Card */}
        <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-3xl p-8 shadow-2xl">
          <h2 className="text-2xl font-semibold text-white mb-2">
            {isSignUp ? "Create Account" : "Welcome Back"}
          </h2>

          <p className="text-gray-300 text-sm mb-6">
            {isSignUp
              ? "Start tracking your social media usage."
              : "Login to continue to your authorized dashboard."}
          </p>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Role Selection */}
            {!isSignUp && (
              <div>
                <label
                  htmlFor="role"
                  className="block text-sm font-medium text-gray-200 mb-2"
                >
                  Portal View
                </label>

                <select
                  id="role"
                  value={selectedRole}
                  onChange={(e) => setSelectedRole(e.target.value as UserRole)}
                  className="w-full rounded-xl bg-indigo-950/70 border border-white/20 px-4 py-3 text-white outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-400/30 transition text-sm"
                >
                  <option value="user" className="bg-indigo-950">
                    User
                  </option>
                  <option value="admin" className="bg-indigo-950">
                    Admin
                  </option>
                  <option value="parent" className="bg-indigo-950">
                    Parent
                  </option>
                  <option value="counselor" className="bg-indigo-950">
                    Counselor
                  </option>
                </select>
                <p className="text-[11px] text-purple-300/70 mt-1.5">
                  Access is strictly validated against your database permissions.
                </p>
              </div>
            )}

            {isSignUp && (
              <div className="rounded-xl bg-white/10 border border-white/20 px-4 py-3 text-xs text-purple-100 leading-relaxed">
                New accounts are created with the <strong>User</strong> role. Admin, Parent, and Counselor permissions are managed by system administrators.
              </div>
            )}

            {/* Email */}
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-gray-200 mb-2"
              >
                Email
              </label>

              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full rounded-xl bg-white/10 border border-white/20 px-4 py-3 text-white placeholder-gray-400 outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-400/30 transition text-sm"
              />
            </div>

            {/* Password */}
            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium text-gray-200 mb-2"
              >
                Password
              </label>

              <input
                id="password"
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded-xl bg-white/10 border border-white/20 px-4 py-3 text-white placeholder-gray-400 outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-400/30 transition text-sm"
              />
            </div>

            {/* Status Message */}
            {message && (
              <div
                role="status"
                className={`rounded-xl border px-4 py-3 text-xs leading-relaxed ${
                  messageType === "error"
                    ? "bg-rose-500/20 border-rose-500/30 text-rose-200"
                    : messageType === "success"
                    ? "bg-emerald-500/20 border-emerald-500/30 text-emerald-200"
                    : "bg-white/10 border-white/20 text-purple-100"
                }`}
              >
                {message}
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-purple-500 hover:bg-purple-600 disabled:opacity-50 text-white font-semibold py-3 transition shadow-lg shadow-purple-500/25"
            >
              {loading
                ? "Please wait..."
                : isSignUp
                ? "Create Account"
                : "Sign In"}
            </button>
          </form>

          {/* Toggle Signup/Login */}
          <div className="mt-6 text-center">
            <p className="text-gray-400 text-xs">
              {isSignUp
                ? "Already have an account?"
                : "Don't have an account?"}
            </p>

            <button
              type="button"
              onClick={() => {
                setIsSignUp(!isSignUp)
                setMessage("")
              }}
              className="mt-1 text-purple-300 hover:text-white font-medium text-sm transition"
            >
              {isSignUp ? "Sign In here" : "Create an account"}
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