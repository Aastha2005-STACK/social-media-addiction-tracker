"use client"

import { useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { UsageLog } from "@/lib/types"

interface ReportsModalProps {
  isOpen: boolean
  onClose: () => void
  logs: UsageLog[]
  onLogsUpdated: () => void
}

export default function ReportsModal({
  isOpen,
  onClose,
  logs,
  onLogsUpdated,
}: ReportsModalProps) {
  const supabase = createClient()
  const [filterPlatform, setFilterPlatform] = useState<string>("all")
  const [deletingId, setDeletingId] = useState<string | null>(null)

  if (!isOpen) return null

  const platforms = Array.from(new Set(logs.map((l) => l.platform)))

  const filteredLogs = logs.filter((l) => {
    if (filterPlatform !== "all" && l.platform !== filterPlatform) return false
    return true
  })

  const totalFilteredMinutes = filteredLogs.reduce((acc, curr) => acc + curr.duration_minutes, 0)

  const handleDelete = async (id: string) => {
    setDeletingId(id)
    try {
      await supabase.from("usage_logs").delete().eq("id", id)
      onLogsUpdated()
    } catch {
      // ignore
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-2xl max-h-[90vh] flex flex-col rounded-3xl border border-white/20 bg-slate-900/95 p-6 sm:p-8 shadow-2xl text-white">
        <div className="flex items-center justify-between pb-4 border-b border-white/10">
          <div className="flex items-center gap-2">
            <span className="text-2xl">📊</span>
            <div>
              <h3 className="text-xl font-bold">Screen Time Reports & History</h3>
              <p className="text-xs text-slate-400">Review all recorded digital usage sessions</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white transition text-lg"
          >
            ✕
          </button>
        </div>

        {/* Filter and stats */}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 bg-white/5 p-4 rounded-2xl border border-white/10">
          <div>
            <span className="text-xs text-slate-400 uppercase tracking-wider block">Total Logged</span>
            <span className="text-lg font-bold text-purple-300">
              {Math.floor(totalFilteredMinutes / 60)}h {totalFilteredMinutes % 60}m ({filteredLogs.length} logs)
            </span>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-xs text-slate-400">Filter Platform:</label>
            <select
              value={filterPlatform}
              onChange={(e) => setFilterPlatform(e.target.value)}
              className="rounded-xl bg-slate-800 border border-white/10 px-3 py-1.5 text-xs text-white outline-none focus:border-purple-400"
            >
              <option value="all">All Platforms</option>
              {platforms.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Scrollable Table */}
        <div className="mt-4 flex-1 overflow-y-auto space-y-2 pr-1">
          {filteredLogs.length === 0 ? (
            <div className="text-center py-12 text-slate-400 text-sm">
              No usage logs recorded yet. Click &quot;Add Screen Time&quot; on your dashboard to start tracking!
            </div>
          ) : (
            filteredLogs.map((log) => (
              <div
                key={log.id}
                className="flex items-center justify-between p-3.5 rounded-xl bg-white/5 border border-white/10 hover:border-purple-500/30 transition text-sm"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-white">{log.platform}</span>
                    <span className="text-xs text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded-md border border-purple-500/20">
                      {Math.floor(log.duration_minutes / 60)}h {log.duration_minutes % 60}m
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-slate-400 mt-1">
                    <span>{log.log_date}</span>
                    {log.notes && <span>• {log.notes}</span>}
                  </div>
                </div>

                <button
                  onClick={() => handleDelete(log.id)}
                  disabled={deletingId === log.id}
                  className="text-xs text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 px-2.5 py-1.5 rounded-lg border border-rose-500/20 transition disabled:opacity-50"
                >
                  {deletingId === log.id ? "Deleting..." : "Delete"}
                </button>
              </div>
            ))
          )}
        </div>

        <div className="pt-4 mt-2 border-t border-white/10 flex justify-end">
          <button
            onClick={onClose}
            className="rounded-xl bg-white/10 hover:bg-white/20 px-5 py-2 text-sm font-medium text-white transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
