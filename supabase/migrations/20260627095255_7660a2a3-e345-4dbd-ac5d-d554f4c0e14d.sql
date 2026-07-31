
CREATE TABLE public.soundtracks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  artist text,
  audio_path text NOT NULL,
  duration_seconds int,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.soundtracks TO authenticated;
GRANT ALL ON public.soundtracks TO service_role;
ALTER TABLE public.soundtracks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can read soundtracks" ON public.soundtracks FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage soundtracks" ON public.soundtracks FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE TRIGGER soundtracks_updated_at BEFORE UPDATE ON public.soundtracks FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.user_soundtracks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  audio_path text NOT NULL,
  duration_seconds int,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_soundtracks TO authenticated;
GRANT ALL ON public.user_soundtracks TO service_role;
ALTER TABLE public.user_soundtracks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own soundtracks" ON public.user_soundtracks FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
