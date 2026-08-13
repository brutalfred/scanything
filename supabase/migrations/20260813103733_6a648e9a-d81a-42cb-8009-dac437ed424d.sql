CREATE OR REPLACE FUNCTION public.is_seated_at_poker_table(_table_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.poker_seats s
    WHERE s.table_id = _table_id AND s.user_id = _user_id
  ) OR EXISTS (
    SELECT 1 FROM public.poker_tables t
    WHERE t.id = _table_id AND t.host_id = _user_id
  );
$$;

DROP POLICY IF EXISTS "Signed-in users can view poker seats" ON public.poker_seats;
CREATE POLICY "Players can view seats at their own table"
ON public.poker_seats FOR SELECT TO authenticated
USING (public.is_seated_at_poker_table(table_id, auth.uid()));

DROP POLICY IF EXISTS "Signed-in users can view poker tables" ON public.poker_tables;
CREATE POLICY "Public tables visible, private only to host or players"
ON public.poker_tables FOR SELECT TO authenticated
USING (
  is_private = false
  OR host_id = auth.uid()
  OR public.is_seated_at_poker_table(id, auth.uid())
);