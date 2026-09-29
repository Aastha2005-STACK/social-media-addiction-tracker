export type UserRole = "user" | "parent" | "counselor" | "admin"

export interface Profile {
  id: string
  email: string
  full_name?: string | null
  role: UserRole
  created_at?: string
  updated_at?: string
}

export interface UsageLog {
  id: string
  user_id: string
  platform: string
  duration_minutes: number
  log_date: string
  session_start?: string | null
  session_end?: string | null
  category?: string
  notes?: string | null
  created_at?: string
}

export interface UserLimit {
  id?: string
  user_id: string
  daily_limit_minutes: number
  weekend_limit_minutes?: number
  warning_threshold_percent?: number
  updated_at?: string
}

export interface ParentChildLink {
  id: string
  parent_id: string
  child_id: string
  status: "pending" | "active" | "rejected"
  created_at?: string
  child_profile?: Profile
  child_today_minutes?: number
  child_addiction_score?: number
}

export interface CounselorAssignment {
  id: string
  counselor_id: string
  user_id: string
  status: "active" | "completed"
  created_at?: string
  user_profile?: Profile
}

export interface CounselorNote {
  id: string
  counselor_id: string
  user_id: string
  title: string
  recommendation: string
  priority: "Low" | "Normal" | "High" | "Urgent"
  created_at?: string
}

export interface UserAlert {
  id: string
  user_id: string
  type: "LIMIT_EXCEEDED" | "LATE_NIGHT_SPIKE" | "HIGH_ADDICTION_SCORE" | "GENERAL"
  message: string
  severity: "info" | "warning" | "danger"
  is_read: boolean
  created_at?: string
}

export interface AddictionScoreResult {
  score: number
  category: "Healthy" | "Moderate" | "High Risk" | "Severe"
  riskLevel: "low" | "medium" | "high" | "critical"
  color: string
  feedback: string
  factors: {
    screenTimeScore: number
    limitExceedScore: number
    lateNightScore: number
  }
}
