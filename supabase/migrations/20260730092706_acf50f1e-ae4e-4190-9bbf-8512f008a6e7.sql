CREATE OR REPLACE FUNCTION public.claim_daily_checkin_for(_user_id uuid)
 RETURNS TABLE(status text, current_streak integer, rewarded integer, balance integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  reward_credits constant integer := 10;
  row public.checkin_streaks;
  next_streak integer;
  granted integer := 0;
  new_balance integer;
BEGIN
  IF _user_id IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;

  PERFORM public.ensure_credit_account(_user_id);

  SELECT * INTO row FROM public.checkin_streaks WHERE user_id = _user_id FOR UPDATE;
  IF NOT FOUND THEN
    INSERT INTO public.checkin_streaks (user_id) VALUES (_user_id) RETURNING * INTO row;
  END IF;

  IF row.last_checkin_date = current_date THEN
    SELECT ca.balance INTO new_balance FROM public.credit_accounts ca WHERE ca.user_id = _user_id;
    status := 'already_checked_in';
    current_streak := row.current_streak;
    rewarded := 0;
    balance := coalesce(new_balance, 0);
    RETURN NEXT;
    RETURN;
  END IF;

  IF row.last_checkin_date = current_date - 1 THEN
    next_streak := row.current_streak + 1;
  ELSE
    next_streak := 1;
  END IF;

  IF next_streak >= 7 THEN
    granted := reward_credits;
    next_streak := 0;
  END IF;

  UPDATE public.checkin_streaks cs
  SET current_streak = next_streak,
      longest_streak = greatest(cs.longest_streak, CASE WHEN granted > 0 THEN 7 ELSE next_streak END),
      last_checkin_date = current_date,
      total_rewards = cs.total_rewards + granted,
      updated_at = now()
  WHERE cs.user_id = _user_id;

  IF granted > 0 THEN
    new_balance := public.grant_credits(_user_id, granted, 'daily_checkin_reward');
  ELSE
    SELECT ca.balance INTO new_balance FROM public.credit_accounts ca WHERE ca.user_id = _user_id;
  END IF;

  status := CASE WHEN granted > 0 THEN 'rewarded' ELSE 'checked_in' END;
  current_streak := CASE WHEN granted > 0 THEN 7 ELSE next_streak END;
  rewarded := granted;
  balance := coalesce(new_balance, 0);
  RETURN NEXT;
END;
$function$;