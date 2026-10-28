-- ============================================================
-- Syncora — run the reminder sender every minute
-- NOT a migration: edit the two placeholders, then run once in
-- Supabase → SQL Editor, AFTER the send-reminders function is deployed.
--
-- Needs two extensions (Database → Extensions): pg_cron and pg_net.
-- ============================================================

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Remove an older copy of the job if you're re-running this.
select cron.unschedule(jobid) from cron.job where jobname = 'syncora-send-reminders';

select cron.schedule(
  'syncora-send-reminders',
  '* * * * *',
  $$
  select net.http_post(
    url     := 'https://YOUR-PROJECT-REF.supabase.co/functions/v1/send-reminders',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer YOUR-CRON-SECRET'
    ),
    body    := '{}'::jsonb
  );
  $$
);

-- Check it's running (wait a minute or two):
--   select status, return_message, start_time from cron.job_run_details
--   where jobid = (select jobid from cron.job where jobname = 'syncora-send-reminders')
--   order by start_time desc limit 5;
--
-- See what the function answered:
--   select status_code, content from net._http_response order by created desc limit 5;
