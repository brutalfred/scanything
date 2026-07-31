REVOKE ALL ON FUNCTION public.submit_game_score(uuid, integer, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_game_leaderboard(text, integer, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.award_monthly_game_prizes() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_game_score(uuid, integer, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_game_leaderboard(text, integer, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.award_monthly_game_prizes() TO service_role;