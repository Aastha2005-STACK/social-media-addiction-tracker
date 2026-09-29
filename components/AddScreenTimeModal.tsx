"use client"

import { useState } from "react"
import { createClient } from "@/lib/supabase/client"

interface AddScreenTimeModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  userId: string
  currentDailyLimitMinutes?: number
  todayCurrentMinutes?: number
}

const PLATFORMS = [
  "Instagram",
  "YouTube",
  "TikTok",
  "Twitter / X",
  "Facebook",
  "Reddit",
  "Snapchat",
  "LinkedIn",
  "WhatsApp",
  "Other",
]

export default function AddScreenTimeModal({
  isOpen,
  onClose,
  onSuccess,
  userId,
  currentDailyLimitMinutes = 180,
  todayCurrentMinutes = 0,
}: AddScreenTimeModalProps) {
  const supabase = createClient()
  const [platform, setPlatform] = useState(PLATFORMS[0])
  const [hours, setHours] = useState(1)
  const [minutes, setMinutes] = useState(0)
  const [logDate, setLogDate] = useState(() => new Date().toISOString().split("T")[0])
  const [notes, setNotes] = useState("")
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState("")

  if (!isOpen) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg("")
    const totalDuration = hours * 60 + minutes

    if (totalDuration <= 0) {
      setErrorMsg("Please enter a duration greater than 0 minutes.")
      return
    }

    setLoading(true)
    try {
      const { error } = await supabase.from("usage_logs").insert({
        user_id: userId,
        platform,
        duration_minutes: totalDuration,
        log_date: logDate,
        notes: notes.trim() || null,
      })

      if (error) {
        throw error
      }

      // Check if this push triggers an alert
      if (todayCurrentMinutes + totalDuration > currentDailyLimitMinutes) {
        await supabase.from("alerts").insert({
          user_id: userId,
          type: "LIMIT_EXCEEDED",
          message: `Daily limit exceeded! You have logged ${todayCurrentMinutes + totalDuration}m today (limit: ${currentDailyLimitMinutes}m).`,
          severity: "warning",
        })
      }

      onSuccess()
      onClose()
    } catch (err: unknown) {
      const error = err as { message?: string }
      setErrorMsg(error?.message || "Failed to log screen time. Please ensure database tables are created.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-md rounded-3xl border border-white/20 bg-slate-900/95 p-6 sm:p-8 shadow-2xl text-white">
        <div className="flex items-center justify-between pb-4 border-b border-white/10">
          <div className="flex items-center gap-2">
            <span className="text-2xl">⏱️</span>
            <h3 className="text-xl font-bold">Add Screen Time</h3>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white transition text-lg"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2">
              Platform / App
            </label>
            <select
              value={platform}
              onChange={(e) => setPlatform(e.target.value)}
              className="w-full rounded-xl bg-slate-800 border border-white/10 px-4 py-2.5 text-sm text-white outline-none focus:border-purple-400"
            >
              {PLATFORMS.map((p) => (
                <option key={p} value={p} className="bg-slate-900">
                  {p}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2">
                Hours
              </label>
              <input
                type="number"
                min={0}
                max={24}
                value={hours}
                onChange={(e) => setHours(Math.max(0, parseInt(e.target.value) || 0))}
                className="w-full rounded-xl bg-slate-800 border border-white/10 px-4 py-2.5 text-sm text-white outline-none focus:border-purple-400"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2">
                Minutes
              </label>
              <input
                type="number"
                min={0}
                max={59}
                value={minutes}
                onChange={(e) => setMinutes(Math.max(0, parseInt(e.target.value) || 0))}
                className="w-full rounded-xl bg-slate-800 border border-white/10 px-4 py-2.5 text-sm text-white outline-none focus:border-purple-400"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2">
              Date
            </label>
            <input
              type="date"
              value={logDate}
              onChange={(e) => setLogDate(e.target.value)}
              className="w-full rounded-xl bg-slate-800 border border-white/10 px-4 py-2.5 text-sm text-white outline-none focus:border-purple-400"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2">
              Notes (Optional)
            </label>
            <input
              type="text"
              placeholder="e.g. Scrolling reels, watching tech tutorial"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full rounded-xl bg-slate-800 border border-white/10 px-4 py-2.5 text-sm text-white placeholder-slate-500 outline-none focus:border-purple-400"
            />
          </div>

          {errorMsg && (
            <div className="p-3 text-xs rounded-xl bg-rose-500/20 border border-rose-500/30 text-rose-300">
              {errorMsg}
            </div>
          )}

          <div className="pt-2 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl px-4 py-2.5 text-sm font-medium text-slate-300 hover:text-white transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="rounded-xl bg-purple-500 hover:bg-purple-600 disabled:opacity-50 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-purple-500/20 transition"
            >
              {loading ? "Saving..." : "Save Screen Time"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
