-- Owner-only function should not be callable from the app as a regular user.
REVOKE EXECUTE ON FUNCTION public.get_scan_economics(integer) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_scan_economics(integer) TO service_role;