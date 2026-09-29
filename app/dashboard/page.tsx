"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import Navbar from "@/components/Navbar"
import AddScreenTimeModal from "@/components/AddScreenTimeModal"
import SetGoalModal from "@/components/SetGoalModal"
import ReportsModal from "@/components/ReportsModal"
import ConnectExtensionModal from "@/components/ConnectExtensionModal"
import { calculateAddictionScore } from "@/lib/addiction-score"
import { Profile, UsageLog, UserLimit, AddictionScoreResult } from "@/lib/types"

export default function DashboardPage() {
  const router = useRouter()
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [userLimits, setUserLimits] = useState<UserLimit | null>(null)
  const [logs, setLogs] = useState<UsageLog[]>([])

  // Extension status
  const [isExtensionConnected, setIsExtensionConnected] = useState(false)
  const [isConnectModalOpen, setIsConnectModalOpen] = useState(false)

  // Modals state
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [isGoalOpen, setIsGoalOpen] = useState(false)
  const [isReportsOpen, setIsReportsOpen] = useState(false)
  const [aiAnalysisCustom, setAiAnalysisCustom] = useState<string | null>(null)
  const [aiLoading, setAiLoading] = useState(false)

  const fetchData = useCallback(async () => {
    try {
      const fetchPromise = (async () => {
        const {
          data: { user },
        } = await supabase.auth.getUser()

        if (!user) {
          router.push("/login")
          return
        }

        // 1. Profile
        const { data: profileData } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", user.id)
          .single()

        if (profileData) {
          setProfile(profileData as Profile)
        } else {
          setProfile({
            id: user.id,
            email: user.email || "",
            role: "user",
          })
        }

        // 2. User Limits
        const { data: limitData } = await supabase
          .from("user_limits")
          .select("*")
          .eq("user_id", user.id)
          .single()

        if (limitData) {
          setUserLimits(limitData as UserLimit)
        } else {
          setUserLimits({
            user_id: user.id,
            daily_limit_minutes: 180,
          })
        }

        // 3. Usage Logs (last 30 days)
        const { data: logsData } = await supabase
          .from("usage_logs")
          .select("*")
          .eq("user_id", user.id)
          .order("log_date", { ascending: false })
          .limit(100)

        if (logsData) {
          setLogs(logsData as UsageLog[])
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
    fetchData()

    // 1. Real-time updates: Subscribe to Postgres changes on usage_logs
    const channel = supabase
      .channel("realtime_dashboard_logs")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "usage_logs",
        },
        () => {
          fetchData()
        }
      )
      .subscribe()

    // 2. Fallback polling every 15 seconds
    const interval = setInterval(fetchData, 15000)

    // 3. Chrome Extension handshake & auto-sync
    const handleExtensionMessage = (event: MessageEvent) => {
      if (event.data?.type === "SOCIALTRACK_EXTENSION_PONG") {
        setIsExtensionConnected(true)
      }
    }
    window.addEventListener("message", handleExtensionMessage)

    // Ping extension and broadcast session
    window.postMessage({ type: "SOCIALTRACK_EXTENSION_PING" }, "*")

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        window.postMessage(
          {
            type: "SOCIALTRACK_REQUEST_EXTENSION_SYNC",
            session: {
              user_id: session.user.id,
              email: session.user.email,
              access_token: session.access_token,
              refresh_token: session.refresh_token,
            },
          },
          "*"
        )
      }
    })

    return () => {
      supabase.removeChannel(channel)
      clearInterval(interval)
      window.removeEventListener("message", handleExtensionMessage)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Computed Metrics
  const todayStr = new Date().toISOString().split("T")[0]
  const todayLogs = logs.filter((l) => l.log_date === todayStr)
  const todayMinutes = todayLogs.reduce((acc, curr) => acc + curr.duration_minutes, 0)

  // Platform breakdowns
  const platformUsageMap: Record<string, number> = {}
  todayLogs.forEach((l) => {
    platformUsageMap[l.platform] = (platformUsageMap[l.platform] || 0) + l.duration_minutes
  })

  let mostUsedApp = "None"
  let mostUsedMinutes = 0
  Object.entries(platformUsageMap).forEach(([app, mins]) => {
    if (mins > mostUsedMinutes) {
      mostUsedApp = app
      mostUsedMinutes = mins
    }
  })

  // Specific Chrome Extension tracked platform minutes
  const youtubeMins = platformUsageMap["YouTube"] || 0
  const instagramMins = platformUsageMap["Instagram"] || 0
  const redditMins = platformUsageMap["Reddit"] || 0
  const extensionTrackedMinutes = youtubeMins + instagramMins + redditMins

  // Auto-detect extension activity if extension tracked minutes exist
  const hasExtensionActivity = extensionTrackedMinutes > 0 || isExtensionConnected

  // Daily limit calculations
  const dailyLimit = userLimits?.daily_limit_minutes || 180
  const minutesRemaining = Math.max(0, dailyLimit - todayMinutes)
  const isOverLimit = todayMinutes > dailyLimit

  // Weekly Screen Time Calculation (last 7 days)
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - (6 - i))
    const dateString = d.toISOString().split("T")[0]
    const dayName = dayNames[d.getDay()]
    const dayMins = logs
      .filter((l) => l.log_date === dateString)
      .reduce((sum, curr) => sum + curr.duration_minutes, 0)
    return { day: dayName, date: dateString, minutes: dayMins }
  })

  const maxWeeklyMinutes = Math.max(...last7Days.map((d) => d.minutes), dailyLimit, 60)
  const weeklyTotalMinutes = last7Days.reduce((acc, curr) => acc + curr.minutes, 0)
  const weeklyTargetMinutes = dailyLimit * 7
  const weeklyProgressPercent = Math.min(
    100,
    Math.round(
      weeklyTargetMinutes > 0
        ? Math.max(0, 100 - (weeklyTotalMinutes / weeklyTargetMinutes) * 100 + 50)
        : 75
    )
  )

  // Addiction Score calculation
  const scoreResult: AddictionScoreResult = calculateAddictionScore(todayMinutes, dailyLimit, logs)

  const handleTriggerAI = async () => {
    setAiLoading(true)
    try {
      const res = await fetch("/api/ai-insights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          todayMinutes,
          dailyLimit,
          platformBreakdown: platformUsageMap,
          addictionScore: scoreResult.score,
        }),
      })
      if (res.ok) {
        const data = await res.json()
        if (data.insight) {
          setAiAnalysisCustom(data.insight)
        }
      }
    } catch {
      // fallback
      setAiAnalysisCustom(scoreResult.feedback)
    } finally {
      setAiLoading(false)
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-950 text-white flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-slate-400">Loading your wellness dashboard...</p>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white flex flex-col">
      <Navbar currentRole={profile?.role || "user"} userEmail={profile?.email} />

      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 py-8 flex-1">
        {/* Welcome Header */}
        <div className="mb-8">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-purple-400 font-medium text-sm">Welcome back 👋</p>
              <h2 className="mt-1 text-3xl sm:text-4xl font-bold tracking-tight">
                Your Digital Wellness Dashboard
              </h2>
              <p className="mt-2 text-slate-400 text-sm max-w-2xl">
                Monitor your active social media habits, avoid doomscrolling, and build healthier screen-time routines.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => setIsConnectModalOpen(true)}
                className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 px-4 py-2.5 text-xs sm:text-sm font-medium text-purple-300 transition"
              >
                <span>🧩</span> Chrome Extension
              </button>
              <button
                onClick={() => setIsAddOpen(true)}
                className="flex items-center gap-2 rounded-xl bg-purple-500 hover:bg-purple-600 px-4 py-2.5 text-xs sm:text-sm font-semibold text-white shadow-lg shadow-purple-500/20 transition"
              >
                <span>+</span> Add Screen Time
              </button>
            </div>
          </div>
        </div>

        {/* Chrome Extension Status Banner */}
        <div className="mb-8 rounded-2xl border border-purple-500/20 bg-gradient-to-r from-purple-950/40 via-indigo-950/30 to-slate-900/40 p-5 backdrop-blur-xl">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-500/20 text-xl border border-purple-500/30">
                🧩
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="font-bold text-white text-sm">Chrome Extension Tracking</h4>
                  <span
                    className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold border ${
                      hasExtensionActivity
                        ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
                        : "bg-amber-500/20 text-amber-300 border-amber-500/30"
                    }`}
                  >
                    <span>{hasExtensionActivity ? "●" : "○"}</span>
                    {hasExtensionActivity ? "Connected & Active" : "Pairing Ready"}
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  Supported Websites: <strong className="text-slate-300 font-medium">YouTube • Instagram • Reddit</strong>
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-4 text-xs">
              <div className="bg-slate-900/60 px-3.5 py-2 rounded-xl border border-white/10">
                <span className="text-slate-400 block text-[10px] uppercase font-semibold">Today&apos;s Tracked Time</span>
                <span className="font-bold text-white text-sm">
                  {Math.floor(extensionTrackedMinutes / 60)}h {extensionTrackedMinutes % 60}m
                </span>
              </div>

              <div className="bg-slate-900/60 px-3.5 py-2 rounded-xl border border-white/10">
                <span className="text-slate-400 block text-[10px] uppercase font-semibold">Most Used</span>
                <span className="font-bold text-purple-300 text-sm">{mostUsedApp}</span>
              </div>

              <button
                onClick={() => setIsConnectModalOpen(true)}
                className="rounded-xl bg-purple-500 hover:bg-purple-600 px-4 py-2 font-medium text-white shadow-md shadow-purple-500/20 transition whitespace-nowrap"
              >
                {hasExtensionActivity ? "Extension Settings" : "Connect Extension"}
              </button>
            </div>
          </div>
        </div>

        {/* Top 4 KPI Metrics */}
        <div className="grid gap-5 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
          {/* 1. Today Screen Time */}
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-xl hover:border-purple-500/30 transition">
            <p className="text-xs uppercase font-semibold tracking-wider text-slate-400">
              Today&apos;s Screen Time
            </p>
            <h3 className="mt-3 text-3xl font-bold text-white">
              {Math.floor(todayMinutes / 60)}h {todayMinutes % 60}m
            </h3>
            <p className="mt-2 text-xs text-slate-400">
              {todayLogs.length} active {todayLogs.length === 1 ? "session" : "sessions"} recorded
            </p>
          </div>

          {/* 2. Most Used App */}
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-xl hover:border-purple-500/30 transition">
            <p className="text-xs uppercase font-semibold tracking-wider text-slate-400">
              Most Used Website
            </p>
            <h3 className="mt-3 text-3xl font-bold text-white truncate">
              {mostUsedApp}
            </h3>
            <p className="mt-2 text-xs text-slate-400">
              {mostUsedMinutes > 0
                ? `${Math.floor(mostUsedMinutes / 60)}h ${mostUsedMinutes % 60}m logged`
                : "No usage recorded"}
            </p>
          </div>

          {/* 3. Daily Limit */}
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-xl hover:border-purple-500/30 transition">
            <div className="flex items-center justify-between">
              <p className="text-xs uppercase font-semibold tracking-wider text-slate-400">
                Daily Limit
              </p>
              <button
                onClick={() => setIsGoalOpen(true)}
                className="text-xs text-purple-400 hover:text-purple-300 font-medium"
              >
                Edit
              </button>
            </div>
            <h3 className="mt-3 text-3xl font-bold text-white">
              {Math.floor(dailyLimit / 60)}h {dailyLimit % 60}m
            </h3>
            <p
              className={`mt-2 text-xs font-medium ${
                isOverLimit ? "text-rose-400" : "text-amber-400"
              }`}
            >
              {isOverLimit
                ? `Exceeded by ${todayMinutes - dailyLimit}m`
                : `${minutesRemaining}m remaining today`}
            </p>
          </div>

          {/* 4. Addiction Score */}
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-xl hover:border-purple-500/30 transition">
            <p className="text-xs uppercase font-semibold tracking-wider text-slate-400">
              Addiction Score
            </p>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-3xl font-bold text-white">{scoreResult.score}</span>
              <span className="text-sm text-slate-500">/ 100</span>
            </div>
            <div className="mt-2 flex items-center gap-2">
              <span
                className={`text-xs px-2.5 py-0.5 rounded-full border font-semibold ${scoreResult.color}`}
              >
                {scoreResult.category}
              </span>
            </div>
          </div>
        </div>

        {/* Website Breakdown Cards */}
        <div className="mt-6 grid gap-4 grid-cols-1 md:grid-cols-3">
          <div className="p-4 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-2xl">▶️</span>
              <div>
                <h5 className="font-semibold text-sm text-white">YouTube</h5>
                <p className="text-xs text-slate-400">Video &amp; Shorts</p>
              </div>
            </div>
            <span className="text-base font-bold text-red-400">
              {Math.floor(youtubeMins / 60)}h {youtubeMins % 60}m
            </span>
          </div>

          <div className="p-4 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-2xl">📸</span>
              <div>
                <h5 className="font-semibold text-sm text-white">Instagram</h5>
                <p className="text-xs text-slate-400">Reels &amp; Feed</p>
              </div>
            </div>
            <span className="text-base font-bold text-pink-400">
              {Math.floor(instagramMins / 60)}h {instagramMins % 60}m
            </span>
          </div>

          <div className="p-4 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-2xl">🤖</span>
              <div>
                <h5 className="font-semibold text-sm text-white">Reddit</h5>
                <p className="text-xs text-slate-400">Communities</p>
              </div>
            </div>
            <span className="text-base font-bold text-orange-400">
              {Math.floor(redditMins / 60)}h {redditMins % 60}m
            </span>
          </div>
        </div>

        {/* Charts & AI Insight Section */}
        <div className="mt-8 grid gap-6 grid-cols-1 lg:grid-cols-3">
          {/* Weekly Screen Time Chart */}
          <div className="lg:col-span-2 rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-xl">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-xl font-semibold">Weekly Screen Time</h3>
                <p className="mt-1 text-sm text-slate-400">
                  Aggregate extension and manual usage during the last 7 days
                </p>
              </div>

              <div className="flex items-center gap-2">
                <span className="rounded-lg bg-purple-500/20 border border-purple-500/30 px-3 py-1 text-xs font-medium text-purple-300">
                  Total: {Math.floor(weeklyTotalMinutes / 60)}h {weeklyTotalMinutes % 60}m
                </span>
                <span className="hidden sm:inline-block rounded-lg bg-emerald-500/20 border border-emerald-500/30 px-3 py-1 text-xs font-medium text-emerald-300">
                  Adherence: {weeklyProgressPercent}%
                </span>
              </div>
            </div>

            <div className="mt-8 grid grid-cols-7 gap-2 sm:gap-4 items-end h-56 pt-6 border-b border-white/10 pb-2">
              {last7Days.map((d) => {
                const heightPercent =
                  maxWeeklyMinutes > 0
                    ? Math.max(8, Math.min(100, Math.round((d.minutes / maxWeeklyMinutes) * 100)))
                    : 8
                const isOver = d.minutes > dailyLimit
                return (
                  <div
                    key={d.date}
                    className="flex h-full flex-col items-center justify-end gap-2 group relative"
                  >
                    <div className="opacity-0 group-hover:opacity-100 transition absolute -top-8 bg-slate-800 text-xs px-2 py-1 rounded shadow-lg border border-white/10 whitespace-nowrap z-10 pointer-events-none">
                      {Math.floor(d.minutes / 60)}h {d.minutes % 60}m
                    </div>

                    <div
                      className={`w-full max-w-10 rounded-t-lg transition-all duration-300 ${
                        isOver
                          ? "bg-rose-500/80 hover:bg-rose-500"
                          : "bg-purple-500/80 hover:bg-purple-500"
                      }`}
                      style={{ height: `${heightPercent}%` }}
                    />
                    <span className="text-xs text-slate-400 font-medium">{d.day}</span>
                  </div>
                )
              })}
            </div>
            <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
              <span>Past 7 Days History</span>
              <span className="flex items-center gap-2">
                <span className="inline-block w-2.5 h-2.5 rounded-full bg-purple-500" /> Normal
                <span className="inline-block w-2.5 h-2.5 rounded-full bg-rose-500 ml-2" /> Over Limit
              </span>
            </div>
          </div>

          {/* AI Wellness Insight Card */}
          <div className="rounded-2xl border border-purple-500/30 bg-purple-500/10 p-6 backdrop-blur-xl flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-3xl">🤖</span>
                <div>
                  <h3 className="text-lg font-bold text-white">Gemini AI Wellness Insight</h3>
                  <p className="text-xs text-purple-300">Habit &amp; behavioral analysis</p>
                </div>
              </div>

              <div className="mt-4 p-4 rounded-xl bg-slate-900/60 border border-purple-500/20 text-xs leading-relaxed text-slate-200">
                {aiAnalysisCustom || scoreResult.feedback}
              </div>

              <div className="mt-4 space-y-2 text-xs text-slate-400">
                <div className="flex justify-between">
                  <span>Usage Intensity:</span>
                  <span className="text-slate-200 font-medium">{scoreResult.factors.screenTimeScore}/45 pts</span>
                </div>
                <div className="flex justify-between">
                  <span>Threshold Exceedance:</span>
                  <span className="text-slate-200 font-medium">{scoreResult.factors.limitExceedScore}/35 pts</span>
                </div>
                <div className="flex justify-between">
                  <span>Doomscroll Apps Factor:</span>
                  <span className="text-slate-200 font-medium">{scoreResult.factors.lateNightScore}/20 pts</span>
                </div>
              </div>
            </div>

            <button
              onClick={handleTriggerAI}
              disabled={aiLoading}
              className="mt-6 w-full rounded-xl bg-purple-500 hover:bg-purple-600 disabled:opacity-50 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-purple-500/25 transition"
            >
              {aiLoading ? "Consulting Gemini AI..." : "Refresh AI Analysis"}
            </button>
          </div>
        </div>

        {/* Quick Actions Grid */}
        <div className="mt-8 rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-xl">
          <h3 className="text-lg font-bold text-white">Quick Actions</h3>

          <div className="mt-4 grid gap-4 grid-cols-1 md:grid-cols-3">
            <button
              onClick={() => setIsAddOpen(true)}
              className="group rounded-2xl border border-white/10 bg-white/5 p-5 text-left hover:bg-white/10 hover:border-purple-500/40 transition cursor-pointer"
            >
              <div className="text-2xl transition group-hover:scale-110">⏱️</div>
              <h4 className="mt-3 font-semibold text-white group-hover:text-purple-300 transition">
                Add Screen Time
              </h4>
              <p className="mt-1 text-xs text-slate-400">
                Record an app session manually or sync your social media duration
              </p>
            </button>

            <button
              onClick={() => setIsGoalOpen(true)}
              className="group rounded-2xl border border-white/10 bg-white/5 p-5 text-left hover:bg-white/10 hover:border-purple-500/40 transition cursor-pointer"
            >
              <div className="text-2xl transition group-hover:scale-110">🎯</div>
              <h4 className="mt-3 font-semibold text-white group-hover:text-purple-300 transition">
                Set Daily Goal
              </h4>
              <p className="mt-1 text-xs text-slate-400">
                Configure your target boundaries and alert triggers
              </p>
            </button>

            <button
              onClick={() => setIsReportsOpen(true)}
              className="group rounded-2xl border border-white/10 bg-white/5 p-5 text-left hover:bg-white/10 hover:border-purple-500/40 transition cursor-pointer"
            >
              <div className="text-2xl transition group-hover:scale-110">📊</div>
              <h4 className="mt-3 font-semibold text-white group-hover:text-purple-300 transition">
                View Reports
              </h4>
              <p className="mt-1 text-xs text-slate-400">
                Inspect history, filter platform usage, and manage logged sessions
              </p>
            </button>
          </div>
        </div>
      </div>

      {/* Modals */}
      {profile && (
        <>
          <ConnectExtensionModal
            isOpen={isConnectModalOpen}
            onClose={() => setIsConnectModalOpen(false)}
            isConnected={hasExtensionActivity}
            userEmail={profile.email}
          />
          <AddScreenTimeModal
            isOpen={isAddOpen}
            onClose={() => setIsAddOpen(false)}
            onSuccess={fetchData}
            userId={profile.id}
            currentDailyLimitMinutes={dailyLimit}
            todayCurrentMinutes={todayMinutes}
          />
          <SetGoalModal
            isOpen={isGoalOpen}
            onClose={() => setIsGoalOpen(false)}
            onSuccess={fetchData}
            userId={profile.id}
            currentLimitMinutes={dailyLimit}
          />
          <ReportsModal
            isOpen={isReportsOpen}
            onClose={() => setIsReportsOpen(false)}
            logs={logs}
            onLogsUpdated={fetchData}
          />
        </>
      )}
    </main>
  )
}