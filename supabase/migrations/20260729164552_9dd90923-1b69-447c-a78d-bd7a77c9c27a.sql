REVOKE ALL ON FUNCTION public.ensure_credit_account(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ensure_credit_account(uuid) TO service_role;

REVOKE ALL ON FUNCTION public.spend_credits(integer, text, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.spend_credits(integer, text, jsonb) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.refund_credits(integer, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.refund_credits(integer, text) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.get_credit_state() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_credit_state() TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.claim_ad_reward() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_ad_reward() TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.get_ad_reward_status() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_ad_reward_status() TO authenticated, service_role;