
create table if not exists public.referral_codes (
  user_id uuid primary key references auth.users(id) on delete cascade,
  code text not null unique,
  created_at timestamptz not null default now()
);

grant select on public.referral_codes to authenticated;
grant all on public.referral_codes to service_role;
alter table public.referral_codes enable row level security;

create policy "own referral code" on public.referral_codes
  for select to authenticated using (user_id = auth.uid());

create table if not exists public.referrals (
  id uuid primary key default gen_random_uuid(),
  referrer_id uuid not null references auth.users(id) on delete cascade,
  referred_id uuid not null unique references auth.users(id) on delete cascade,
  code text not null,
  reward integer not null default 50,
  created_at timestamptz not null default now()
);

create index if not exists referrals_referrer_idx on public.referrals(referrer_id);
grant select on public.referrals to authenticated;
grant all on public.referrals to service_role;
alter table public.referrals enable row level security;

create policy "own referrals" on public.referrals
  for select to authenticated
  using (referrer_id = auth.uid() or referred_id = auth.uid());

create or replace function public.get_referral_code_for(_user_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  _code text;
  _try text;
begin
  select code into _code from public.referral_codes where user_id = _user_id;
  if _code is not null then
    return _code;
  end if;

  for i in 1..12 loop
    _try := upper(substr(replace(encode(gen_random_bytes(8), 'base64'), '/', ''), 1, 7));
    _try := regexp_replace(_try, '[^A-Z0-9]', '', 'g');
    if length(_try) >= 6 then
      _try := substr(_try, 1, 6);
      begin
        insert into public.referral_codes(user_id, code) values (_user_id, _try);
        return _try;
      exception when unique_violation then
        select code into _code from public.referral_codes where user_id = _user_id;
        if _code is not null then return _code; end if;
      end;
    end if;
  end loop;

  raise exception 'could_not_generate_code';
end;
$$;

create or replace function public.redeem_referral_code_for(_user_id uuid, _code text)
returns table(status text, reward integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  _referrer uuid;
  _clean text := upper(trim(_code));
begin
  if exists (select 1 from public.referrals where referred_id = _user_id) then
    return query select 'already_redeemed'::text, 0;
    return;
  end if;

  select user_id into _referrer from public.referral_codes where code = _clean;

  if _referrer is null then
    return query select 'invalid_code'::text, 0;
    return;
  end if;

  if _referrer = _user_id then
    return query select 'self_referral'::text, 0;
    return;
  end if;

  insert into public.referrals(referrer_id, referred_id, code, reward)
  values (_referrer, _user_id, _clean, 50);

  perform public.grant_credits(_referrer, 50, 'referral_bonus');
  perform public.grant_credits(_user_id, 50, 'referral_bonus');

  return query select 'redeemed'::text, 50;
end;
$$;

create or replace function public.get_referral_stats_for(_user_id uuid)
returns table(code text, invited integer, credits_earned integer, redeemed boolean)
language sql
security definer
set search_path = public
as $$
  select
    public.get_referral_code_for(_user_id),
    (select count(*)::int from public.referrals where referrer_id = _user_id),
    (select coalesce(sum(reward), 0)::int from public.referrals where referrer_id = _user_id),
    exists (select 1 from public.referrals where referred_id = _user_id);
$$;
