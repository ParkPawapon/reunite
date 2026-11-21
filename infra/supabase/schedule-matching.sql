-- Run as the release operator in the Reunite Supabase database.
-- Configure Vault secret reunite_matching_runner_secret and deploy the runner first.
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

SELECT cron.schedule('reunite-match-items', '* * * * *', $job$
  SELECT net.http_post(
    url := 'https://reunite-kmutt.vercel.app/api/internal/matching/run',
    headers := jsonb_build_object('Authorization', 'Bearer ' || secret.decrypted_secret),
    timeout_milliseconds := 55000
  )
  FROM vault.decrypted_secrets secret
  WHERE secret.name = 'reunite_matching_runner_secret';
$job$);
