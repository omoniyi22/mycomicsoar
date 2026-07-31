
-- 1) Allow purchasers to SELECT their purchased comic PDFs from storage
CREATE POLICY "Purchasers read their comic pdfs"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'comic-pdfs'
  AND EXISTS (
    SELECT 1
    FROM public.purchases p
    JOIN public.comics c ON c.id = p.comic_id
    WHERE p.user_id = auth.uid()
      AND c.pdf_path = storage.objects.name
  )
);

-- 2) Hide comics.pdf_path from anon/authenticated; server (service_role) keeps access
REVOKE SELECT ON public.comics FROM anon, authenticated;
GRANT SELECT (
  id, slug, title, publisher_id, writer, artist, cover_url, price, price_ngn,
  page_count, synopsis, genre, format, release_date, rating,
  is_manga, is_graphic_novel, is_featured, is_bestseller, is_trending, is_new,
  created_at
) ON public.comics TO anon, authenticated;

-- 3) Restrict profiles SELECT to authenticated users
DROP POLICY IF EXISTS "Profiles readable by everyone" ON public.profiles;
CREATE POLICY "Profiles readable by authenticated users"
ON public.profiles
FOR SELECT
TO authenticated
USING (true);

-- 4) Lock down is_admin() so signed-in users can't call it directly
REVOKE EXECUTE ON FUNCTION public.is_admin() FROM PUBLIC, anon, authenticated;
