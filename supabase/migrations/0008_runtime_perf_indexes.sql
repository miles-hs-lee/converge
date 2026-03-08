-- Runtime query-path indexes for calendar/people page responsiveness
create index if not exists idx_connections_user_created_at
  on public.m365_connections(user_id, created_at);

create index if not exists idx_calendar_sources_connection_selected
  on public.calendar_sources(connection_id, is_selected);

create index if not exists idx_events_source_start_at
  on public.calendar_events_cache(calendar_source_id, start_at);

create index if not exists idx_events_connection_source_start_at
  on public.calendar_events_cache(connection_id, calendar_source_id, start_at);
