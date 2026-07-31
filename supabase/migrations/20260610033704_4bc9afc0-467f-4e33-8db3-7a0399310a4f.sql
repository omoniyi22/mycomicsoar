
CREATE TABLE public.publishers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  tagline TEXT,
  accent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.comics (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  publisher_id UUID REFERENCES public.publishers(id) ON DELETE SET NULL,
  writer TEXT,
  artist TEXT,
  cover_url TEXT,
  price NUMERIC(10,2) NOT NULL DEFAULT 0,
  rating NUMERIC(2,1) NOT NULL DEFAULT 0,
  release_date DATE,
  format TEXT,
  genre TEXT,
  synopsis TEXT,
  is_new BOOLEAN NOT NULL DEFAULT false,
  is_trending BOOLEAN NOT NULL DEFAULT false,
  is_bestseller BOOLEAN NOT NULL DEFAULT false,
  is_featured BOOLEAN NOT NULL DEFAULT false,
  is_graphic_novel BOOLEAN NOT NULL DEFAULT false,
  is_manga BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.publishers TO anon, authenticated;
GRANT ALL ON public.publishers TO service_role;
GRANT SELECT ON public.comics TO anon, authenticated;
GRANT ALL ON public.comics TO service_role;

ALTER TABLE public.publishers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Publishers are viewable by everyone" ON public.publishers FOR SELECT USING (true);
CREATE POLICY "Comics are viewable by everyone" ON public.comics FOR SELECT USING (true);
