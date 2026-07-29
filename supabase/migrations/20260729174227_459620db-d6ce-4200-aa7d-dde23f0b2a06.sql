REVOKE EXECUTE ON FUNCTION public.start_ad_session() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.claim_ad_reward(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.get_ad_reward_status() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.get_credit_state() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.spend_credits(integer, text, jsonb) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.refund_credits(integer, text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.ensure_credit_account(uuid) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.grant_credits(uuid, integer, text) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.refund_credits_for(uuid, integer, text) FROM anon, authenticated, public;

GRANT EXECUTE ON FUNCTION public.start_ad_session() TO authenticated;
GRANT EXECUTE ON FUNCTION public.claim_ad_reward(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_ad_reward_status() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_credit_state() TO authenticated;
GRANT EXECUTE ON FUNCTION public.spend_credits(integer, text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.refund_credits(integer, text) TO authenticated;

GRANT EXECUTE ON FUNCTION public.ensure_credit_account(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.grant_credits(uuid, integer, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.refund_credits_for(uuid, integer, text) TO service_role;