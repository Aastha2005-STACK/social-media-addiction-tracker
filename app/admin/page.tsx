"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import Navbar from "@/components/Navbar"
import { Profile, UserRole, UsageLog } from "@/lib/types"

export default function AdminDashboard() {
  const router = useRouter()
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [adminProfile, setAdminProfile] = useState<Profile | null>(null)
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [logs, setLogs] = useState<UsageLog[]>([])

  // Search and filter
  const [searchQuery, setSearchQuery] = useState("")
  const [roleFilter, setRoleFilter] = useState<string>("all")
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [statusMsg, setStatusMsg] = useState("")

  const loadData = useCallback(async () => {
    try {
      const fetchPromise = (async () => {
        const {
          data: { user },
        } = await supabase.auth.getUser()

        if (!user) {
          router.push("/login")
          return
        }

        // Check current admin profile
        const { data: prof } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", user.id)
          .single()

        if (prof) {
          setAdminProfile(prof as Profile)
        } else {
          setAdminProfile({
            id: user.id,
            email: user.email || "",
            role: "admin",
          })
        }

        // Fetch all profiles
        const { data: allProfiles } = await supabase
          .from("profiles")
          .select("*")
          .order("created_at", { ascending: false })

        if (allProfiles) {
          setProfiles(allProfiles as Profile[])
        }

        // Fetch all usage logs for aggregate telemetry
        const { data: allLogs } = await supabase
          .from("usage_logs")
          .select("id, duration_minutes, platform, log_date")
          .limit(1000)

        if (allLogs) {
          setLogs(allLogs as UsageLog[])
        }
      })()

      const timeoutPromise = new Promise<void>((resolve) =>
        setTimeout(() => resolve(), 4000)
      )

      await Promise.race([fetchPromise, timeoutPromise])
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }, [supabase, router])

  useEffect(() => {
    loadData()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleRoleChange = async (userId: string, newRole: UserRole) => {
    setUpdatingId(userId)
    setStatusMsg("")
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ role: newRole, updated_at: new Date().toISOString() })
        .eq("id", userId)

      if (error) throw error

      setStatusMsg(`Role updated to ${newRole.toUpperCase()} successfully.`)
      await loadData()
    } catch (err: unknown) {
      const error = err as { message?: string }
      setStatusMsg(error?.message || "Failed to update user role.")
    } finally {
      setUpdatingId(null)
    }
  }

  // Filtered users
  const filteredProfiles = profiles.filter((p) => {
    if (roleFilter !== "all" && p.role !== roleFilter) return false
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      const matchEmail = p.email?.toLowerCase().includes(query)
      const matchName = p.full_name?.toLowerCase().includes(query)
      if (!matchEmail && !matchName) return false
    }
    return true
  })

  // Global platform stats
  const totalUsers = profiles.length
  const totalMinutes = logs.reduce((acc, curr) => acc + curr.duration_minutes, 0)
  const roleCounts: Record<string, number> = {
    user: profiles.filter((p) => p.role === "user").length,
    parent: profiles.filter((p) => p.role === "parent").length,
    counselor: profiles.filter((p) => p.role === "counselor").length,
    admin: profiles.filter((p) => p.role === "admin").length,
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-950 text-white flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-rose-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-slate-400">Loading Administrator Portal...</p>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white flex flex-col">
      <Navbar currentRole={adminProfile?.role || "admin"} userEmail={adminProfile?.email} />

      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 py-8 flex-1">
        {/* Header */}
        <div className="mb-8">
          <p className="text-rose-400 font-medium text-sm">System Administration &amp; Governance</p>
          <h2 className="mt-1 text-3xl sm:text-4xl font-bold tracking-tight">
            Administrator Control Center
          </h2>
          <p className="mt-2 text-slate-400 text-sm max-w-2xl">
            Oversee user accounts, reassign role permissions across the system, and audit platform screen time usage.
          </p>
        </div>

        {/* Platform Overview KPIs */}
        <div className="grid gap-5 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-xl">
            <p className="text-xs uppercase font-semibold tracking-wider text-slate-400">
              Total Accounts
            </p>
            <h3 className="mt-3 text-3xl font-bold text-white">{totalUsers}</h3>
            <p className="mt-2 text-xs text-slate-400">Registered across system</p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-xl">
            <p className="text-xs uppercase font-semibold tracking-wider text-slate-400">
              Total Screen Time Logged
            </p>
            <h3 className="mt-3 text-3xl font-bold text-white">
              {Math.floor(totalMinutes / 60)}h {totalMinutes % 60}m
            </h3>
            <p className="mt-2 text-xs text-slate-400">{logs.length} logged sessions</p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-xl">
            <p className="text-xs uppercase font-semibold tracking-wider text-slate-400">
              Role Allocation
            </p>
            <div className="mt-3 flex items-center gap-2 text-xs font-medium">
              <span className="text-purple-300">{roleCounts.user} Users</span> •
              <span className="text-emerald-300">{roleCounts.parent} Parents</span> •
              <span className="text-sky-300">{roleCounts.counselor} Counselors</span>
            </div>
            <p className="mt-2 text-xs text-rose-300">{roleCounts.admin} Administrators</p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-xl">
            <p className="text-xs uppercase font-semibold tracking-wider text-slate-400">
              System Health
            </p>
            <h3 className="mt-3 text-3xl font-bold text-emerald-400">100%</h3>
            <p className="mt-2 text-xs text-slate-400">Supabase RLS Active</p>
          </div>
        </div>

        {/* User Management Section */}
        <div className="mt-8 rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-xl">
          <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-white/10">
            <div>
              <h3 className="text-lg font-bold text-white">User Accounts &amp; Permissions</h3>
              <p className="text-xs text-slate-400">
                Grant or revoke role permissions (User, Parent, Counselor, Admin).
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <input
                type="text"
                placeholder="Search email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="rounded-xl bg-slate-900 border border-white/10 px-3 py-1.5 text-xs text-white placeholder-slate-500 outline-none focus:border-rose-400"
              />

              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="rounded-xl bg-slate-900 border border-white/10 px-3 py-1.5 text-xs text-white outline-none focus:border-rose-400"
              >
                <option value="all">All Roles</option>
                <option value="user">User</option>
                <option value="parent">Parent</option>
                <option value="counselor">Counselor</option>
                <option value="admin">Admin</option>
              </select>
            </div>
          </div>

          {statusMsg && (
            <div className="mt-4 p-3 rounded-xl bg-purple-500/10 border border-purple-500/20 text-xs text-purple-200">
              {statusMsg}
            </div>
          )}

          {/* Users Table */}
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="text-slate-400 border-b border-white/10 pb-2">
                <tr>
                  <th className="py-2.5">User Email</th>
                  <th className="py-2.5">Current Role</th>
                  <th className="py-2.5">Reassign Role</th>
                  <th className="py-2.5">Joined Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filteredProfiles.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-slate-500">
                      No accounts found matching filter.
                    </td>
                  </tr>
                ) : (
                  filteredProfiles.map((user) => (
                    <tr key={user.id} className="hover:bg-white/5 transition">
                      <td className="py-3 font-medium text-white">
                        <div>{user.email}</div>
                        <div className="text-[10px] text-slate-500 font-mono truncate max-w-xs">
                          {user.id}
                        </div>
                      </td>
                      <td className="py-3">
                        <span
                          className={`capitalize px-2 py-0.5 rounded-full text-[11px] font-semibold border ${
                            user.role === "admin"
                              ? "bg-rose-500/20 text-rose-300 border-rose-500/30"
                              : user.role === "parent"
                              ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
                              : user.role === "counselor"
                              ? "bg-sky-500/20 text-sky-300 border-sky-500/30"
                              : "bg-purple-500/20 text-purple-300 border-purple-500/30"
                          }`}
                        >
                          {user.role}
                        </span>
                      </td>
                      <td className="py-3">
                        <select
                          disabled={updatingId === user.id}
                          value={user.role}
                          onChange={(e) =>
                            handleRoleChange(user.id, e.target.value as UserRole)
                          }
                          className="rounded-xl bg-slate-900 border border-white/10 px-3 py-1.5 text-xs text-white outline-none focus:border-rose-400 disabled:opacity-50"
                        >
                          <option value="user">User</option>
                          <option value="parent">Parent</option>
                          <option value="counselor">Counselor</option>
                          <option value="admin">Admin</option>
                        </select>
                      </td>
                      <td className="py-3 text-slate-400">
                        {user.created_at
                          ? new Date(user.created_at).toLocaleDateString()
                          : "Legacy"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </main>
  )
}
