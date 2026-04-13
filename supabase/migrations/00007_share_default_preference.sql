-- Add preferences JSONB column to user_diet_profiles for user-level UI settings.
-- share_default controls the initial state of the share button in MealLogger.

ALTER TABLE public.user_diet_profiles
  ADD COLUMN IF NOT EXISTS preferences jsonb NOT NULL DEFAULT '{"share_default": "all"}';
