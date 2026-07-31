
ALTER TABLE public.comic_pages ADD COLUMN IF NOT EXISTS image_path_landscape TEXT;
ALTER TABLE public.comics ADD COLUMN IF NOT EXISTS pdf_path_landscape TEXT;
COMMENT ON COLUMN public.comic_pages.image_path IS 'Portrait (mobile) image path in comic-pages bucket';
COMMENT ON COLUMN public.comic_pages.image_path_landscape IS 'Landscape (desktop) image path in comic-pages bucket';
COMMENT ON COLUMN public.comics.pdf_path IS 'Portrait/mobile PDF path in comic-pdfs bucket';
COMMENT ON COLUMN public.comics.pdf_path_landscape IS 'Landscape/desktop PDF path in comic-pdfs bucket';
ALTER TABLE public.comic_pages ALTER COLUMN image_path DROP NOT NULL;
