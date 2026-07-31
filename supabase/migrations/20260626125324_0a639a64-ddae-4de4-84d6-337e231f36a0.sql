
-- 1) comic_pages table
CREATE TABLE public.comic_pages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  comic_id uuid NOT NULL REFERENCES public.comics(id) ON DELETE CASCADE,
  page_index integer NOT NULL,
  image_path text NOT NULL,
  width integer,
  height integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (comic_id, page_index)
);

CREATE INDEX comic_pages_comic_idx ON public.comic_pages(comic_id, page_index);

GRANT SELECT ON public.comic_pages TO authenticated;
GRANT ALL ON public.comic_pages TO service_role;

ALTER TABLE public.comic_pages ENABLE ROW LEVEL SECURITY;

-- Authenticated users can read page rows only if they own the comic (or are admin).
CREATE POLICY "Owners or admin can read comic_pages"
  ON public.comic_pages FOR SELECT
  TO authenticated
  USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.purchases p
      WHERE p.comic_id = comic_pages.comic_id
        AND p.user_id = auth.uid()
    )
  );

-- 2) Storage policies on comic-pages bucket
-- Admin can manage all objects in comic-pages
CREATE POLICY "Admin manage comic-pages"
  ON storage.objects FOR ALL
  TO authenticated
  USING (bucket_id = 'comic-pages' AND public.is_admin())
  WITH CHECK (bucket_id = 'comic-pages' AND public.is_admin());

-- Purchasers can read page images they own (path is "<comic_id>/...")
CREATE POLICY "Purchasers can read comic-pages"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'comic-pages'
    AND (
      public.is_admin()
      OR EXISTS (
        SELECT 1 FROM public.purchases p
        WHERE p.user_id = auth.uid()
          AND p.comic_id::text = split_part(storage.objects.name, '/', 1)
      )
    )
  );
