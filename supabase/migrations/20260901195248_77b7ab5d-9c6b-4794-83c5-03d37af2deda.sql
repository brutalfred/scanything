CREATE TABLE IF NOT EXISTS public.pi_identities (
  pi_uid text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  pi_username text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS pi_identities_user_id_key ON public.pi_identities (user_id);

GRANT SELECT ON public.pi_identities TO authenticated;
GRANT ALL ON public.pi_identities TO service_role;

ALTER TABLE public.pi_identities ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read their own Pi identity" ON public.pi_identities;
CREATE POLICY "Users can read their own Pi identity"
  ON public.pi_identities
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);