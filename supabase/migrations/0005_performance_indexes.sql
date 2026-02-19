-- Performance indexes for larger datasets
create index if not exists idx_events_connection_start_at on public.calendar_events_cache(connection_id, start_at);
create index if not exists idx_events_connection_start_end on public.calendar_events_cache(connection_id, start_at, end_at);

create index if not exists idx_people_connection_display_name on public.people_cache(connection_id, lower(display_name));
create index if not exists idx_people_connection_mail on public.people_cache(connection_id, lower(coalesce(mail, '')));
create index if not exists idx_people_connection_department on public.people_cache(connection_id, lower(coalesce(department, '')));
create index if not exists idx_people_connection_mobile_phone on public.people_cache(connection_id, mobile_phone);
