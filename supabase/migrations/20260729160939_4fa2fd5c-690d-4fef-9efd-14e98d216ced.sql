REVOKE EXECUTE ON FUNCTION public.get_credit_state() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.spend_credits(integer, text, jsonb) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.refund_credits(integer, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_credit_state() TO authenticated;
GRANT EXECUTE ON FUNCTION public.spend_credits(integer, text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.refund_credits(integer, text) TO authenticated;