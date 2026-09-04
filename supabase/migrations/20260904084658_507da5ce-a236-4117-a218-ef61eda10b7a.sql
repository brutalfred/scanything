CREATE OR REPLACE FUNCTION public.redeem_referral_code_for(_user_id uuid, _code text)
RETURNS TABLE(status text, reward integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
  values (_referrer, _user_id, _clean, 20);

  perform public.grant_credits(_referrer, 20, 'referral_bonus');
  perform public.grant_credits(_user_id, 20, 'referral_bonus');

  return query select 'redeemed'::text, 20;
end;
$function$;

CREATE OR REPLACE FUNCTION public.claim_ad_reward_for(_user_id uuid)
RETURNS TABLE(status text, balance integer, claims_today integer, daily_limit integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  reward constant integer := 5;
  max_per_day constant integer := 5;
  used integer;
  new_balance integer;
BEGIN
  IF _user_id IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;

  PERFORM public.ensure_credit_account(_user_id);

  SELECT count(*)::integer INTO used
  FROM public.ad_reward_claims
  WHERE user_id = _user_id AND created_at >= date_trunc('day', now());

  IF used >= max_per_day THEN
    SELECT ca.balance INTO new_balance FROM public.credit_accounts ca WHERE ca.user_id = _user_id;
    status := 'limit_reached';
    balance := coalesce(new_balance, 0);
    claims_today := used;
    daily_limit := max_per_day;
    RETURN NEXT;
    RETURN;
  END IF;

  INSERT INTO public.ad_reward_claims (user_id, credits) VALUES (_user_id, reward);
  new_balance := public.grant_credits(_user_id, reward, 'ad_reward');

  status := 'granted';
  balance := new_balance;
  claims_today := used + 1;
  daily_limit := max_per_day;
  RETURN NEXT;
END;
$function$;