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
    _try := upper(regexp_replace(replace(gen_random_uuid()::text, '-', ''), '[^a-zA-Z0-9]', '', 'g'));
    _try := substr(_try, 1, 6);
    begin
      insert into public.referral_codes(user_id, code) values (_user_id, _try);
      return _try;
    exception when unique_violation then
      select code into _code from public.referral_codes where user_id = _user_id;
      if _code is not null then return _code; end if;
    end;
  end loop;

  raise exception 'could_not_generate_code';
end;
$$;