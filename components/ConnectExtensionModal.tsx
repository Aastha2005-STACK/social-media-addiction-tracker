"use client"

import { useState } from "react"

interface ConnectExtensionModalProps {
  isOpen: boolean
  onClose: () => void
  isConnected: boolean
  userEmail?: string
}

export default function ConnectExtensionModal({
  isOpen,
  onClose,
  isConnected,
  userEmail,
}: ConnectExtensionModalProps) {
  const [copied, setCopied] = useState(false)

  if (!isOpen) return null

  const handleCopyPath = () => {
    navigator.clipboard.writeText("C:\\Users\\Aastha\\social-media-addiction-tracker\\chrome-extension")
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-lg rounded-3xl border border-white/20 bg-slate-900/95 p-6 sm:p-8 shadow-2xl text-white">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <span className="text-3xl">🧩</span>
            <div>
              <h3 className="text-lg font-bold">SocialTrack Chrome Extension</h3>
              <p className="text-xs text-slate-400">Active screen time tracking for Chrome</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white transition text-lg"
          >
            ✕
          </button>
        </div>

        {/* Status Pill */}
        <div className="mt-4 flex items-center justify-between p-3.5 rounded-2xl bg-white/5 border border-white/10">
          <div className="flex items-center gap-2.5">
            <span
              className={`w-3 h-3 rounded-full ${
                isConnected ? "bg-emerald-400 shadow-lg shadow-emerald-400/50" : "bg-rose-400"
              }`}
            />
            <span className="text-xs font-semibold">
              {isConnected ? "Extension Connected & Paired" : "Extension Not Paired Yet"}
            </span>
          </div>
          <span className="text-xs text-purple-300 font-mono truncate max-w-[180px]">
            {userEmail || "Active Account"}
          </span>
        </div>

        {/* Installation Steps */}
        <div className="mt-5 space-y-3.5 text-xs text-slate-300">
          <h4 className="font-semibold uppercase tracking-wider text-purple-300 text-[11px]">
            Quick Setup (2 Minutes)
          </h4>

          <div className="flex items-start gap-3 p-3 rounded-xl bg-white/5 border border-white/5">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-purple-500/20 text-purple-300 font-bold text-[10px]">
              1
            </span>
            <div>
              <p className="font-medium text-white">Open Chrome Extensions Manager</p>
              <p className="text-slate-400 mt-0.5">
                In Google Chrome, navigate to{" "}
                <code className="bg-slate-800 text-purple-300 px-1.5 py-0.5 rounded font-mono">
                  chrome://extensions/
                </code>
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 p-3 rounded-xl bg-white/5 border border-white/5">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-purple-500/20 text-purple-300 font-bold text-[10px]">
              2
            </span>
            <div>
              <p className="font-medium text-white">Turn On &quot;Developer mode&quot;</p>
              <p className="text-slate-400 mt-0.5">
                Toggle the switch in the top-right corner of the Extensions page.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 p-3 rounded-xl bg-white/5 border border-white/5">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-purple-500/20 text-purple-300 font-bold text-[10px]">
              3
            </span>
            <div className="flex-1">
              <p className="font-medium text-white">Click &quot;Load unpacked&quot; and Select Folder</p>
              <p className="text-slate-400 mt-0.5">
                Select the <code className="text-purple-300">chrome-extension</code> directory:
              </p>
              <div className="mt-2 flex items-center justify-between bg-slate-950 p-2 rounded-lg border border-white/10 font-mono text-[10px] text-slate-300">
                <span className="truncate pr-2">social-media-addiction-tracker\chrome-extension</span>
                <button
                  type="button"
                  onClick={handleCopyPath}
                  className="px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 hover:bg-purple-500/30 whitespace-nowrap"
                >
                  {copied ? "Copied!" : "Copy Path"}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Privacy Note */}
        <div className="mt-5 p-3 rounded-xl bg-purple-500/10 border border-purple-500/20 text-[11px] leading-relaxed text-purple-200">
          <strong>Privacy Guarantee:</strong> SocialTrack tracks active tab time ONLY on YouTube, Instagram, and Reddit. It does not monitor passwords, messages, search history, or personal files.
        </div>

        {/* Footer */}
        <div className="mt-5 pt-3 border-t border-white/10 flex justify-end">
          <button
            onClick={onClose}
            className="rounded-xl bg-purple-500 hover:bg-purple-600 px-5 py-2 text-xs font-semibold text-white transition shadow-lg shadow-purple-500/25"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  )
}
