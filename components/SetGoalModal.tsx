"use client"

import { useState } from "react"
import { createClient } from "@/lib/supabase/client"

interface SetGoalModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  userId: string
  currentLimitMinutes?: number
}

export default function SetGoalModal({
  isOpen,
  onClose,
  onSuccess,
  userId,
  currentLimitMinutes = 180,
}: SetGoalModalProps) {
  const supabase = createClient()
  const [hours, setHours] = useState(Math.floor(currentLimitMinutes / 60))
  const [minutes, setMinutes] = useState(currentLimitMinutes % 60)
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState("")

  if (!isOpen) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg("")
    const totalMinutes = hours * 60 + minutes

    if (totalMinutes <= 0) {
      setErrorMsg("Daily goal must be at least 1 minute.")
      return
    }

    setLoading(true)
    try {
      const { error } = await supabase.from("user_limits").upsert(
        {
          user_id: userId,
          daily_limit_minutes: totalMinutes,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" }
      )

      if (error) throw error

      onSuccess()
      onClose()
    } catch (err: unknown) {
      const error = err as { message?: string }
      setErrorMsg(error?.message || "Failed to update daily goal.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-md rounded-3xl border border-white/20 bg-slate-900/95 p-6 sm:p-8 shadow-2xl text-white">
        <div className="flex items-center justify-between pb-4 border-b border-white/10">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🎯</span>
            <h3 className="text-xl font-bold">Set Daily Screen Time Goal</h3>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white transition text-lg"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <p className="text-sm text-slate-300">
            Define your daily boundary. Once reached, SocialTrack will flag your usage and notify you or your connected guardian.
          </p>

          <div className="grid grid-cols-2 gap-3 pt-2">
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

          <div className="p-3 rounded-xl bg-purple-500/10 border border-purple-500/20 text-xs text-purple-200">
            Current Target: <span className="font-semibold text-white">{hours}h {minutes}m</span> per day ({hours * 60 + minutes} total minutes)
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
              {loading ? "Updating..." : "Save Daily Goal"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
