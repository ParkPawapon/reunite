-- Run as the release operator in the Reunite Supabase database.
-- Configure Vault secret reunite_matching_runner_secret and deploy the runner first.
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

SELECT cron.schedule('reunite-match-items', '* * * * *', $job$
  SELECT net.http_post(
    url := 'https://reunite.tech/api/internal/matching/run',
    headers := jsonb_build_object('Authorization', 'Bearer ' || secret.decrypted_secret),
    timeout_milliseconds := 55000
  )
  FROM vault.decrypted_secrets secret
  WHERE secret.name = 'reunite_matching_runner_secret'
    AND EXISTS (
      SELECT 1
      FROM public.report_matches m
      JOIN public.item_reports l ON l.report_id = m.lost_report_id
      JOIN public.item_reports f ON f.report_id = m.found_report_id
      WHERE ((m.state = 'queued' AND m.available_at <= CURRENT_TIMESTAMP)
          OR (m.state = 'processing' AND m.leased_until < CURRENT_TIMESTAMP))
        AND m.attempts < 3
        AND l.status = 'OPEN'
        AND f.status = 'OPEN'
        AND l.matching_revision = m.lost_revision
        AND f.matching_revision = m.found_revision
    );
$job$);
