-- ─── Household Accounts ───────────────────────────────────────────────────────
-- Feature: Multi-User Household Accounts & Shared Meal Logs
-- Adds: households, household_members, meal_participants tables
--       + is_shared / household_id columns on meal_logs
--       + updated meal_logs SELECT policy to include shared meals
--       + extended handle_new_user() to auto-link pending invitations
--       + admin-transfer trigger on household_members deletion

-- ─── 1. households ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.households (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name        varchar     NOT NULL,
  created_by  uuid        NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.households ENABLE ROW LEVEL SECURITY;

-- Policies referencing household_members are defined after that table is created (see below).

-- ─── 2. household_members ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.household_members (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id   uuid        NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  user_id        uuid        REFERENCES public.users(id) ON DELETE SET NULL,
  invited_email  varchar,
  role           varchar     NOT NULL DEFAULT 'member'
                   CHECK (role IN ('admin', 'member')),
  status         varchar     NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending', 'active')),
  created_at     timestamptz NOT NULL DEFAULT now(),

  -- A user_id can only appear once per household (when set)
  CONSTRAINT unique_household_user UNIQUE (household_id, user_id),
  -- An email can only have one pending invite per household
  CONSTRAINT unique_household_email UNIQUE (household_id, invited_email)
);

ALTER TABLE public.household_members ENABLE ROW LEVEL SECURITY;

-- Users see their own membership rows or pending invites addressed to their email
CREATE POLICY "household_members: select own" ON public.household_members
  FOR SELECT USING (
    user_id = auth.uid()
    OR invited_email = (SELECT email FROM public.users WHERE id = auth.uid())
  );

-- Admins can see all members of their household (for listing)
CREATE POLICY "household_members: select household admin" ON public.household_members
  FOR SELECT USING (
    household_id IN (
      SELECT household_id FROM public.household_members hm2
      WHERE hm2.user_id = auth.uid() AND hm2.role = 'admin' AND hm2.status = 'active'
    )
  );

-- Active household members can see their co-members
CREATE POLICY "household_members: select co-members" ON public.household_members
  FOR SELECT USING (
    household_id IN (
      SELECT household_id FROM public.household_members hm2
      WHERE hm2.user_id = auth.uid() AND hm2.status = 'active'
    )
  );

-- Authenticated users can insert (creating household creates admin row via server action)
CREATE POLICY "household_members: insert auth" ON public.household_members
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Users can update their own membership (e.g., accepting invite sets status='active', user_id)
CREATE POLICY "household_members: update own" ON public.household_members
  FOR UPDATE USING (
    user_id = auth.uid()
    OR invited_email = (SELECT email FROM public.users WHERE id = auth.uid())
  );

-- Admins can update members of their household (e.g., role changes)
CREATE POLICY "household_members: update admin" ON public.household_members
  FOR UPDATE USING (
    household_id IN (
      SELECT household_id FROM public.household_members hm2
      WHERE hm2.user_id = auth.uid() AND hm2.role = 'admin' AND hm2.status = 'active'
    )
  );

-- Users can delete their own membership (leave); admins can delete others (remove)
CREATE POLICY "household_members: delete own" ON public.household_members
  FOR DELETE USING (user_id = auth.uid());

CREATE POLICY "household_members: delete admin" ON public.household_members
  FOR DELETE USING (
    household_id IN (
      SELECT household_id FROM public.household_members hm2
      WHERE hm2.user_id = auth.uid() AND hm2.role = 'admin' AND hm2.status = 'active'
    )
  );

-- ─── 2b. households RLS policies (defined here because they reference household_members) ──

-- Members-only SELECT: only users who are active members of this household can see it
CREATE POLICY "households: select own" ON public.households
  FOR SELECT USING (
    id IN (
      SELECT household_id FROM public.household_members
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );

-- Any authenticated user can create a household
CREATE POLICY "households: insert own" ON public.households
  FOR INSERT WITH CHECK (auth.uid() = created_by);

-- Only admin members can update household details
CREATE POLICY "households: update admin" ON public.households
  FOR UPDATE USING (
    id IN (
      SELECT household_id FROM public.household_members
      WHERE user_id = auth.uid() AND role = 'admin' AND status = 'active'
    )
  );

-- Deletion handled by trigger (cascade when last member leaves); no direct DELETE by users
CREATE POLICY "households: delete admin" ON public.households
  FOR DELETE USING (
    id IN (
      SELECT household_id FROM public.household_members
      WHERE user_id = auth.uid() AND role = 'admin' AND status = 'active'
    )
  );

-- ─── 3. Admin transfer trigger ────────────────────────────────────────────────
-- When a household_members row is deleted:
--   - If deleted member was admin and active members remain → promote oldest active member
--   - If no active members remain → delete the household (CASCADE cleans up members)

CREATE OR REPLACE FUNCTION public.handle_household_member_deleted()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_next_admin_id uuid;
  v_active_count  int;
BEGIN
  -- Count remaining active members
  SELECT COUNT(*) INTO v_active_count
  FROM public.household_members
  WHERE household_id = OLD.household_id AND status = 'active';

  IF v_active_count = 0 THEN
    -- No active members left — delete the household (CASCADE removes remaining rows)
    DELETE FROM public.households WHERE id = OLD.household_id;
    RETURN OLD;
  END IF;

  -- If the deleted member was the admin, promote the longest-standing active member
  IF OLD.role = 'admin' AND OLD.status = 'active' THEN
    SELECT id INTO v_next_admin_id
    FROM public.household_members
    WHERE household_id = OLD.household_id
      AND status = 'active'
      AND role = 'member'
    ORDER BY created_at ASC
    LIMIT 1;

    IF v_next_admin_id IS NOT NULL THEN
      UPDATE public.household_members
      SET role = 'admin'
      WHERE id = v_next_admin_id;
    END IF;
  END IF;

  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS on_household_member_deleted ON public.household_members;

CREATE TRIGGER on_household_member_deleted
  AFTER DELETE ON public.household_members
  FOR EACH ROW EXECUTE FUNCTION public.handle_household_member_deleted();

-- ─── 4. Extend handle_new_user() to link pending invitations ─────────────────
-- When a new user registers, check household_members for a pending invite
-- matching their email. If found, link user_id so they can see the invitation.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Create public.users profile
  INSERT INTO public.users (id, email, default_language)
  VALUES (NEW.id, NEW.email, 'es')
  ON CONFLICT (id) DO NOTHING;

  -- Create default diet profile
  INSERT INTO public.user_diet_profiles (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;

  -- Link any pending household invitations sent to this email
  UPDATE public.household_members
  SET user_id = NEW.id
  WHERE invited_email = NEW.email
    AND status = 'pending'
    AND user_id IS NULL;

  RETURN NEW;
END;
$$;

-- Trigger already exists from 00003 — no need to recreate (REPLACE covers function update)

-- ─── 5. meal_participants ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.meal_participants (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  meal_log_id  uuid        NOT NULL REFERENCES public.meal_logs(id) ON DELETE CASCADE,
  user_id      uuid        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  dismissed    boolean     NOT NULL DEFAULT false,
  created_at   timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT unique_meal_participant UNIQUE (meal_log_id, user_id)
);

ALTER TABLE public.meal_participants ENABLE ROW LEVEL SECURITY;

-- Co-eaters see their own participation rows
CREATE POLICY "meal_participants: select own" ON public.meal_participants
  FOR SELECT USING (user_id = auth.uid());

-- Only the original meal logger can insert co-eater rows
CREATE POLICY "meal_participants: insert logger" ON public.meal_participants
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.meal_logs
      WHERE id = meal_log_id AND user_id = auth.uid()
    )
  );

-- Co-eaters can update their own row (dismissed = true)
CREATE POLICY "meal_participants: update own" ON public.meal_participants
  FOR UPDATE USING (user_id = auth.uid());

-- Co-eaters can delete their own row (alternative to dismissed flag, kept for flexibility)
CREATE POLICY "meal_participants: delete own" ON public.meal_participants
  FOR DELETE USING (user_id = auth.uid());

-- ─── 6. meal_logs additions ───────────────────────────────────────────────────

ALTER TABLE public.meal_logs
  ADD COLUMN IF NOT EXISTS is_shared    boolean DEFAULT false NOT NULL,
  ADD COLUMN IF NOT EXISTS household_id uuid    REFERENCES public.households(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS meal_logs_household_shared_idx
  ON public.meal_logs (household_id, is_shared)
  WHERE is_shared = true;

-- ─── 7. Update meal_logs SELECT policy ───────────────────────────────────────
-- Extend the existing "meal_logs: select own" policy to also allow reading
-- shared meals that belong to the user's household.
-- NOTE: Drop and recreate because ALTER POLICY cannot change the USING expression.

DROP POLICY IF EXISTS "meal_logs: select own" ON public.meal_logs;

CREATE POLICY "meal_logs: select own or shared" ON public.meal_logs
  FOR SELECT USING (
    -- Own meals (unchanged behavior)
    user_id = auth.uid()
    -- OR: shared meals from user's household (that the user hasn't dismissed)
    OR (
      is_shared = true
      AND household_id IN (
        SELECT household_id FROM public.household_members
        WHERE user_id = auth.uid() AND status = 'active'
      )
      AND id NOT IN (
        SELECT meal_log_id FROM public.meal_participants
        WHERE user_id = auth.uid() AND dismissed = true
      )
    )
  );
