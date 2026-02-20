-- Additional indexes for people search at scale
create index if not exists idx_people_job_title_trgm on public.people_cache using gin (lower(coalesce(job_title, '')) gin_trgm_ops);
create index if not exists idx_people_office_location_trgm on public.people_cache using gin (lower(coalesce(office_location, '')) gin_trgm_ops);

-- Support common guest-filter path with connection scoped scans
create index if not exists idx_people_connection_user_type on public.people_cache(connection_id, lower(coalesce(user_type, '')));
create index if not exists idx_people_connection_upn on public.people_cache(connection_id, lower(coalesce(user_principal_name, '')));
