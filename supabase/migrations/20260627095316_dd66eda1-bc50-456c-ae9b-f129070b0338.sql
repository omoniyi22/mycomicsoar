
CREATE POLICY "soundtracks admin read"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'soundtracks' AND (storage.foldername(name))[1] = 'admin');

CREATE POLICY "soundtracks admin write"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'soundtracks' AND (storage.foldername(name))[1] = 'admin' AND public.is_admin());

CREATE POLICY "soundtracks admin update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'soundtracks' AND (storage.foldername(name))[1] = 'admin' AND public.is_admin());

CREATE POLICY "soundtracks admin delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'soundtracks' AND (storage.foldername(name))[1] = 'admin' AND public.is_admin());

CREATE POLICY "soundtracks user own all"
  ON storage.objects FOR ALL TO authenticated
  USING (
    bucket_id = 'soundtracks'
    AND (storage.foldername(name))[1] = 'users'
    AND (storage.foldername(name))[2] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'soundtracks'
    AND (storage.foldername(name))[1] = 'users'
    AND (storage.foldername(name))[2] = auth.uid()::text
  );
