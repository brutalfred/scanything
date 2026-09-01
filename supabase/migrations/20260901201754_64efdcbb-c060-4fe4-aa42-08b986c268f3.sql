CREATE TABLE public.pi_payments (
  payment_id text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  pack_id text NOT NULL,
  credits integer NOT NULL,
  amount_pi numeric NOT NULL,
  txid text,
  status text NOT NULL DEFAULT 'created',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT ON public.pi_payments TO authenticated;
GRANT ALL ON public.pi_payments TO service_role;

ALTER TABLE public.pi_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own pi payments"
  ON public.pi_payments FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE TRIGGER update_pi_payments_updated_at
  BEFORE UPDATE ON public.pi_payments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.pi_rate (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  usd_per_pi numeric NOT NULL,
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT ON public.pi_rate TO anon, authenticated;
GRANT ALL ON public.pi_rate TO service_role;

ALTER TABLE public.pi_rate ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read the pi rate"
  ON public.pi_rate FOR SELECT TO anon, authenticated
  USING (true);

INSERT INTO public.pi_rate (id, usd_per_pi) VALUES (true, 0.35);

CREATE OR REPLACE FUNCTION public.redeem_pi_payment(_payment_id text, _txid text)
RETURNS TABLE(status text, credits integer, balance integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  row public.pi_payments;
  new_balance integer;
BEGIN
  SELECT * INTO row FROM public.pi_payments WHERE payment_id = _payment_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'unknown_payment';
  END IF;

  IF row.status = 'completed' THEN
    SELECT ca.balance INTO new_balance FROM public.credit_accounts ca WHERE ca.user_id = row.user_id;
    status := 'already_completed';
    credits := row.credits;
    balance := coalesce(new_balance, 0);
    RETURN NEXT;
    RETURN;
  END IF;

  UPDATE public.pi_payments
     SET status = 'completed', txid = coalesce(_txid, txid)
   WHERE payment_id = _payment_id;

  new_balance := public.grant_credits(row.user_id, row.credits, 'pi_purchase:' || row.pack_id);

  status := 'granted';
  credits := row.credits;
  balance := new_balance;
  RETURN NEXT;
END;
$$;