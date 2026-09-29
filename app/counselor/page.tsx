"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import Navbar from "@/components/Navbar"
import { calculateAddictionScore } from "@/lib/addiction-score"
import { Profile, UsageLog, CounselorNote, AddictionScoreResult, UserRole } from "@/lib/types"

interface AssignedClient {
  assignmentId: string
  profile: Profile
  logs: UsageLog[]
  todayMinutes: number
  score: AddictionScoreResult
}

export default function CounselorDashboard() {
  const router = useRouter()
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [counselorProfile, setCounselorProfile] = useState<Profile | null>(null)
  const [clients, setClients] = useState<AssignedClient[]>([])
  const [selectedIndex, setSelectedIndex] = useState(0)

  // Add client form
  const [clientEmail, setClientEmail] = useState("")
  const [assignLoading, setAssignLoading] = useState(false)
  const [assignMsg, setAssignMsg] = useState("")

  // Add Recommendation form
  const [noteTitle, setNoteTitle] = useState("")
  const [noteContent, setNoteContent] = useState("")
  const [priority, setPriority] = useState<"Low" | "Normal" | "High" | "Urgent">("Normal")
  const [noteLoading, setNoteLoading] = useState(false)
  const [clientNotes, setClientNotes] = useState<CounselorNote[]>([])

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

        const { data: prof } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", user.id)
          .single()

        // Strict Role Security: Only verified counselor (or admin) can access /counselor
        if (!prof || (prof.role !== "counselor" && prof.role !== "admin")) {
          const actualRole = (prof?.role as UserRole) || "user"
          const destination = actualRole === "parent" ? "/parent" : "/dashboard"
          router.replace(destination)
          return
        }

        setCounselorProfile(prof as Profile)

        // Query counselor_assignments
        const { data: assignments } = await supabase
          .from("counselor_assignments")
          .select("id, user_id")
          .eq("counselor_id", user.id)

        if (assignments && assignments.length > 0) {
          const loaded: AssignedClient[] = []
          const todayStr = new Date().toISOString().split("T")[0]

          for (const a of assignments) {
            const { data: uProf } = await supabase
              .from("profiles")
              .select("*")
              .eq("id", a.user_id)
              .single()

            const { data: uLogs } = await supabase
              .from("usage_logs")
              .select("*")
              .eq("user_id", a.user_id)
              .order("log_date", { ascending: false })
              .limit(50)

            const userLogs = (uLogs as UsageLog[]) || []
            const todayMins = userLogs
              .filter((l) => l.log_date === todayStr)
              .reduce((acc, curr) => acc + curr.duration_minutes, 0)

            const score = calculateAddictionScore(todayMins, 180, userLogs)

            if (uProf) {
              loaded.push({
                assignmentId: a.id,
                profile: uProf as Profile,
                logs: userLogs,
                todayMinutes: todayMins,
                score,
              })
            }
          }
          setClients(loaded)
        } else {
          setClients([])
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

  const activeClient = clients[selectedIndex]

  // Load client recommendations
  const loadClientNotes = useCallback(async (clientId: string) => {
    if (!clientId) return
    const { data } = await supabase
      .from("counselor_notes")
      .select("*")
      .eq("user_id", clientId)
      .order("created_at", { ascending: false })

    if (data) {
      setClientNotes(data as CounselorNote[])
    }
  }, [supabase])

  useEffect(() => {
    if (activeClient?.profile?.id) {
      loadClientNotes(activeClient.profile.id)
    }
  }, [activeClient?.profile?.id, loadClientNotes])

  const handleAssignClient = async (e: React.FormEvent) => {
    e.preventDefault()
    setAssignLoading(true)
    setAssignMsg("")

    try {
      if (!counselorProfile) return

      const { data: targetUser, error: lookupErr } = await supabase
        .from("profiles")
        .select("id, email, role")
        .eq("email", clientEmail.trim().toLowerCase())
        .single()

      if (lookupErr || !targetUser) {
        setAssignMsg("No user found with this email. Make sure client has registered.")
        return
      }

      const { error: insErr } = await supabase.from("counselor_assignments").insert({
        counselor_id: counselorProfile.id,
        user_id: targetUser.id,
        status: "active",
      })

      if (insErr) {
        if (insErr.code === "23505") {
          setAssignMsg("This client is already added to your roster.")
        } else {
          setAssignMsg(insErr.message)
        }
        return
      }

      setAssignMsg("Client connected to your roster successfully!")
      setClientEmail("")
      await loadData()
    } catch {
      setAssignMsg("Failed to assign client.")
    } finally {
      setAssignLoading(false)
    }
  }

  const handleSendRecommendation = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!activeClient || !counselorProfile) return
    setNoteLoading(true)

    try {
      const { error } = await supabase.from("counselor_notes").insert({
        counselor_id: counselorProfile.id,
        user_id: activeClient.profile.id,
        title: noteTitle.trim(),
        recommendation: noteContent.trim(),
        priority,
      })

      if (error) throw error

      setNoteTitle("")
      setNoteContent("")
      await loadClientNotes(activeClient.profile.id)
    } catch {
      // ignore
    } finally {
      setNoteLoading(false)
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-950 text-white flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-sky-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-slate-400">Loading Counselor Portal...</p>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white flex flex-col">
      <Navbar currentRole={counselorProfile?.role || "counselor"} userEmail={counselorProfile?.email} />

      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 py-8 flex-1">
        {/* Header */}
        <div className="mb-8">
          <p className="text-sky-400 font-medium text-sm">Behavioral Health &amp; Digital Wellness</p>
          <h2 className="mt-1 text-3xl sm:text-4xl font-bold tracking-tight">
            Counselor Intervention Portal
          </h2>
          <p className="mt-2 text-slate-400 text-sm max-w-2xl">
            Assess client addiction severity, evaluate digital behavior patterns, and issue personalized clinical advice.
          </p>
        </div>

        {/* Add Client Roster */}
        <div className="mb-8 rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-xl">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <span>📋</span> Add Client to Consultation Roster
          </h3>
          <p className="mt-1 text-xs text-slate-400">
            Enter client email address to begin wellness tracking and recommendations.
          </p>

          <form onSubmit={handleAssignClient} className="mt-4 flex flex-col sm:flex-row gap-3 max-w-xl">
            <input
              type="email"
              required
              placeholder="client@example.com"
              value={clientEmail}
              onChange={(e) => setClientEmail(e.target.value)}
              className="flex-1 rounded-xl bg-slate-900 border border-white/10 px-4 py-2.5 text-sm text-white placeholder-slate-500 outline-none focus:border-sky-400"
            />
            <button
              type="submit"
              disabled={assignLoading}
              className="rounded-xl bg-sky-500 hover:bg-sky-600 disabled:opacity-50 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-sky-500/20 transition whitespace-nowrap"
            >
              {assignLoading ? "Connecting..." : "Add Client"}
            </button>
          </form>

          {assignMsg && (
            <p className="mt-3 text-xs text-sky-300 bg-sky-500/10 border border-sky-500/20 p-2.5 rounded-xl max-w-xl">
              {assignMsg}
            </p>
          )}
        </div>

        {clients.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/20 p-12 text-center text-slate-400 bg-white/5">
            <div className="text-4xl mb-3">🩺</div>
            <h4 className="text-lg font-semibold text-white">No Clients Assigned</h4>
            <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
              Add a client above by their email to inspect their addiction telemetry and record clinical interventions.
            </p>
          </div>
        ) : (
          <div className="space-y-8">
            {/* Client Tabs */}
            <div className="flex flex-wrap gap-2 border-b border-white/10 pb-3">
              {clients.map((item, idx) => (
                <button
                  key={item.assignmentId}
                  onClick={() => setSelectedIndex(idx)}
                  className={`px-4 py-2 rounded-xl text-sm font-medium transition cursor-pointer ${
                    selectedIndex === idx
                      ? "bg-sky-500 text-white shadow-lg shadow-sky-500/20"
                      : "bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  {item.profile.full_name || item.profile.email}
                  <span className="ml-2 text-xs opacity-75">
                    ({item.score.score}/100)
                  </span>
                </button>
              ))}
            </div>

            {/* Active Client Diagnostics */}
            {activeClient && (
              <>
                <div className="grid gap-5 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-xl">
                    <p className="text-xs uppercase font-semibold tracking-wider text-slate-400">
                      Addiction Diagnosis
                    </p>
                    <div className="mt-3 flex items-baseline gap-2">
                      <span className="text-3xl font-bold text-white">{activeClient.score.score}</span>
                      <span className="text-sm text-slate-500">/ 100</span>
                    </div>
                    <span
                      className={`mt-2 inline-block text-xs px-2.5 py-0.5 rounded-full border font-semibold ${activeClient.score.color}`}
                    >
                      {activeClient.score.category}
                    </span>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-xl">
                    <p className="text-xs uppercase font-semibold tracking-wider text-slate-400">
                      Today&apos;s Screen Time
                    </p>
                    <h3 className="mt-3 text-3xl font-bold text-white">
                      {Math.floor(activeClient.todayMinutes / 60)}h {activeClient.todayMinutes % 60}m
                    </h3>
                    <p className="mt-2 text-xs text-slate-400">Recorded today</p>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-xl">
                    <p className="text-xs uppercase font-semibold tracking-wider text-slate-400">
                      Primary Factor
                    </p>
                    <h3 className="mt-3 text-xl font-bold text-white">
                      {activeClient.score.factors.limitExceedScore > 15
                        ? "Boundary Breaches"
                        : activeClient.score.factors.lateNightScore > 10
                        ? "Doomscroll Apps"
                        : "Nominal Usage"}
                    </h3>
                    <p className="mt-2 text-xs text-slate-400">Addiction driver</p>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-xl">
                    <p className="text-xs uppercase font-semibold tracking-wider text-slate-400">
                      Clinical Interventions
                    </p>
                    <h3 className="mt-3 text-3xl font-bold text-white">
                      {clientNotes.length}
                    </h3>
                    <p className="mt-2 text-xs text-slate-400">Recommendations issued</p>
                  </div>
                </div>

                {/* Recommendation Form & Clinical Notes Feed */}
                <div className="grid gap-6 grid-cols-1 lg:grid-cols-2">
                  {/* Create Recommendation Form */}
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-xl">
                    <h3 className="text-lg font-bold text-white">Issue Clinical Advice</h3>
                    <p className="text-xs text-slate-400 mt-1">
                      Direct guidance will be transmitted to {activeClient.profile.email}&apos;s profile.
                    </p>

                    <form onSubmit={handleSendRecommendation} className="mt-4 space-y-4">
                      <div>
                        <label className="block text-xs font-semibold uppercase text-slate-300 mb-1.5">
                          Intervention Title
                        </label>
                        <input
                          type="text"
                          required
                          placeholder="e.g. Bedtime Digital Curfew & Mindfulness"
                          value={noteTitle}
                          onChange={(e) => setNoteTitle(e.target.value)}
                          className="w-full rounded-xl bg-slate-900 border border-white/10 px-4 py-2.5 text-xs text-white placeholder-slate-500 outline-none focus:border-sky-400"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-semibold uppercase text-slate-300 mb-1.5">
                            Priority
                          </label>
                          <select
                            value={priority}
                            onChange={(e) =>
                              setPriority(e.target.value as "Low" | "Normal" | "High" | "Urgent")
                            }
                            className="w-full rounded-xl bg-slate-900 border border-white/10 px-4 py-2 text-xs text-white outline-none focus:border-sky-400"
                          >
                            <option value="Low">Low</option>
                            <option value="Normal">Normal</option>
                            <option value="High">High</option>
                            <option value="Urgent">Urgent</option>
                          </select>
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold uppercase text-slate-300 mb-1.5">
                          Recommendation &amp; Action Plan
                        </label>
                        <textarea
                          rows={3}
                          required
                          placeholder="Write action items, screen-free periods, or behavioral replacements..."
                          value={noteContent}
                          onChange={(e) => setNoteContent(e.target.value)}
                          className="w-full rounded-xl bg-slate-900 border border-white/10 px-4 py-2.5 text-xs text-white placeholder-slate-500 outline-none focus:border-sky-400"
                        />
                      </div>

                      <button
                        type="submit"
                        disabled={noteLoading}
                        className="rounded-xl bg-sky-500 hover:bg-sky-600 disabled:opacity-50 px-5 py-2.5 text-xs font-semibold text-white shadow-lg shadow-sky-500/20 transition"
                      >
                        {noteLoading ? "Submitting..." : "Send Clinical Advice"}
                      </button>
                    </form>
                  </div>

                  {/* Recommendation History */}
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-xl">
                    <h3 className="text-lg font-bold text-white">Advisory History</h3>
                    <p className="text-xs text-slate-400 mt-1">
                      Previously transmitted notes for this client.
                    </p>

                    <div className="mt-4 space-y-3 max-h-72 overflow-y-auto pr-1">
                      {clientNotes.length === 0 ? (
                        <p className="text-xs text-slate-500 py-8 text-center">
                          No previous notes recorded for this client.
                        </p>
                      ) : (
                        clientNotes.map((note) => (
                          <div
                            key={note.id}
                            className="p-3.5 rounded-xl bg-white/5 border border-white/10 space-y-1.5"
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-semibold text-sm text-white">{note.title}</span>
                              <span
                                className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${
                                  note.priority === "Urgent"
                                    ? "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                                    : note.priority === "High"
                                    ? "bg-orange-500/20 text-orange-300 border border-orange-500/30"
                                    : "bg-sky-500/20 text-sky-300 border border-sky-500/30"
                                }`}
                              >
                                {note.priority}
                              </span>
                            </div>
                            <p className="text-xs text-slate-300 leading-relaxed">
                              {note.recommendation}
                            </p>
                            <span className="text-[10px] text-slate-500 block">
                              {note.created_at ? new Date(note.created_at).toLocaleDateString() : ""}
                            </span>
                          </div>
                        ))
                      )}
                    </div>
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
