-- ─────────────────────────────────────────────────────────────────────────────
-- WGS phone notifications (run AFTER schema.sql).
-- Template: __WGS_HOOK_SECRET__ is replaced with the real secret in push.local.sql,
-- which is the file you actually run. Never commit the filled-in version.
-- ─────────────────────────────────────────────────────────────────────────────

-- Phones / browsers that asked for order alerts. Only admins can add or see their own.
create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  endpoint text not null unique check (char_length(endpoint) < 1000),
  p256dh text not null check (char_length(p256dh) < 200),
  auth text not null check (char_length(auth) < 100),
  device text not null default '' check (char_length(device) <= 80),
  created_at timestamptz not null default now()
);
alter table public.push_subscriptions enable row level security;
drop policy if exists "admin own push devices" on public.push_subscriptions;
create policy "admin own push devices" on public.push_subscriptions for all to authenticated
  using (public.is_admin() and user_id = auth.uid())
  with check (public.is_admin() and user_id = auth.uid());
grant select, insert, update, delete on public.push_subscriptions to authenticated;

-- Lets the database make web requests.
create extension if not exists pg_net with schema extensions;

-- When a visitor taps "Order on WhatsApp", hand the order and the alert devices to the notify-order function.
create or replace function public.notify_new_order() returns trigger
language plpgsql security definer set search_path = public, extensions as $$
declare subs jsonb;
begin
  if new.source <> 'site' then return new; end if;
  select jsonb_agg(jsonb_build_object('endpoint', endpoint, 'p256dh', p256dh, 'auth', auth))
    into subs from public.push_subscriptions;
  if subs is null then return new; end if;
  perform net.http_post(
    url := 'https://murddncatgcxdyparvmj.supabase.co/functions/v1/notify-order',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-wgs-hook', '__WGS_HOOK_SECRET__'),
    body := jsonb_build_object('record', to_jsonb(new), 'subs', subs)
  );
  return new;
exception when others then
  return new;   -- an alert problem must never block an order from being saved
end $$;
revoke execute on function public.notify_new_order() from public, anon, authenticated;

drop trigger if exists orders_notify on public.orders;
create trigger orders_notify after insert on public.orders
  for each row execute function public.notify_new_order();

-- The function calls this to forget devices that uninstalled or turned alerts off.
create or replace function public.push_forget(p_secret text, p_endpoints text[]) returns int
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if p_secret is distinct from '__WGS_HOOK_SECRET__' then raise exception 'not allowed'; end if;
  delete from public.push_subscriptions where endpoint = any(p_endpoints);
  get diagnostics n = row_count;
  return n;
end $$;
revoke execute on function public.push_forget(text, text[]) from public;
grant execute on function public.push_forget(text, text[]) to anon, authenticated;
