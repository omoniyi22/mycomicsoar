
CREATE POLICY "Admins upload comic pdfs" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'comic-pdfs' AND public.is_admin());
CREATE POLICY "Admins update comic pdfs" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'comic-pdfs' AND public.is_admin())
  WITH CHECK (bucket_id = 'comic-pdfs' AND public.is_admin());
CREATE POLICY "Admins delete comic pdfs" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'comic-pdfs' AND public.is_admin());
CREATE POLICY "Admins read comic pdfs" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'comic-pdfs' AND public.is_admin());
