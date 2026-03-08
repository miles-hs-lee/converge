alter table public.app_users
  add column if not exists last_login_at timestamptz,
  add column if not exists prev_login_at timestamptz;

update public.app_users as au
set
  last_login_at = coalesce(au.last_login_at, auth_u.last_sign_in_at),
  updated_at = case
    when au.last_login_at is null and auth_u.last_sign_in_at is not null
      then greatest(au.updated_at, auth_u.last_sign_in_at)
    else au.updated_at
  end
from auth.users as auth_u
where auth_u.id = au.id
  and au.last_login_at is null
  and auth_u.last_sign_in_at is not null;
