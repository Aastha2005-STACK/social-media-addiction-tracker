import { AddictionScoreResult, UsageLog } from "./types"

export function calculateAddictionScore(
  todayMinutes: number,
  dailyLimitMinutes: number = 180,
  recentLogs: UsageLog[] = []
): AddictionScoreResult {
  // 1. Screen Time Factor (Up to 45 pts)
  // < 90m: 5 pts; 90-180m: 15 pts; 180-300m: 30 pts; 300m+: 45 pts
  let screenTimeScore = 0
  if (todayMinutes < 90) {
    screenTimeScore = Math.round((todayMinutes / 90) * 10)
  } else if (todayMinutes <= 180) {
    screenTimeScore = 10 + Math.round(((todayMinutes - 90) / 90) * 15)
  } else if (todayMinutes <= 300) {
    screenTimeScore = 25 + Math.round(((todayMinutes - 180) / 120) * 15)
  } else {
    screenTimeScore = 40 + Math.min(5, Math.round(((todayMinutes - 300) / 120) * 5))
  }

  // 2. Limit Exceedance Factor (Up to 35 pts)
  let limitExceedScore = 0
  if (todayMinutes > dailyLimitMinutes && dailyLimitMinutes > 0) {
    const overMinutes = todayMinutes - dailyLimitMinutes
    if (overMinutes <= 30) {
      limitExceedScore = 15
    } else if (overMinutes <= 90) {
      limitExceedScore = 25
    } else {
      limitExceedScore = 35
    }
  } else if (dailyLimitMinutes > 0 && todayMinutes >= dailyLimitMinutes * 0.85) {
    limitExceedScore = 10
  }

  // 3. Late Night or High Doomscroll Platforms (Up to 20 pts)
  let lateNightScore = 0
  const highRiskPlatforms = ["Instagram", "TikTok", "YouTube Shorts", "Snapchat", "Reddit"]
  const highRiskMinutes = recentLogs
    .filter((l) => highRiskPlatforms.includes(l.platform))
    .reduce((acc, curr) => acc + curr.duration_minutes, 0)

  if (highRiskMinutes > 150) {
    lateNightScore += 15
  } else if (highRiskMinutes > 60) {
    lateNightScore += 8
  }

  // Check late night sessions if timestamps exist
  const hasLateNight = recentLogs.some((l) => {
    if (!l.session_start) return false
    const hour = new Date(l.session_start).getHours()
    return hour >= 23 || hour <= 4
  })
  if (hasLateNight) {
    lateNightScore = Math.min(20, lateNightScore + 8)
  }

  const rawScore = Math.min(100, Math.max(0, screenTimeScore + limitExceedScore + lateNightScore))

  if (rawScore <= 30) {
    return {
      score: rawScore,
      category: "Healthy",
      riskLevel: "low",
      color: "text-emerald-400 bg-emerald-500/20 border-emerald-500/30",
      feedback: "Great balance! Your digital consumption is within healthy boundaries. Keep maintaining this pace.",
      factors: { screenTimeScore, limitExceedScore, lateNightScore },
    }
  } else if (rawScore <= 60) {
    return {
      score: rawScore,
      category: "Moderate",
      riskLevel: "medium",
      color: "text-amber-400 bg-amber-500/20 border-amber-500/30",
      feedback: "Moderate usage. Consider introducing scheduled screen-free intervals and avoiding doomscrolling before bed.",
      factors: { screenTimeScore, limitExceedScore, lateNightScore },
    }
  } else if (rawScore <= 80) {
    return {
      score: rawScore,
      category: "High Risk",
      riskLevel: "high",
      color: "text-orange-400 bg-orange-500/20 border-orange-500/30",
      feedback: "High screen time detected! You are frequently crossing your daily thresholds. Implement app timers immediately.",
      factors: { screenTimeScore, limitExceedScore, lateNightScore },
    }
  } else {
    return {
      score: rawScore,
      category: "Severe",
      riskLevel: "critical",
      color: "text-rose-400 bg-rose-500/20 border-rose-500/30",
      feedback: "Severe addiction risk! Excessive screen time may impact sleep, focus, and mental wellness. Consider counseling support.",
      factors: { screenTimeScore, limitExceedScore, lateNightScore },
    }
  }
}
