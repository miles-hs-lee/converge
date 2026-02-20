create index if not exists idx_alert_dedup_user_last_sent_at
  on public.alert_dedup(user_id, last_sent_at desc);
