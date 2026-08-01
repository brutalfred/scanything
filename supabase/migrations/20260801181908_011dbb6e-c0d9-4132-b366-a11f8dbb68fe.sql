REVOKE EXECUTE ON FUNCTION public.has_active_subscription(uuid, text) FROM anon, authenticated, PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_active_subscription(uuid, text) TO service_role;