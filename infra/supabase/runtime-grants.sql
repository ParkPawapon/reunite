-- Run after the numbered migrations as the owner of the Reunite tables.
-- Create the reunite_runtime login separately and set its password privately.
BEGIN;

ALTER ROLE reunite_runtime SET statement_timeout = '5s';
GRANT USAGE ON SCHEMA public TO reunite_runtime;

GRANT SELECT ON public.categories, public.locations TO reunite_runtime;
GRANT SELECT, UPDATE ON public.users TO reunite_runtime;
GRANT SELECT, INSERT, UPDATE ON
  public.item_reports, public.claims, public.notifications, public.report_matches,
  public.auth_login_throttles
TO reunite_runtime;
GRANT SELECT, INSERT, DELETE ON public.auth_sessions TO reunite_runtime;
GRANT USAGE ON SEQUENCE
  public.item_reports_report_id_seq, public.claims_claim_id_seq,
  public.notifications_notification_id_seq, public.report_matches_match_id_seq
TO reunite_runtime;
GRANT EXECUTE ON FUNCTION public.trim_boundary_whitespace(text) TO reunite_runtime;

COMMIT;
