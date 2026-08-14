
revoke all on function public.get_referral_code_for(uuid) from public, anon, authenticated;
revoke all on function public.redeem_referral_code_for(uuid, text) from public, anon, authenticated;
revoke all on function public.get_referral_stats_for(uuid) from public, anon, authenticated;
