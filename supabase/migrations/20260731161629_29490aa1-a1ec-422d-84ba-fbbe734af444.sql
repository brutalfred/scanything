CREATE TABLE public.game_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text NOT NULL,
  time_ms integer NOT NULL,
  month_key text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, month_key)
);

GRANT SELECT ON public.game_scores TO authenticated;
GRANT ALL ON public.game_scores TO service_role;
ALTER TABLE public.game_scores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own game scores" ON public.game_scores
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE INDEX game_scores_month_time_idx ON public.game_scores (month_key, time_ms);
CREATE INDEX game_scores_time_idx ON public.game_scores (time_ms);

CREATE TRIGGER update_game_scores_updated_at
  BEFORE UPDATE ON public.game_scores
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.game_prize_payouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  month_key text NOT NULL,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  place integer NOT NULL,
  credits integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (month_key, place)
);

GRANT SELECT ON public.game_prize_payouts TO authenticated;
GRANT ALL ON public.game_prize_payouts TO service_role;
ALTER TABLE public.game_prize_payouts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own game prizes" ON public.game_prize_payouts
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.submit_game_score(_user_id uuid, _time_ms integer, _display_name text)
RETURNS TABLE(status text, best_month_ms integer, best_alltime_ms integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  mk text := to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM');
  name text;
  existing integer;
BEGIN
  IF _user_id IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF _time_ms IS NULL OR _time_ms < 9000 OR _time_ms > 600000 THEN
    RAISE EXCEPTION 'invalid_time';
  END IF;

  name := nullif(btrim(coalesce(_display_name, '')), '');
  IF name IS NULL THEN name := 'Runner'; END IF;
  name := left(name, 20);

  SELECT gs.time_ms INTO existing FROM public.game_scores gs
   WHERE gs.user_id = _user_id AND gs.month_key = mk FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO public.game_scores (user_id, display_name, time_ms, month_key)
    VALUES (_user_id, name, _time_ms, mk);
    status := 'recorded';
  ELSIF _time_ms < existing THEN
    UPDATE public.game_scores gs
       SET time_ms = _time_ms, display_name = name
     WHERE gs.user_id = _user_id AND gs.month_key = mk;
    status := 'improved';
  ELSE
    UPDATE public.game_scores gs SET display_name = name
     WHERE gs.user_id = _user_id AND gs.month_key = mk;
    status := 'no_improvement';
  END IF;

  SELECT gs.time_ms INTO best_month_ms FROM public.game_scores gs
   WHERE gs.user_id = _user_id AND gs.month_key = mk;
  SELECT min(gs.time_ms) INTO best_alltime_ms FROM public.game_scores gs
   WHERE gs.user_id = _user_id;

  RETURN NEXT;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_game_leaderboard(_scope text, _limit integer, _user_id uuid DEFAULT NULL)
RETURNS TABLE(rank integer, display_name text, time_ms integer, is_me boolean)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  WITH base AS (
    SELECT DISTINCT ON (gs.user_id) gs.user_id, gs.display_name, gs.time_ms
      FROM public.game_scores gs
     WHERE (_scope <> 'month' OR gs.month_key = to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM'))
     ORDER BY gs.user_id, gs.time_ms ASC
  ), ranked AS (
    SELECT row_number() OVER (ORDER BY b.time_ms ASC)::integer AS rank,
           b.display_name, b.time_ms, (b.user_id = _user_id) AS is_me
      FROM base b
  )
  SELECT r.rank, r.display_name, r.time_ms, r.is_me
    FROM ranked r
   WHERE r.rank <= least(greatest(coalesce(_limit, 10), 1), 50) OR r.is_me
   ORDER BY r.rank ASC;
$$;

REVOKE EXECUTE ON FUNCTION public.submit_game_score(uuid, integer, text) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_game_leaderboard(text, integer, uuid) FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.award_monthly_game_prizes()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  prev text := to_char((now() AT TIME ZONE 'UTC') - interval '1 month', 'YYYY-MM');
  rec record;
  place integer := 0;
  prize integer;
  awarded integer := 0;
BEGIN
  FOR rec IN
    SELECT gs.user_id, gs.time_ms FROM public.game_scores gs
     WHERE gs.month_key = prev ORDER BY gs.time_ms ASC LIMIT 3
  LOOP
    place := place + 1;
    prize := CASE place WHEN 1 THEN 100 WHEN 2 THEN 50 ELSE 10 END;
    BEGIN
      INSERT INTO public.game_prize_payouts (month_key, user_id, place, credits)
      VALUES (prev, rec.user_id, place, prize);
    EXCEPTION WHEN unique_violation THEN
      CONTINUE;
    END;
    PERFORM public.grant_credits(rec.user_id, prize, 'game_prize:' || place);
    awarded := awarded + 1;
  END LOOP;
  RETURN awarded;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.award_monthly_game_prizes() FROM anon, authenticated;

CREATE EXTENSION IF NOT EXISTS pg_cron;

SELECT cron.schedule(
  'award-monthly-game-prizes',
  '5 0 1 * *',
  $$ SELECT public.award_monthly_game_prizes(); $$
);