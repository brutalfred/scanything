CREATE TABLE public.credit_transfers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  recipient_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  recipient_email text NOT NULL,
  amount integer NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT ON public.credit_transfers TO authenticated;
GRANT ALL ON public.credit_transfers TO service_role;

ALTER TABLE public.credit_transfers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own transfers" ON public.credit_transfers
  FOR SELECT TO authenticated
  USING (auth.uid() = sender_id OR auth.uid() = recipient_id);

CREATE OR REPLACE FUNCTION public.transfer_credits_for(_sender_id uuid, _recipient_email text, _amount integer)
RETURNS TABLE(status text, balance integer, recipient_email text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  target_id uuid;
  target_email text;
  sender_balance integer;
  sent_today integer;
  norm_email text;
BEGIN
  IF _sender_id IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF _amount IS NULL OR _amount <= 0 OR _amount > 500 THEN RAISE EXCEPTION 'invalid_amount'; END IF;

  norm_email := lower(btrim(coalesce(_recipient_email, '')));
  IF norm_email = '' OR position('@' in norm_email) = 0 THEN RAISE EXCEPTION 'invalid_email'; END IF;

  SELECT u.id, u.email INTO target_id, target_email
    FROM auth.users u WHERE lower(u.email) = norm_email LIMIT 1;

  IF target_id IS NULL THEN RAISE EXCEPTION 'recipient_not_found'; END IF;
  IF target_id = _sender_id THEN RAISE EXCEPTION 'self_transfer'; END IF;

  SELECT count(*)::integer INTO sent_today FROM public.credit_transfers
   WHERE sender_id = _sender_id AND created_at >= date_trunc('day', now());
  IF sent_today >= 10 THEN RAISE EXCEPTION 'daily_limit'; END IF;

  PERFORM public.ensure_credit_account(_sender_id);
  PERFORM public.ensure_credit_account(target_id);

  SELECT ca.balance INTO sender_balance FROM public.credit_accounts ca
   WHERE ca.user_id = _sender_id FOR UPDATE;
  IF sender_balance IS NULL OR sender_balance < _amount THEN RAISE EXCEPTION 'insufficient_credits'; END IF;

  UPDATE public.credit_accounts ca SET balance = ca.balance - _amount, updated_at = now()
   WHERE ca.user_id = _sender_id RETURNING ca.balance INTO sender_balance;

  INSERT INTO public.credit_ledger (user_id, delta, reason, metadata)
  VALUES (_sender_id, -_amount, 'transfer_sent', jsonb_build_object('to', target_email));

  UPDATE public.credit_accounts ca SET balance = ca.balance + _amount, updated_at = now()
   WHERE ca.user_id = target_id;

  INSERT INTO public.credit_ledger (user_id, delta, reason, metadata)
  VALUES (target_id, _amount, 'transfer_received', jsonb_build_object('from', _sender_id));

  INSERT INTO public.credit_transfers (sender_id, recipient_id, recipient_email, amount)
  VALUES (_sender_id, target_id, target_email, _amount);

  status := 'sent';
  balance := sender_balance;
  recipient_email := target_email;
  RETURN NEXT;
END;
$function$;