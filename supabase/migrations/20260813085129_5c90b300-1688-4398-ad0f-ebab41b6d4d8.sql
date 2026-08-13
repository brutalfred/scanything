CREATE TABLE public.poker_tables (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  host_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'waiting',
  max_seats integer NOT NULL DEFAULT 4,
  small_blind integer NOT NULL DEFAULT 25,
  big_blind integer NOT NULL DEFAULT 50,
  is_private boolean NOT NULL DEFAULT false,
  version integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.poker_tables TO authenticated;
GRANT ALL ON public.poker_tables TO service_role;
ALTER TABLE public.poker_tables ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Signed-in users can view poker tables"
  ON public.poker_tables FOR SELECT TO authenticated USING (true);

CREATE TABLE public.poker_seats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  table_id uuid NOT NULL REFERENCES public.poker_tables(id) ON DELETE CASCADE,
  seat_index integer NOT NULL,
  user_id uuid,
  is_bot boolean NOT NULL DEFAULT false,
  display_name text NOT NULL DEFAULT 'Player',
  stack integer NOT NULL DEFAULT 0,
  current_bet integer NOT NULL DEFAULT 0,
  total_committed integer NOT NULL DEFAULT 0,
  folded boolean NOT NULL DEFAULT false,
  all_in boolean NOT NULL DEFAULT false,
  has_acted boolean NOT NULL DEFAULT false,
  in_hand boolean NOT NULL DEFAULT false,
  last_action text,
  shown_cards jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (table_id, seat_index)
);
CREATE INDEX poker_seats_table_idx ON public.poker_seats(table_id);
GRANT SELECT ON public.poker_seats TO authenticated;
GRANT ALL ON public.poker_seats TO service_role;
ALTER TABLE public.poker_seats ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Signed-in users can view poker seats"
  ON public.poker_seats FOR SELECT TO authenticated USING (true);

CREATE TABLE public.poker_hands (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  table_id uuid NOT NULL REFERENCES public.poker_tables(id) ON DELETE CASCADE,
  hand_no integer NOT NULL DEFAULT 1,
  deck jsonb NOT NULL DEFAULT '[]'::jsonb,
  hole_cards jsonb NOT NULL DEFAULT '{}'::jsonb,
  board jsonb NOT NULL DEFAULT '[]'::jsonb,
  pot integer NOT NULL DEFAULT 0,
  stage text NOT NULL DEFAULT 'preflop',
  dealer_seat integer NOT NULL DEFAULT 0,
  acting_seat integer,
  current_bet integer NOT NULL DEFAULT 0,
  min_raise integer NOT NULL DEFAULT 0,
  action_deadline timestamptz,
  status text NOT NULL DEFAULT 'active',
  result_text text,
  winners jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX poker_hands_table_idx ON public.poker_hands(table_id);
GRANT ALL ON public.poker_hands TO service_role;
ALTER TABLE public.poker_hands ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.poker_chips (
  user_id uuid PRIMARY KEY,
  chips integer NOT NULL DEFAULT 5000,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.poker_chips TO authenticated;
GRANT ALL ON public.poker_chips TO service_role;
ALTER TABLE public.poker_chips ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own poker chips"
  ON public.poker_chips FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE TRIGGER poker_tables_updated_at BEFORE UPDATE ON public.poker_tables
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER poker_seats_updated_at BEFORE UPDATE ON public.poker_seats
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER poker_hands_updated_at BEFORE UPDATE ON public.poker_hands
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER poker_chips_updated_at BEFORE UPDATE ON public.poker_chips
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER PUBLICATION supabase_realtime ADD TABLE public.poker_tables;
ALTER PUBLICATION supabase_realtime ADD TABLE public.poker_seats;