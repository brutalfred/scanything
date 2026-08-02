REVOKE EXECUTE ON FUNCTION public.claim_free_scan_for(uuid) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.release_free_scan_for(uuid) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.get_credit_state_for(uuid) FROM anon, authenticated, public;
GRANT EXECUTE ON FUNCTION public.claim_free_scan_for(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.release_free_scan_for(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_credit_state_for(uuid) TO service_role;