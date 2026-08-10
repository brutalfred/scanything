REVOKE SELECT ON public.credit_transfers FROM authenticated;
GRANT SELECT (id, sender_id, recipient_id, amount, created_at) ON public.credit_transfers TO authenticated;
GRANT ALL ON public.credit_transfers TO service_role;