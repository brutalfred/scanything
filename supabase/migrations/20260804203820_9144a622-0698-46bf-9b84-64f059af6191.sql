REVOKE EXECUTE ON FUNCTION public.get_admin_usage_stats() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.record_account_visit(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_admin_usage_stats() TO service_role;
GRANT EXECUTE ON FUNCTION public.record_account_visit(uuid) TO service_role;