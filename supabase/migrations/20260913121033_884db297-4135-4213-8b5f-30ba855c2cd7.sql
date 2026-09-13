CREATE POLICY "No client writes to credit accounts" ON public.credit_accounts FOR INSERT TO authenticated WITH CHECK (false);
CREATE POLICY "No client updates to credit accounts" ON public.credit_accounts FOR UPDATE TO authenticated USING (false) WITH CHECK (false);
CREATE POLICY "No client deletes from credit accounts" ON public.credit_accounts FOR DELETE TO authenticated USING (false);

CREATE POLICY "No client writes to game scores" ON public.game_scores FOR INSERT TO authenticated WITH CHECK (false);
CREATE POLICY "No client updates to game scores" ON public.game_scores FOR UPDATE TO authenticated USING (false) WITH CHECK (false);
CREATE POLICY "No client deletes from game scores" ON public.game_scores FOR DELETE TO authenticated USING (false);