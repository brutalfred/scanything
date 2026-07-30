REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM anon;
REVOKE EXECUTE ON FUNCTION public.refund_credits(integer, text) FROM authenticated, anon;
REVOKE EXECUTE ON FUNCTION public.refund_credits_for(uuid, integer, text) FROM authenticated, anon;
REVOKE EXECUTE ON FUNCTION public.ensure_credit_account(uuid) FROM authenticated, anon;