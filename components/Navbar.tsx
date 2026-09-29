"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import { UserRole } from "@/lib/types"

interface NavbarProps {
  currentRole: UserRole
  userEmail?: string | null
}

export default function Navbar({ currentRole, userEmail }: NavbarProps) {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(false)

  const handleLogout = async () => {
    setLoading(true)
    await supabase.auth.signOut()
    router.push("/login")
    router.refresh()
  }

  const roleBadgeStyles: Record<UserRole, string> = {
    user: "bg-purple-500/20 text-purple-300 border-purple-500/30",
    parent: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
    counselor: "bg-sky-500/20 text-sky-300 border-sky-500/30",
    admin: "bg-rose-500/20 text-rose-300 border-rose-500/30",
  }

  return (
    <nav className="border-b border-white/10 bg-slate-950/80 backdrop-blur-xl sticky top-0 z-50">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 sm:px-6 py-4">
        <div className="flex items-center gap-3">
          <Link href="/" className="flex items-center gap-2 group">
            <span className="text-2xl transition group-hover:scale-110">📱</span>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white group-hover:text-purple-300 transition">
                SocialTrack
              </h1>
              <p className="text-xs text-slate-400 hidden sm:block">
                Social Media Addiction Tracker
              </p>
            </div>
          </Link>
        </div>

        <div className="flex items-center gap-3 sm:gap-4">
          {userEmail && (
            <span className="hidden md:inline-block text-xs text-slate-400 max-w-[180px] truncate">
              {userEmail}
            </span>
          )}

          <span
            className={`capitalize text-xs font-semibold px-2.5 py-1 rounded-full border ${roleBadgeStyles[currentRole]}`}
          >
            {currentRole} Portal
          </span>

          {currentRole === "admin" && (
            <div className="hidden lg:flex items-center gap-2 text-xs">
              <Link
                href="/admin"
                className="text-slate-300 hover:text-white px-2 py-1 rounded bg-white/5 border border-white/10"
              >
                Admin
              </Link>
              <Link
                href="/dashboard"
                className="text-slate-300 hover:text-white px-2 py-1 rounded bg-white/5 border border-white/10"
              >
                User View
              </Link>
              <Link
                href="/parent"
                className="text-slate-300 hover:text-white px-2 py-1 rounded bg-white/5 border border-white/10"
              >
                Parent View
              </Link>
              <Link
                href="/counselor"
                className="text-slate-300 hover:text-white px-2 py-1 rounded bg-white/5 border border-white/10"
              >
                Counselor View
              </Link>
            </div>
          )}

          <button
            onClick={handleLogout}
            disabled={loading}
            className="rounded-xl border border-white/10 bg-white/10 px-4 py-2 text-xs sm:text-sm font-medium text-white hover:bg-white/20 transition disabled:opacity-50"
          >
            {loading ? "Logging out..." : "Logout"}
          </button>
        </div>
      </div>
    </nav>
  )
}
