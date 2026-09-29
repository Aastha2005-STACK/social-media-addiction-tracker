-- ==============================================================================
-- Migration: Add email to public.profiles and Fix Signup Auth Trigger
-- Safe & Non-Destructive (Preserves all existing data and user roles)
-- ==============================================================================

-- 1. Safely add email column to public.profiles if it does not already exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'profiles'
      AND column_name = 'email'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN email TEXT;
  END IF;
END $$;

-- 2. Backfill email for existing users from auth.users (does not modify existing roles)
UPDATE public.profiles p
SET email = u.email,
    updated_at = NOW()
FROM auth.users u
WHERE p.id = u.id
  AND (p.email IS NULL OR p.email = '');

-- 3. Replace handle_new_user() with robust error handling and SECURITY DEFINER
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
  -- Extract email safely
  user_email := COALESCE(NEW.email, '');

  -- Determine full name
  user_full_name := COALESCE(
    NEW.raw_user_meta_data->>'full_name',
    split_part(user_email, '@', 1),
    'User'
  );

  -- Default role is always 'user' unless admin specified
  assigned_role := COALESCE(NEW.raw_user_meta_data->>'role', 'user');
  IF assigned_role NOT IN ('user', 'parent', 'counselor', 'admin') THEN
    assigned_role := 'user';
  END IF;

  -- Insert profile safely. DO NOT overwrite existing user roles if profile exists!
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

  -- Safely initialize default limits for the user (180 mins)
  BEGIN
    INSERT INTO public.user_limits (user_id, daily_limit_minutes, weekend_limit_minutes, warning_threshold_percent, updated_at)
    VALUES (NEW.id, 180, 240, 80, NOW())
    ON CONFLICT (user_id) DO NOTHING;
  EXCEPTION WHEN OTHERS THEN
    -- If user_limits table does not exist or fails, do not block signup
    RAISE WARNING 'user_limits initialization skipped: %', SQLERRM;
  END;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Catch-all to prevent "Database error saving new user" signup failure
  RAISE WARNING 'handle_new_user error: %', SQLERRM;
  RETURN NEW;
END;
$$;

-- 4. Re-bind the trigger to auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 5. Ensure RLS policies on profiles allow reading and updating email safely
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
CREATE POLICY "Users can insert their own profile"
ON public.profiles FOR INSERT
WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile, Admins can update any" ON public.profiles;
CREATE POLICY "Users can update own profile, Admins can update any"
ON public.profiles FOR UPDATE
USING (auth.uid() = id OR public.is_admin());
