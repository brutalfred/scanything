
drop table if exists public.poker_hands cascade;
drop table if exists public.poker_seats cascade;
drop table if exists public.poker_tables cascade;
drop table if exists public.poker_chips cascade;
drop function if exists public.is_seated_at_poker_table(uuid, uuid);
