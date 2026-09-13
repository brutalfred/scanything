CREATE POLICY "No client writes to account visits" ON public.account_visits FOR INSERT TO authenticated WITH CHECK (false);
CREATE POLICY "No client updates to account visits" ON public.account_visits FOR UPDATE TO authenticated USING (false) WITH CHECK (false);
CREATE POLICY "No client deletes from account visits" ON public.account_visits FOR DELETE TO authenticated USING (false);

CREATE POLICY "No client writes to ad reward claims" ON public.ad_reward_claims FOR INSERT TO authenticated WITH CHECK (false);
CREATE POLICY "No client updates to ad reward claims" ON public.ad_reward_claims FOR UPDATE TO authenticated USING (false) WITH CHECK (false);
CREATE POLICY "No client deletes from ad reward claims" ON public.ad_reward_claims FOR DELETE TO authenticated USING (false);

CREATE POLICY "No client writes to checkin streaks" ON public.checkin_streaks FOR INSERT TO authenticated WITH CHECK (false);
CREATE POLICY "No client updates to checkin streaks" ON public.checkin_streaks FOR UPDATE TO authenticated USING (false) WITH CHECK (false);
CREATE POLICY "No client deletes from checkin streaks" ON public.checkin_streaks FOR DELETE TO authenticated USING (false);

CREATE POLICY "No client writes to daily free scans" ON public.daily_free_scans FOR INSERT TO authenticated WITH CHECK (false);
CREATE POLICY "No client updates to daily free scans" ON public.daily_free_scans FOR UPDATE TO authenticated USING (false) WITH CHECK (false);
CREATE POLICY "No client deletes from daily free scans" ON public.daily_free_scans FOR DELETE TO authenticated USING (false);

CREATE POLICY "No client writes to game prize payouts" ON public.game_prize_payouts FOR INSERT TO authenticated WITH CHECK (false);
CREATE POLICY "No client updates to game prize payouts" ON public.game_prize_payouts FOR UPDATE TO authenticated USING (false) WITH CHECK (false);
CREATE POLICY "No client deletes from game prize payouts" ON public.game_prize_payouts FOR DELETE TO authenticated USING (false);

CREATE POLICY "No client writes to pi identities" ON public.pi_identities FOR INSERT TO authenticated WITH CHECK (false);
CREATE POLICY "No client updates to pi identities" ON public.pi_identities FOR UPDATE TO authenticated USING (false) WITH CHECK (false);
CREATE POLICY "No client deletes from pi identities" ON public.pi_identities FOR DELETE TO authenticated USING (false);

CREATE POLICY "No client writes to play purchases" ON public.play_purchases FOR INSERT TO authenticated WITH CHECK (false);
CREATE POLICY "No client updates to play purchases" ON public.play_purchases FOR UPDATE TO authenticated USING (false) WITH CHECK (false);
CREATE POLICY "No client deletes from play purchases" ON public.play_purchases FOR DELETE TO authenticated USING (false);

CREATE POLICY "No client writes to play subscriptions" ON public.play_subscriptions FOR INSERT TO authenticated WITH CHECK (false);
CREATE POLICY "No client updates to play subscriptions" ON public.play_subscriptions FOR UPDATE TO authenticated USING (false) WITH CHECK (false);
CREATE POLICY "No client deletes from play subscriptions" ON public.play_subscriptions FOR DELETE TO authenticated USING (false);

CREATE POLICY "No client writes to referral codes" ON public.referral_codes FOR INSERT TO authenticated WITH CHECK (false);
CREATE POLICY "No client updates to referral codes" ON public.referral_codes FOR UPDATE TO authenticated USING (false) WITH CHECK (false);
CREATE POLICY "No client deletes from referral codes" ON public.referral_codes FOR DELETE TO authenticated USING (false);

CREATE POLICY "No client writes to referrals" ON public.referrals FOR INSERT TO authenticated WITH CHECK (false);
CREATE POLICY "No client updates to referrals" ON public.referrals FOR UPDATE TO authenticated USING (false) WITH CHECK (false);
CREATE POLICY "No client deletes from referrals" ON public.referrals FOR DELETE TO authenticated USING (false);