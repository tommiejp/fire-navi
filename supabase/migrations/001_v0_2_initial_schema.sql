-- FIREナビ v0.2: initial schema for Supabase/PostgreSQL.
-- Run once with the trusted migration role; auth.users and Supabase roles must exist.
-- No application/localStorage data is imported. Existing Auth users get empty profiles.
BEGIN;

CREATE TABLE public.profiles (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    display_name TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT profiles_display_name_length CHECK (char_length(display_name) <= 50)
);

CREATE TABLE public.user_financial_settings (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    total_assets BIGINT NOT NULL,
    annual_expenses BIGINT NOT NULL,
    expected_return NUMERIC(5,2) NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT settings_total_assets_nonnegative CHECK (total_assets >= 0),
    CONSTRAINT settings_annual_expenses_positive CHECK (annual_expenses > 0),
    CONSTRAINT settings_expected_return_range CHECK (expected_return >= 0 AND expected_return <= 20)
);

COMMENT ON COLUMN public.user_financial_settings.expected_return
    IS 'Percentage points: 5.00 means 5%. Divide by 100 for calculation.';

CREATE TABLE public.asset_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    total_assets BIGINT NOT NULL,
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT history_total_assets_nonnegative CHECK (total_assets >= 0)
);

CREATE INDEX asset_history_user_recorded_at_idx
    ON public.asset_history (user_id, recorded_at DESC);

CREATE FUNCTION public.fire_navi_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
    NEW.updated_at := pg_catalog.now();
    RETURN NEW;
END;
$$;

CREATE TRIGGER user_financial_settings_set_updated_at
BEFORE UPDATE ON public.user_financial_settings
FOR EACH ROW EXECUTE FUNCTION public.fire_navi_set_updated_at();

CREATE FUNCTION public.fire_navi_create_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    -- Do not copy untrusted metadata into the profile or authorization fields.
    INSERT INTO public.profiles (user_id) VALUES (NEW.id);
    RETURN NEW;
END;
$$;

CREATE TRIGGER fire_navi_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.fire_navi_create_profile();

REVOKE ALL ON FUNCTION public.fire_navi_set_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fire_navi_create_profile() FROM PUBLIC, anon, authenticated;

-- Backfill accounts created before this initial schema, without overwriting profiles.
INSERT INTO public.profiles (user_id)
SELECT id FROM auth.users
ON CONFLICT (user_id) DO NOTHING;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_financial_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.asset_history ENABLE ROW LEVEL SECURITY;

-- Explicit grants avoid relying on Supabase's project-specific default privileges.
REVOKE ALL ON TABLE public.profiles, public.user_financial_settings, public.asset_history
    FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.profiles TO authenticated;
GRANT UPDATE (display_name) ON TABLE public.profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.user_financial_settings, public.asset_history
    TO authenticated;

CREATE POLICY profiles_select_own ON public.profiles
FOR SELECT TO authenticated
USING (auth.uid() IS NOT NULL AND auth.uid() = user_id);

CREATE POLICY profiles_update_own ON public.profiles
FOR UPDATE TO authenticated
USING (auth.uid() IS NOT NULL AND auth.uid() = user_id)
WITH CHECK (auth.uid() IS NOT NULL AND auth.uid() = user_id);

-- No client INSERT or DELETE policy for profiles.
CREATE POLICY settings_select_own ON public.user_financial_settings
FOR SELECT TO authenticated
USING (auth.uid() IS NOT NULL AND auth.uid() = user_id);

CREATE POLICY settings_insert_own ON public.user_financial_settings
FOR INSERT TO authenticated
WITH CHECK (auth.uid() IS NOT NULL AND auth.uid() = user_id);

CREATE POLICY settings_update_own ON public.user_financial_settings
FOR UPDATE TO authenticated
USING (auth.uid() IS NOT NULL AND auth.uid() = user_id)
WITH CHECK (auth.uid() IS NOT NULL AND auth.uid() = user_id);

CREATE POLICY settings_delete_own ON public.user_financial_settings
FOR DELETE TO authenticated
USING (auth.uid() IS NOT NULL AND auth.uid() = user_id);

CREATE POLICY history_select_own ON public.asset_history
FOR SELECT TO authenticated
USING (auth.uid() IS NOT NULL AND auth.uid() = user_id);

CREATE POLICY history_insert_own ON public.asset_history
FOR INSERT TO authenticated
WITH CHECK (auth.uid() IS NOT NULL AND auth.uid() = user_id);

CREATE POLICY history_update_own ON public.asset_history
FOR UPDATE TO authenticated
USING (auth.uid() IS NOT NULL AND auth.uid() = user_id)
WITH CHECK (auth.uid() IS NOT NULL AND auth.uid() = user_id);

CREATE POLICY history_delete_own ON public.asset_history
FOR DELETE TO authenticated
USING (auth.uid() IS NOT NULL AND auth.uid() = user_id);

COMMIT;
