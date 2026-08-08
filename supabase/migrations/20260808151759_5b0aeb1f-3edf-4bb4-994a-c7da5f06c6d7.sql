ALTER TABLE public.scan_history ADD COLUMN IF NOT EXISTS collection text;
CREATE INDEX IF NOT EXISTS scan_history_collection_idx ON public.scan_history (user_id, collection);