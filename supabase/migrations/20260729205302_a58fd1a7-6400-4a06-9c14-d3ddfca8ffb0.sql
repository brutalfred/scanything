-- Revoke default PUBLIC/anon execute on all SECURITY DEFINER functions.
-- Then grant execute only to the roles that actually need each function.

-- Owner-only: called via service_role only.
REVOKE EXECUTE ON FUNCTION public.get_scan_economics(integer) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_scan_economics(integer) TO service_role;

-- Signed-in user functions: called from the app via the user's bearer token.
REVOKE EXECUTE ON FUNCTION public.get_credit_state() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_credit_state() TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.spend_credits(integer, text, jsonb) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.spend_credits(integer, text, jsonb) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.refund_credits(integer, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.refund_credits(integer, text) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.refund_credits_for(uuid, integer, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.refund_credits_for(uuid, integer, text) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.claim_signup_grant(text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.claim_signup_grant(text) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.ensure_credit_account(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.ensure_credit_account(uuid) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.grant_credits(uuid, integer, text) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.grant_credits(uuid, integer, text) TO service_role;