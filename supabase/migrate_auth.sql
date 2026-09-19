-- Run in the Supabase SQL editor after schema.sql.
-- Dashboard ที่ต้องเปิด (ยังไม่ยืนยันอีเมล):
-- 1. Authentication → Providers → Email = Enabled
-- 2. Authentication → Providers → Email → Confirm email = OFF
-- 3. Authentication → URL Configuration
--    Site URL = http://localhost:8080
--    Redirect URLs = http://localhost:8080/** , http://localhost/**
-- 4. ตั้งคนแรกเป็นแอดมิน:
--    update public.profiles set role = 'admin' where email = 'you@example.com';
-- เฟสถัดไป: เปิด Confirm email แล้วใส่เทมเพลตเมล โค้ด backend พร้อมอ่าน email_confirmed_at

create table if not exists profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  role text not null default 'general' check (role in ('general', 'admin')),
  created_at timestamptz not null default now()
);

create index if not exists profiles_role_idx on profiles (role);

alter table profiles enable row level security;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, role)
  values (new.id, coalesce(new.email, ''), 'general')
  on conflict (id) do update
    set email = excluded.email;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
