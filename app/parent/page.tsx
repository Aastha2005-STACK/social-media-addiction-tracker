"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import Navbar from "@/components/Navbar"
import { calculateAddictionScore } from "@/lib/addiction-score"
import { Profile, UsageLog, UserLimit, UserAlert } from "@/lib/types"

interface LinkedChild {
  linkId: string
  child: Profile
  limits?: UserLimit
  todayMinutes: number
  logs: UsageLog[]
}

export default function ParentDashboard() {
  const router = useRouter()
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [parentProfile, setParentProfile] = useState<Profile | null>(null)
  const [children, setChildren] = useState<LinkedChild[]>([])
  const [selectedChildIndex, setSelectedChildIndex] = useState(0)

  // Link child form
  const [childEmail, setChildEmail] = useState("")
  const [linkLoading, setLinkLoading] = useState(false)
  const [linkMsg, setLinkMsg] = useState("")

  // Adjust child limit form
  const [customLimits, setCustomLimits] = useState<Record<string, number>>({})
  const [limitLoading, setLimitLoading] = useState(false)

  // Alerts
  const [childAlerts, setChildAlerts] = useState<UserAlert[]>([])

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

        // Check current profile
        const { data: prof } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", user.id)
          .single()

        if (prof) {
          setParentProfile(prof as Profile)
        } else {
          setParentProfile({
            id: user.id,
            email: user.email || "",
            role: "parent",
          })
        }

        // Query parent_child_links
        const { data: links } = await supabase
          .from("parent_child_links")
          .select("id, child_id")
          .eq("parent_id", user.id)

        if (links && links.length > 0) {
          const loadedChildren: LinkedChild[] = []
          const todayStr = new Date().toISOString().split("T")[0]

          for (const link of links) {
            // fetch child profile
            const { data: cProf } = await supabase
              .from("profiles")
              .select("*")
              .eq("id", link.child_id)
              .single()

            // fetch child limits
            const { data: cLim } = await supabase
              .from("user_limits")
              .select("*")
              .eq("user_id", link.child_id)
              .single()

            // fetch child logs
            const { data: cLogs } = await supabase
              .from("usage_logs")
              .select("*")
              .eq("user_id", link.child_id)
              .order("log_date", { ascending: false })
              .limit(50)

            const childLogs = (cLogs as UsageLog[]) || []
            const todayMins = childLogs
              .filter((l) => l.log_date === todayStr)
              .reduce((acc, curr) => acc + curr.duration_minutes, 0)

            if (cProf) {
              loadedChildren.push({
                linkId: link.id,
                child: cProf as Profile,
                limits: (cLim as UserLimit) || undefined,
                todayMinutes: todayMins,
                logs: childLogs,
              })
            }
          }
          setChildren(loadedChildren)

          // Load alerts for linked children
          const childIds = links.map((l) => l.child_id)
          const { data: alertsData } = await supabase
            .from("alerts")
            .select("*")
            .in("user_id", childIds)
            .order("created_at", { ascending: false })
            .limit(10)

          if (alertsData) {
            setChildAlerts(alertsData as UserAlert[])
          }
        } else {
          setChildren([])
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

  const handleLinkChild = async (e: React.FormEvent) => {
    e.preventDefault()
    setLinkLoading(true)
    setLinkMsg("")

    try {
      if (!parentProfile) return

      // Look up target child profile by email
      const { data: childUser, error: lookupError } = await supabase
        .from("profiles")
        .select("id, email, role")
        .eq("email", childEmail.trim().toLowerCase())
        .single()

      if (lookupError || !childUser) {
        setLinkMsg("No registered user found with this email. Make sure your child has registered first.")
        return
      }

      if (childUser.id === parentProfile.id) {
        setLinkMsg("You cannot link your own account as a child.")
        return
      }

      const { error: insertError } = await supabase.from("parent_child_links").insert({
        parent_id: parentProfile.id,
        child_id: childUser.id,
        status: "active",
      })

      if (insertError) {
        if (insertError.code === "23505") {
          setLinkMsg("This child account is already linked to your profile.")
        } else {
          setLinkMsg(insertError.message)
        }
        return
      }

      setLinkMsg("Child account connected successfully!")
      setChildEmail("")
      await loadData()
    } catch {
      setLinkMsg("Failed to link child. Check database connection.")
    } finally {
      setLinkLoading(false)
    }
  }

  const activeChild = children[selectedChildIndex]
  const activeDailyLimit = activeChild?.limits?.daily_limit_minutes || 120
  const currentSliderLimit = activeChild
    ? (customLimits[activeChild.child.id] ?? activeDailyLimit)
    : 120

  const handleUpdateChildLimit = async () => {
    if (!activeChild) return
    setLimitLoading(true)
    try {
      await supabase.from("user_limits").upsert(
        {
          user_id: activeChild.child.id,
          daily_limit_minutes: currentSliderLimit,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" }
      )
      await loadData()
    } catch {
      // ignore
    } finally {
      setLimitLoading(false)
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-950 text-white flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-slate-400">Loading Parental Portal...</p>
        </div>
      </main>
    )
  }

  const activeAddiction = activeChild
    ? calculateAddictionScore(activeChild.todayMinutes, activeDailyLimit, activeChild.logs)
    : null

  return (
    <main className="min-h-screen bg-slate-950 text-white flex flex-col">
      <Navbar currentRole={parentProfile?.role || "parent"} userEmail={parentProfile?.email} />

      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 py-8 flex-1">
        {/* Header */}
        <div className="mb-8">
          <p className="text-emerald-400 font-medium text-sm">Parental Guard &amp; Supervision</p>
          <h2 className="mt-1 text-3xl sm:text-4xl font-bold tracking-tight">
            Child Screen Time Monitoring
          </h2>
          <p className="mt-2 text-slate-400 text-sm max-w-2xl">
            Keep track of your children&apos;s digital wellness, establish healthy screen limits, and receive real-time behavioral alerts.
          </p>
        </div>

        {/* Link Child Card */}
        <div className="mb-8 rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-xl">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <span>🔗</span> Connect a Child Account
          </h3>
          <p className="mt-1 text-xs text-slate-400">
            Enter the registered email of your child to initiate protective monitoring.
          </p>

          <form onSubmit={handleLinkChild} className="mt-4 flex flex-col sm:flex-row gap-3 max-w-xl">
            <input
              type="email"
              required
              placeholder="child@example.com"
              value={childEmail}
              onChange={(e) => setChildEmail(e.target.value)}
              className="flex-1 rounded-xl bg-slate-900 border border-white/10 px-4 py-2.5 text-sm text-white placeholder-slate-500 outline-none focus:border-emerald-400"
            />
            <button
              type="submit"
              disabled={linkLoading}
              className="rounded-xl bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-emerald-500/20 transition whitespace-nowrap"
            >
              {linkLoading ? "Connecting..." : "Link Child"}
            </button>
          </form>

          {linkMsg && (
            <p className="mt-3 text-xs text-emerald-300 bg-emerald-500/10 border border-emerald-500/20 p-2.5 rounded-xl max-w-xl">
              {linkMsg}
            </p>
          )}
        </div>

        {children.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/20 p-12 text-center text-slate-400 bg-white/5">
            <div className="text-4xl mb-3">👨‍👩‍👧</div>
            <h4 className="text-lg font-semibold text-white">No Linked Children Yet</h4>
            <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
              Once you link your child&apos;s SocialTrack email above, you will be able to inspect their daily usage, addiction score, and set remote limits.
            </p>
          </div>
        ) : (
          <div className="space-y-8">
            {/* Child Selector Tabs */}
            <div className="flex flex-wrap gap-2 border-b border-white/10 pb-3">
              {children.map((item, idx) => (
                <button
                  key={item.linkId}
                  onClick={() => setSelectedChildIndex(idx)}
                  className={`px-4 py-2 rounded-xl text-sm font-medium transition cursor-pointer ${
                    selectedChildIndex === idx
                      ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/20"
                      : "bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  {item.child.full_name || item.child.email}
                </button>
              ))}
            </div>

            {/* Active Child Overview KPIs */}
            {activeChild && activeAddiction && (
              <>
                <div className="grid gap-5 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-xl">
                    <p className="text-xs uppercase font-semibold tracking-wider text-slate-400">
                      Child Screen Time Today
                    </p>
                    <h3 className="mt-3 text-3xl font-bold text-white">
                      {Math.floor(activeChild.todayMinutes / 60)}h {activeChild.todayMinutes % 60}m
                    </h3>
                    <p
                      className={`mt-2 text-xs font-medium ${
                        activeChild.todayMinutes > activeDailyLimit ? "text-rose-400" : "text-emerald-400"
                      }`}
                    >
                      {activeChild.todayMinutes > activeDailyLimit
                        ? `Over limit by ${activeChild.todayMinutes - activeDailyLimit}m`
                        : "Within permitted limit"}
                    </p>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-xl">
                    <p className="text-xs uppercase font-semibold tracking-wider text-slate-400">
                      Parent Limit
                    </p>
                    <h3 className="mt-3 text-3xl font-bold text-white">
                      {Math.floor(activeDailyLimit / 60)}h {activeDailyLimit % 60}m
                    </h3>
                    <p className="mt-2 text-xs text-slate-400">Daily threshold</p>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-xl">
                    <p className="text-xs uppercase font-semibold tracking-wider text-slate-400">
                      Addiction Risk
                    </p>
                    <div className="mt-3 flex items-baseline gap-2">
                      <span className="text-3xl font-bold text-white">{activeAddiction.score}</span>
                      <span className="text-sm text-slate-500">/ 100</span>
                    </div>
                    <span
                      className={`mt-2 inline-block text-xs px-2.5 py-0.5 rounded-full border font-semibold ${activeAddiction.color}`}
                    >
                      {activeAddiction.category}
                    </span>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-xl">
                    <p className="text-xs uppercase font-semibold tracking-wider text-slate-400">
                      Logs Monitored
                    </p>
                    <h3 className="mt-3 text-3xl font-bold text-white">
                      {activeChild.logs.length}
                    </h3>
                    <p className="mt-2 text-xs text-slate-400">Total recorded entries</p>
                  </div>
                </div>

                {/* Remote Limit Adjustment & Alerts */}
                <div className="grid gap-6 grid-cols-1 lg:grid-cols-2">
                  {/* Remote Limit Setter */}
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-xl">
                    <h3 className="text-lg font-bold text-white">Adjust Child Daily Limit</h3>
                    <p className="text-xs text-slate-400 mt-1">
                      Set maximum allowed social media screen time for {activeChild.child.full_name || activeChild.child.email}.
                    </p>

                    <div className="mt-5 flex items-center gap-4">
                      <input
                        type="range"
                        min={30}
                        max={480}
                        step={15}
                        value={currentSliderLimit}
                        onChange={(e) => {
                          const val = parseInt(e.target.value)
                          setCustomLimits((prev) => ({
                            ...prev,
                            [activeChild.child.id]: val,
                          }))
                        }}
                        className="flex-1 accent-emerald-500"
                      />
                      <span className="text-sm font-bold text-emerald-300 min-w-20 text-right">
                        {Math.floor(currentSliderLimit / 60)}h {currentSliderLimit % 60}m
                      </span>
                    </div>

                    <button
                      onClick={handleUpdateChildLimit}
                      disabled={limitLoading}
                      className="mt-5 rounded-xl bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 px-5 py-2.5 text-xs font-semibold text-white shadow-lg shadow-emerald-500/20 transition"
                    >
                      {limitLoading ? "Saving..." : "Apply New Limit"}
                    </button>
                  </div>

                  {/* Safety Alerts Feed */}
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-xl">
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                      <span>🔔</span> Recent Safety Alerts
                    </h3>
                    <p className="text-xs text-slate-400 mt-1">
                      System notifications triggered by threshold breaches.
                    </p>

                    <div className="mt-4 space-y-2 max-h-48 overflow-y-auto">
                      {childAlerts.length === 0 ? (
                        <p className="text-xs text-slate-500 py-4 text-center">
                          No alerts generated yet. Usage is nominal.
                        </p>
                      ) : (
                        childAlerts.map((alert) => (
                          <div
                            key={alert.id}
                            className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-200"
                          >
                            <span className="font-semibold block">{alert.type}:</span>
                            {alert.message}
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>

                {/* Child Usage Log History */}
                <div className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-xl">
                  <h3 className="text-lg font-bold text-white">Recent Child Sessions</h3>
                  <div className="mt-4 overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="text-slate-400 border-b border-white/10 pb-2">
                        <tr>
                          <th className="py-2">Platform</th>
                          <th className="py-2">Duration</th>
                          <th className="py-2">Date</th>
                          <th className="py-2">Notes</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {activeChild.logs.slice(0, 10).map((l) => (
                          <tr key={l.id} className="hover:bg-white/5 transition">
                            <td className="py-2.5 font-medium text-white">{l.platform}</td>
                            <td className="py-2.5 text-emerald-300 font-semibold">
                              {Math.floor(l.duration_minutes / 60)}h {l.duration_minutes % 60}m
                            </td>
                            <td className="py-2.5 text-slate-400">{l.log_date}</td>
                            <td className="py-2.5 text-slate-500">{l.notes || "-"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </main>
  )
}
