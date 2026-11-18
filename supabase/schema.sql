-- ─────────────────────────────────────────────────────────────────────────────
-- WGS database setup
-- Supabase → SQL Editor → New query → paste this whole file → Run.
-- Run it ONCE on the fresh project. It creates the tables, the security rules,
-- the poster storage, the stats functions, and fills in the starting content.
-- ─────────────────────────────────────────────────────────────────────────────

create extension if not exists pgcrypto;

-- ── Who may use the admin panel ─────────────────────────────────────────────
create table public.admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;

-- ── Content the shop page shows ─────────────────────────────────────────────
create table public.settings (
  key text primary key,
  value text not null default '' check (char_length(value) <= 300),
  updated_at timestamptz not null default now()
);

create table public.categories (
  id text primary key,
  label text not null,
  sort int not null default 0,
  live boolean not null default true,      -- shows as a tab on the shop page
  named boolean not null default false,    -- items have a name (Battle Pass, games) instead of a CP amount
  uid boolean not null default false,      -- buyer must enter their Player UID
  hint text not null default ''
);

create table public.packages (
  id uuid primary key default gen_random_uuid(),
  category text not null references public.categories(id) on update cascade on delete cascade,
  name text not null default '',
  note text not null default '',
  cp int not null default 0 check (cp >= 0),
  bonus int not null default 0 check (bonus >= 0),
  kes int not null default 0 check (kes >= 0),
  tzs int not null default 0 check (tzs >= 0),
  usd text not null default '',
  tag text not null default '',
  show boolean not null default true,
  sort int not null default 0,
  updated_at timestamptz not null default now()
);

create table public.offers (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) <= 80),
  detail text not null default '' check (char_length(detail) <= 200),
  ends_at timestamptz,
  show boolean not null default true,
  updated_at timestamptz not null default now()
);

create table public.posts (
  id uuid primary key default gen_random_uuid(),
  kind text not null default 'update' check (kind in ('update', 'drop')),
  title text not null check (char_length(title) between 1 and 80),
  message text not null default '' check (char_length(message) <= 600),
  date date not null default current_date,
  pinned boolean not null default false,
  image_url text not null default '',
  edited boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ── Things visitors send in ─────────────────────────────────────────────────
create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 40),
  country text not null default 'KE' check (country in ('KE', 'TZ', 'UG', 'Other')),
  stars int not null default 5 check (stars between 1 and 5),
  message text not null check (char_length(message) between 3 and 400),
  status text not null default 'pending' check (status in ('pending', 'live')),
  created_at timestamptz not null default now()
);

-- One row per tap on "Order on WhatsApp". No passwords or game logins, ever.
create table public.orders (
  id uuid primary key default gen_random_uuid(),
  code text not null check (char_length(code) <= 20),
  item text not null check (char_length(item) <= 80),
  category text not null default '' check (char_length(category) <= 30),
  amount int not null default 0 check (amount >= 0 and amount < 100000000),
  currency text not null default 'KES' check (currency in ('KES', 'TZS')),
  pay text not null default '' check (char_length(pay) <= 30),
  country text not null default 'KE' check (country in ('KE', 'TZ', 'Other')),
  uid text not null default '' check (char_length(uid) <= 30),
  name text not null default '' check (char_length(name) <= 40),
  status text not null default 'new' check (status in ('new', 'done', 'nosale')),
  source text not null default 'site' check (source in ('site', 'manual')),
  auto_closed boolean not null default false,
  created_at timestamptz not null default now(),
  closed_at timestamptz
);
create index orders_created_idx on public.orders (created_at desc);

-- Anonymous page stats: a random visitor id per browser, no names or IPs.
create table public.events (
  id bigint generated always as identity primary key,
  type text not null check (type in ('view', 'tap', 'notify')),
  ref text not null default '' check (char_length(ref) <= 80),
  country text not null default '' check (char_length(country) <= 10),
  source text not null default '' check (char_length(source) <= 30),
  visitor text not null default '' check (char_length(visitor) <= 40),
  created_at timestamptz not null default now()
);
create index events_created_idx on public.events (created_at desc);

-- ── Security rules (row level security) ─────────────────────────────────────
alter table public.admins     enable row level security;
alter table public.settings   enable row level security;
alter table public.categories enable row level security;
alter table public.packages   enable row level security;
alter table public.offers     enable row level security;
alter table public.posts      enable row level security;
alter table public.reviews    enable row level security;
alter table public.orders     enable row level security;
alter table public.events     enable row level security;

create policy "admins see own row" on public.admins for select to authenticated using (user_id = auth.uid());

-- Anyone may read what the shop page shows
create policy "read settings"   on public.settings   for select using (true);
create policy "read categories" on public.categories for select using (true);
create policy "read packages"   on public.packages   for select using (show or public.is_admin());
create policy "read offers"     on public.offers     for select using (show or public.is_admin());
create policy "read posts"      on public.posts      for select using (true);
create policy "read reviews"    on public.reviews    for select using (status = 'live' or public.is_admin());

-- Visitors may only ADD these (never read, change or delete)
create policy "send order tap" on public.orders  for insert to anon, authenticated
  with check (status = 'new' and source = 'site' and closed_at is null and auto_closed = false);
create policy "send review"    on public.reviews for insert to anon, authenticated
  with check (status = 'pending');
create policy "send event"     on public.events  for insert to anon, authenticated
  with check (true);

-- Admins may do everything
create policy "admin settings"   on public.settings   for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admin categories" on public.categories for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admin packages"   on public.packages   for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admin offers"     on public.offers     for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admin posts"      on public.posts      for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admin reviews"    on public.reviews    for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admin orders"     on public.orders     for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admin events"     on public.events     for select to authenticated using (public.is_admin());

grant usage on schema public to anon, authenticated;
grant select on public.settings, public.categories, public.packages, public.offers, public.posts, public.reviews to anon, authenticated;
grant insert on public.orders, public.reviews, public.events to anon, authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant execute on function public.is_admin() to anon, authenticated;

-- New orders appear in the admin panel instantly
alter publication supabase_realtime add table public.orders;

-- ── Poster images ───────────────────────────────────────────────────────────
insert into storage.buckets (id, name, public) values ('posters', 'posters', true)
  on conflict (id) do nothing;
create policy "admin upload posters" on storage.objects for insert to authenticated
  with check (bucket_id = 'posters' and public.is_admin());
create policy "admin update posters" on storage.objects for update to authenticated
  using (bucket_id = 'posters' and public.is_admin());
create policy "admin delete posters" on storage.objects for delete to authenticated
  using (bucket_id = 'posters' and public.is_admin());

-- ── Stats for the admin overview (admins only) ──────────────────────────────
-- Visitors and page views per day, in Kenya/Tanzania time.
create or replace function public.admin_visits(n_days int default 14)
returns table (day date, visitors bigint, views bigint)
language plpgsql stable security definer set search_path = public as $$
#variable_conflict use_column
begin
  if not public.is_admin() then raise exception 'not allowed'; end if;
  return query
    with d as (
      select generate_series((now() at time zone 'Africa/Nairobi')::date - (n_days - 1),
                             (now() at time zone 'Africa/Nairobi')::date, interval '1 day')::date as day
    ), e as (
      select (created_at at time zone 'Africa/Nairobi')::date as day,
             count(distinct visitor) as visitors, count(*) as views
      from public.events
      where type = 'view' and created_at > now() - make_interval(days => n_days + 1)
      group by 1
    )
    select d.day, coalesce(e.visitors, 0)::bigint, coalesce(e.views, 0)::bigint
    from d left join e on e.day = d.day order by d.day;
end $$;

-- Where visitors come from, which country, and the games waitlist.
create or replace function public.admin_breakdown(n_days int default 7)
returns table (kind text, label text, n bigint)
language plpgsql stable security definer set search_path = public as $$
#variable_conflict use_column
begin
  if not public.is_admin() then raise exception 'not allowed'; end if;
  return query
    select 'source'::text, coalesce(nullif(e.source, ''), 'direct'), count(distinct e.visitor)
      from public.events e where e.type = 'view' and e.created_at > now() - make_interval(days => n_days) group by 2
    union all
    select 'country'::text, coalesce(nullif(e.country, ''), 'Other'), count(distinct e.visitor)
      from public.events e where e.type = 'view' and e.created_at > now() - make_interval(days => n_days) group by 2
    union all
    select 'waitlist'::text, e.ref, count(distinct e.visitor)
      from public.events e where e.type = 'notify' group by 2;
end $$;

revoke execute on function public.admin_visits(int), public.admin_breakdown(int) from anon, public;
grant execute on function public.admin_visits(int), public.admin_breakdown(int) to authenticated;

-- ── Starting content (edit everything later from the admin panel) ───────────
insert into public.settings (key, value) values
  ('whatsapp', '254748365147'),
  ('catalogue', 'https://wa.me/c/254748365147'),
  ('youtube', ''),
  ('tiktok', ''),
  ('buyers', '700+'),
  ('group_members', '644'),
  ('delivery', '10–30 min'),
  ('rate', '20');

insert into public.categories (id, label, sort, live, named, uid, hint) values
  ('double',     'Double CP 🔥',        1, true,  false, false, ''),
  ('regular',    'Regular CP',          2, true,  false, false, ''),
  ('battlepass', 'Battle Pass',         3, true,  true,  true,  'Delivered with the buyer''s Player UID only. The shop page asks for it.'),
  ('games',      'Console & PC games',  4, false, true,  false, 'Coming soon. Add games now and switch this on when you launch.');

insert into public.packages (category, name, note, cp, bonus, kes, tzs, usd, tag, sort) values
  ('double', '', '', 800, 800, 1350, 27000, '10', '', 1),
  ('double', '', '', 2000, 2000, 3500, 70000, '27', '', 2),
  ('double', '', '', 4000, 4000, 6500, 130000, '50', 'Most popular', 3),
  ('double', '', '', 8000, 8000, 12000, 240000, '92', 'Best value', 4),
  ('regular', '', '', 80, 0, 200, 4000, '1.5', '', 1),
  ('regular', '', '', 400, 0, 750, 15000, '6', '', 2),
  ('regular', '', '', 800, 0, 1350, 27000, '10', '', 3),
  ('regular', '', '', 2000, 0, 3500, 70000, '27', 'Popular', 4),
  ('regular', '', '', 4000, 0, 6500, 130000, '50', '', 5),
  ('regular', '', '', 8000, 0, 12000, 240000, '92', '', 6),
  ('battlepass', 'Battle Pass', 'This season''s premium pass', 0, 0, 750, 15000, '6', '', 1),
  ('battlepass', 'Battle Pass Bundle', 'Premium pass + tier skips', 0, 0, 1950, 39000, '15', 'Best value', 2);

insert into public.offers (title, detail, ends_at, show) values
  ('Double CP is live', 'Every package comes with 100% bonus CP. Event ends 20 December.', '2026-12-20 23:59:00+03', true);

insert into public.posts (kind, title, message, date, pinned) values
  ('update', 'Double CP season is back', 'All four packages are doubled until 20 Dec. Orders are open now. Message us on WhatsApp to book your slot.', '2026-11-17', true),
  ('update', 'Before you order', 'Unlink any accounts you don''t use and have your verification method ready. We''ll walk you through everything in the chat.', '2026-11-12', false),
  ('drop',   'Mythic Alias', 'New mythic operator drop. Stock up on CP before it lands.', '2026-11-19', false);

-- ─────────────────────────────────────────────────────────────────────────────
-- AFTER running this:
-- 1. Authentication → Users → Add user → create the admin login (tick "Auto Confirm").
-- 2. Run this line with that email to make it an admin:
--      insert into public.admins (user_id) select id from auth.users where email = 'PUT-EMAIL-HERE';
-- 3. Authentication → Sign In / Providers → turn OFF "Allow new users to sign up".
-- ─────────────────────────────────────────────────────────────────────────────
