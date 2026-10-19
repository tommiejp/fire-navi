BEGIN;

-- Existing rows receive zero; monthly contributions are not yet used in forecasts.
ALTER TABLE public.user_financial_settings
  ADD COLUMN monthly_contribution BIGINT NOT NULL DEFAULT 0,
  ADD CONSTRAINT user_financial_settings_monthly_contribution_nonnegative
    CHECK (monthly_contribution >= 0);

COMMIT;
