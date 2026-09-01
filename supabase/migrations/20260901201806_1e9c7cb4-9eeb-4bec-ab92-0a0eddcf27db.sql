REVOKE EXECUTE ON FUNCTION public.redeem_pi_payment(text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.redeem_pi_payment(text, text) TO service_role;