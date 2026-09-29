-- ==============================================================================
-- SocialTrack: Production Database Schema with Row Level Security (RLS)
-- ==============================================================================

-- 1. Profiles Table (Holds role and user details)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  role TEXT NOT NULL CHECK (role IN ('user', 'parent', 'counselor', 'admin')) DEFAULT 'user',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Daily Social Media Usage Logs
CREATE TABLE IF NOT EXISTS public.usage_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  platform TEXT NOT NULL,
  duration_minutes INTEGER NOT NULL CHECK (duration_minutes > 0),
  log_date DATE NOT NULL DEFAULT CURRENT_DATE,
  session_start TIMESTAMPTZ,
  session_end TIMESTAMPTZ,
  category TEXT DEFAULT 'Social',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for speedy analytics queries
CREATE INDEX IF NOT EXISTS idx_usage_logs_user_date ON public.usage_logs(user_id, log_date);

-- 3. User Daily Limits & Goals
CREATE TABLE IF NOT EXISTS public.user_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE UNIQUE,
  daily_limit_minutes INTEGER NOT NULL DEFAULT 180,
  weekend_limit_minutes INTEGER DEFAULT 240,
  warning_threshold_percent INTEGER DEFAULT 80,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Parent-Child Relationship Links
CREATE TABLE IF NOT EXISTS public.parent_child_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  child_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('pending', 'active', 'rejected')) DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(parent_id, child_id)
);

-- 5. Counselor Client Assignments
CREATE TABLE IF NOT EXISTS public.counselor_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  counselor_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('active', 'completed')) DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(counselor_id, user_id)
);

-- 6. Counselor Recommendations / Notes
CREATE TABLE IF NOT EXISTS public.counselor_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  counselor_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  recommendation TEXT NOT NULL,
  priority TEXT CHECK (priority IN ('Low', 'Normal', 'High', 'Urgent')) DEFAULT 'Normal',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. System / Monitoring Alerts
CREATE TABLE IF NOT EXISTS public.alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  message TEXT NOT NULL,
  severity TEXT CHECK (severity IN ('info', 'warning', 'danger')) DEFAULT 'warning',
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================================================
-- Automatic Trigger: Create Profile on auth.users Signup
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  user_email TEXT;
  user_full_name TEXT;
  assigned_role TEXT;
BEGIN
  user_email := COALESCE(NEW.email, '');

  user_full_name := COALESCE(
    NEW.raw_user_meta_data->>'full_name',
    split_part(user_email, '@', 1),
    'User'
  );

  assigned_role := COALESCE(NEW.raw_user_meta_data->>'role', 'user');
  IF assigned_role NOT IN ('user', 'parent', 'counselor', 'admin') THEN
    assigned_role := 'user';
  END IF;

  INSERT INTO public.profiles (id, email, full_name, role, created_at, updated_at)
  VALUES (
    NEW.id,
    user_email,
    user_full_name,
    assigned_role,
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO UPDATE
  SET
    email = CASE
      WHEN public.profiles.email IS NULL OR public.profiles.email = '' THEN EXCLUDED.email
      ELSE public.profiles.email
    END,
    full_name = COALESCE(public.profiles.full_name, EXCLUDED.full_name),
    updated_at = NOW();

  BEGIN
    INSERT INTO public.user_limits (user_id, daily_limit_minutes, weekend_limit_minutes, warning_threshold_percent, updated_at)
    VALUES (NEW.id, 180, 240, 80, NOW())
    ON CONFLICT (user_id) DO NOTHING;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'user_limits initialization skipped: %', SQLERRM;
  END;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'handle_new_user error: %', SQLERRM;
  RETURN NEW;
END;
$$;

-- Drop existing trigger if it exists then create fresh
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ==============================================================================
-- Security Helper Functions (Bypass recursive RLS checks)
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS TEXT AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- ==============================================================================
-- Enable Row Level Security (RLS) on all tables
-- ==============================================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usage_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.parent_child_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.counselor_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.counselor_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alerts ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------------------------
-- PROFILES POLICIES
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Profiles are readable by owner, admin, or linked parent/counselor" ON public.profiles;
CREATE POLICY "Profiles are readable by owner, admin, or linked parent/counselor"
ON public.profiles FOR SELECT
USING (
  auth.uid() = id
  OR public.is_admin()
  OR EXISTS (
    SELECT 1 FROM public.parent_child_links
    WHERE parent_id = auth.uid() AND child_id = public.profiles.id AND status = 'active'
  )
  OR EXISTS (
    SELECT 1 FROM public.counselor_assignments
    WHERE counselor_id = auth.uid() AND user_id = public.profiles.id AND status = 'active'
  )
);

DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
CREATE POLICY "Users can insert their own profile"
ON public.profiles FOR INSERT
WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile, Admins can update any" ON public.profiles;
CREATE POLICY "Users can update own profile, Admins can update any"
ON public.profiles FOR UPDATE
USING (auth.uid() = id OR public.is_admin());

-- ------------------------------------------------------------------------------
-- USAGE LOGS POLICIES
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can manage own usage logs" ON public.usage_logs;
CREATE POLICY "Users can manage own usage logs"
ON public.usage_logs FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Parents can view linked child usage logs" ON public.usage_logs;
CREATE POLICY "Parents can view linked child usage logs"
ON public.usage_logs FOR SELECT
USING (
  public.is_admin()
  OR EXISTS (
    SELECT 1 FROM public.parent_child_links
    WHERE parent_id = auth.uid() AND child_id = public.usage_logs.user_id AND status = 'active'
  )
  OR EXISTS (
    SELECT 1 FROM public.counselor_assignments
    WHERE counselor_id = auth.uid() AND user_id = public.usage_logs.user_id AND status = 'active'
  )
);

-- ------------------------------------------------------------------------------
-- USER LIMITS POLICIES
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can view and manage their own limits" ON public.user_limits;
CREATE POLICY "Users can view and manage their own limits"
ON public.user_limits FOR ALL
USING (
  auth.uid() = user_id
  OR public.is_admin()
  OR EXISTS (
    SELECT 1 FROM public.parent_child_links
    WHERE parent_id = auth.uid() AND child_id = public.user_limits.user_id AND status = 'active'
  )
)
WITH CHECK (
  auth.uid() = user_id
  OR public.is_admin()
  OR EXISTS (
    SELECT 1 FROM public.parent_child_links
    WHERE parent_id = auth.uid() AND child_id = public.user_limits.user_id AND status = 'active'
  )
);

-- ------------------------------------------------------------------------------
-- PARENT CHILD LINKS POLICIES
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Parents and children can view links" ON public.parent_child_links;
CREATE POLICY "Parents and children can view links"
ON public.parent_child_links FOR SELECT
USING (auth.uid() = parent_id OR auth.uid() = child_id OR public.is_admin());

DROP POLICY IF EXISTS "Parents can create links" ON public.parent_child_links;
CREATE POLICY "Parents can create links"
ON public.parent_child_links FOR INSERT
WITH CHECK (auth.uid() = parent_id OR public.is_admin());

DROP POLICY IF EXISTS "Parents and admin can delete links" ON public.parent_child_links;
CREATE POLICY "Parents and admin can delete links"
ON public.parent_child_links FOR DELETE
USING (auth.uid() = parent_id OR public.is_admin());

-- ------------------------------------------------------------------------------
-- COUNSELOR ASSIGNMENTS & NOTES POLICIES
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Counselors and clients can view assignments" ON public.counselor_assignments;
CREATE POLICY "Counselors and clients can view assignments"
ON public.counselor_assignments FOR SELECT
USING (auth.uid() = counselor_id OR auth.uid() = user_id OR public.is_admin());

DROP POLICY IF EXISTS "Admins can manage counselor assignments" ON public.counselor_assignments;
CREATE POLICY "Admins can manage counselor assignments"
ON public.counselor_assignments FOR ALL
USING (public.is_admin())
WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Counselors can manage notes, clients can view" ON public.counselor_notes;
CREATE POLICY "Counselors can manage notes, clients can view"
ON public.counselor_notes FOR SELECT
USING (auth.uid() = counselor_id OR auth.uid() = user_id OR public.is_admin());

DROP POLICY IF EXISTS "Counselors can insert notes" ON public.counselor_notes;
CREATE POLICY "Counselors can insert notes"
ON public.counselor_notes FOR INSERT
WITH CHECK (auth.uid() = counselor_id OR public.is_admin());

-- ------------------------------------------------------------------------------
-- ALERTS POLICIES
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users and linked parents can view alerts" ON public.alerts;
CREATE POLICY "Users and linked parents can view alerts"
ON public.alerts FOR SELECT
USING (
  auth.uid() = user_id
  OR public.is_admin()
  OR EXISTS (
    SELECT 1 FROM public.parent_child_links
    WHERE parent_id = auth.uid() AND child_id = public.alerts.user_id AND status = 'active'
  )
);

DROP POLICY IF EXISTS "Users and system can insert alerts" ON public.alerts;
CREATE POLICY "Users and system can insert alerts"
ON public.alerts FOR INSERT
WITH CHECK (auth.uid() = user_id OR public.is_admin());
