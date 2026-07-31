// lib/admin.functions.ts
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertAdmin(supabase: any) {
  const { data, error } = await supabase.rpc("is_admin");
  if (error || !data) throw new Error("Forbidden");
}

export type AdminComic = {
  id: string;
  title: string;
  slug: string;
  writer: string | null;
  artist: string | null;
  cover_url: string | null;
  price: number;
  price_ngn: number | null;
  price_eur: number | null;
  rating: number;
  release_date: string | null;
  format: string | null;
  genre: string | null;
  synopsis: string | null;
  publisher_id: string | null;
  pdf_path: string | null;
  pdf_path_landscape: string | null;
  page_count: number;
  is_new: boolean;
  is_trending: boolean;
  is_bestseller: boolean;
  is_featured: boolean;
  is_graphic_novel: boolean;
  is_manga: boolean;
  status: "draft" | "published" | "archived";
};

export const checkIsAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    console.log("[checkIsAdmin] Checking admin status");
    const { data } = await context.supabase.rpc("is_admin");
    console.log("[checkIsAdmin] Result:", { admin: Boolean(data) });
    return { admin: Boolean(data) };
  });

export const listAdminComics = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    console.log("[listAdminComics] Starting");
    await assertAdmin(context.supabase);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("comics")
      .select("id,title,slug,price,pdf_path,pdf_path_landscape,page_count,is_featured,is_new,cover_url,status,publisher:publishers(name)")
      .order("created_at", { ascending: false });
    if (error) throw error;
    console.log(`[listAdminComics] Found ${data?.length || 0} comics`);
    return { comics: (data ?? []) as any[] };
  });

export const getAdminComic = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ data, context }) => {
    console.log("[getAdminComic] Fetching comic with id:", data.id);
    await assertAdmin(context.supabase);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [{ data: comic }, { data: pubs }] = await Promise.all([
      supabaseAdmin.from("comics").select("*").eq("id", data.id).maybeSingle(),
      supabaseAdmin.from("publishers").select("id,name,slug").order("name"),
    ]);
    console.log("[getAdminComic] Found comic:", comic?.title || "none");
    return { comic: comic as AdminComic | null, publishers: (pubs ?? []) as any[] };
  });

export const listPublishersAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    console.log("[listPublishersAdmin] Fetching publishers");
    await assertAdmin(context.supabase);
    const { data } = await context.supabase
      .from("publishers")
      .select("id,name,slug,tagline,accent")
      .order("name");
    console.log(`[listPublishersAdmin] Found ${data?.length || 0} publishers`);
    return { publishers: (data ?? []) as any[] };
  });

type PublisherInput = { name: string; slug: string; tagline?: string | null; accent?: string | null };

export const createPublisher = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: PublisherInput) => input)
  .handler(async ({ data, context }) => {
    console.log("[createPublisher] Creating publisher:", data.name);
    await assertAdmin(context.supabase);
    const { data: row, error } = await context.supabase
      .from("publishers")
      .insert(data as any)
      .select("id")
      .single();
    if (error) throw error;
    console.log("[createPublisher] Created with id:", row.id);
    return { id: row.id };
  });

// ==================== deleteComicPageOrientation with full logging ====================
export const deleteComicPageOrientation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: {
    comicId: string;
    pageIndex: number;
    orientation: "portrait" | "landscape" | "both"
  }) => input)
  .handler(async ({ data, context }) => {
    console.log("[deleteComicPageOrientation] STARTED with data:", data);
    await assertAdmin(context.supabase);
    console.log("[deleteComicPageOrientation] Admin check passed");

    const { comicId, pageIndex, orientation } = data;

    // 1. Fetch the page record
    console.log(`[deleteComicPageOrientation] Fetching page for comic=${comicId}, pageIndex=${pageIndex}`);
    const { data: page, error: fetchError } = await context.supabase
      .from("comic_pages")
      .select("id, image_path, image_path_landscape")
      .eq("comic_id", comicId)
      .eq("page_index", pageIndex)
      .maybeSingle();

    if (fetchError) {
      console.error("[deleteComicPageOrientation] Fetch error:", fetchError);
      throw fetchError;
    }
    if (!page) {
      console.error("[deleteComicPageOrientation] Page not found");
      throw new Error("Page not found");
    }
    console.log("[deleteComicPageOrientation] Fetched page:", page);

    // 2. Determine which fields to clear
    console.log("[deleteComicPageOrientation] Orientation requested:", orientation);
    const { r2Delete } = await import("./r2.server");
    const updateData: any = {};
    const keysToDelete: string[] = [];

    if (orientation === "portrait" || orientation === "both") {
      if (page.image_path) {
        keysToDelete.push(page.image_path);
        updateData.image_path = null;
        console.log("[deleteComicPageOrientation] Marked portrait for deletion:", page.image_path);
      } else {
        console.log("[deleteComicPageOrientation] Portrait image_path is null, nothing to delete");
      }
    }
    if (orientation === "landscape" || orientation === "both") {
      if (page.image_path_landscape) {
        keysToDelete.push(page.image_path_landscape);
        updateData.image_path_landscape = null;
        console.log("[deleteComicPageOrientation] Marked landscape for deletion:", page.image_path_landscape);
      } else {
        console.log("[deleteComicPageOrientation] Landscape image_path_landscape is null, nothing to delete");
      }
    }

    // 3. Delete from R2
    if (keysToDelete.length > 0) {
      console.log("[deleteComicPageOrientation] Deleting R2 keys:", keysToDelete);
      await Promise.all(
        keysToDelete.map(async (key) => {
          try {
            await r2Delete(key);
            console.log(`[deleteComicPageOrientation] Successfully deleted R2 key: ${key}`);
          } catch (e) {
            console.warn(`[deleteComicPageOrientation] R2 delete failed for ${key}`, e);
          }
        })
      );
    } else {
      console.log("[deleteComicPageOrientation] No R2 keys to delete");
    }

    // 4. Update the database – set the cleared fields to null
    console.log("[deleteComicPageOrientation] Updating database with:", updateData);
    if (Object.keys(updateData).length === 0) {
      console.log("[deleteComicPageOrientation] No fields to update – skipping database update");
      return { ok: true };
    }
    const { error: updateError } = await context.supabase
      .from("comic_pages")
      .update(updateData)
      .eq("id", page.id);

    if (updateError) {
      console.error("[deleteComicPageOrientation] Database update error:", updateError);
      throw updateError;
    }
    console.log("[deleteComicPageOrientation] Database updated successfully");

    // Optional: if both are null, you might want to delete the row entirely.
    console.log("[deleteComicPageOrientation] COMPLETED");
    return { ok: true };
  });

// Other functions (updatePublisher, deletePublisher, uploadCoverImage, etc.) omitted for brevity – add similar logs if needed.
// We'll include them here for completeness, but we can add minimal logs.

export const updatePublisher = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string; patch: Partial<PublisherInput> }) => input)
  .handler(async ({ data, context }) => {
    console.log("[updatePublisher] Updating publisher:", data.id, data.patch);
    await assertAdmin(context.supabase);
    const { error } = await context.supabase
      .from("publishers")
      .update(data.patch as any)
      .eq("id", data.id);
    if (error) throw error;
    console.log("[updatePublisher] Done");
    return { ok: true };
  });

export const deletePublisher = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ data, context }) => {
    console.log("[deletePublisher] Deleting publisher:", data.id);
    await assertAdmin(context.supabase);
    const { error } = await context.supabase.from("publishers").delete().eq("id", data.id);
    if (error) throw error;
    console.log("[deletePublisher] Done");
    return { ok: true };
  });

export const uploadCoverImage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { filename: string; contentType: string; base64: string }) => input)
  .handler(async ({ data, context }) => {
    console.log("[uploadCoverImage] Uploading cover:", data.filename);
    await assertAdmin(context.supabase);
    const { r2Put, r2PublicUrl } = await import("./r2.server");
    const buffer = Buffer.from(data.base64, "base64");
    const safe = data.filename.replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = `comic-covers/${Date.now()}-${safe}`;
    console.log("[uploadCoverImage] R2 path:", path);
    await r2Put(path, buffer, data.contentType || "image/jpeg");
    const url = r2PublicUrl(path);
    console.log("[uploadCoverImage] Uploaded, URL:", url);
    return { url, path: url };
  });

type ComicInput = Partial<AdminComic> & { title: string; slug: string; status?: "draft" | "published" | "archived" };

export const createComic = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: ComicInput) => input)
  .handler(async ({ data, context }) => {
    console.log("[createComic] Creating comic:", data.title);
    await assertAdmin(context.supabase);
    const payload = { ...data, status: data.status || "published" };
    const { data: row, error } = await context.supabase
      .from("comics")
      .insert(payload as any)
      .select("id")
      .single();
    if (error) throw error;
    console.log("[createComic] Created with id:", row.id);
    return { id: row.id };
  });

export const updateComic = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string; patch: Partial<AdminComic> & { status?: "draft" | "published" | "archived" } }) => input)
  .handler(async ({ data, context }) => {
    console.log("[updateComic] Updating comic:", data.id, data.patch);
    await assertAdmin(context.supabase);
    const { error } = await context.supabase
      .from("comics")
      .update(data.patch as any)
      .eq("id", data.id);
    if (error) throw error;
    console.log("[updateComic] Done");
    return { ok: true };
  });

// ==================== UPDATED deleteComic with logging ====================
export const deleteComic = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ data, context }) => {
    console.log("[deleteComic] Starting for comic id:", data.id);
    await assertAdmin(context.supabase);

    const { id: comicId } = data;

    // 1. Get the comic to know the PDF paths
    console.log("[deleteComic] Fetching comic details");
    const { data: comic, error: comicError } = await context.supabase
      .from("comics")
      .select("pdf_path, pdf_path_landscape")
      .eq("id", comicId)
      .single();

    if (comicError && comicError.code !== "PGRST116") {
      console.warn("[deleteComic] Comic not found for R2 cleanup", comicError);
    } else {
      console.log("[deleteComic] Comic PDFs:", comic?.pdf_path, comic?.pdf_path_landscape);
    }

    // 2. Get all page image keys (both portrait & landscape)
    console.log("[deleteComic] Fetching all pages");
    const { data: pages, error: pagesError } = await context.supabase
      .from("comic_pages")
      .select("image_path, image_path_landscape")
      .eq("comic_id", comicId);

    if (pagesError) throw pagesError;
    console.log(`[deleteComic] Found ${pages?.length || 0} pages`);

    // 3. Collect all R2 keys to delete
    const keysToDelete: string[] = [];

    if (comic?.pdf_path) keysToDelete.push(comic.pdf_path);
    if (comic?.pdf_path_landscape) keysToDelete.push(comic.pdf_path_landscape);

    if (pages && pages.length > 0) {
      pages.forEach((page: any) => {
        if (page.image_path) keysToDelete.push(page.image_path);
        if (page.image_path_landscape) keysToDelete.push(page.image_path_landscape);
      });
    }

    console.log(`[deleteComic] Total R2 keys to delete: ${keysToDelete.length}`);

    // 4. Delete from R2
    if (keysToDelete.length > 0) {
      console.log("[deleteComic] Deleting R2 keys...");
      const { r2Delete } = await import("./r2.server");
      await Promise.all(
        keysToDelete.map(async (key) => {
          try {
            await r2Delete(key);
            console.log(`[deleteComic] Deleted R2 key: ${key}`);
          } catch (e) {
            console.warn(`[deleteComic] R2 delete failed for ${key}`, e);
          }
        })
      );
      console.log("[deleteComic] R2 deletion complete");
    } else {
      console.log("[deleteComic] No R2 keys to delete");
    }

    // 5. Delete pages then comic
    console.log("[deleteComic] Deleting pages from database");
    const { error: deletePagesError } = await context.supabase
      .from("comic_pages")
      .delete()
      .eq("comic_id", comicId);

    if (deletePagesError) throw deletePagesError;

    console.log("[deleteComic] Deleting comic from database");
    const { error: deleteComicError } = await context.supabase
      .from("comics")
      .delete()
      .eq("id", comicId);

    if (deleteComicError) throw deleteComicError;

    console.log("[deleteComic] Done");
    return { ok: true };
  });

export const uploadComicPdf = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { comicId: string; filename: string; base64: string; pageCount?: number }) => input)
  .handler(async ({ data, context }) => {
    console.log("[uploadComicPdf] Uploading PDF for comic:", data.comicId, data.filename);
    await assertAdmin(context.supabase);
    const { r2Put } = await import("./r2.server");
    const buffer = Buffer.from(data.base64, "base64");
    const path = `comic-pdfs/${data.comicId}/${Date.now()}-${data.filename.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
    console.log("[uploadComicPdf] R2 path:", path);
    await r2Put(path, buffer, "application/pdf");
    const patch: any = { pdf_path: path };
    if (data.pageCount && data.pageCount > 0) patch.page_count = data.pageCount;
    console.log("[uploadComicPdf] Updating comic with:", patch);
    await context.supabase.from("comics").update(patch).eq("id", data.comicId);
    console.log("[uploadComicPdf] Done");
    return { ok: true, path };
  });

// ==================== deleteComicPage with logging ====================
export const deleteComicPage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { comicId: string; pageNumber: number }) => input)
  .handler(async ({ data, context }) => {
    console.log("[deleteComicPage] Starting for comic:", data.comicId, "page:", data.pageNumber);
    await assertAdmin(context.supabase);

    const { comicId, pageNumber } = data;

    // 1. Fetch the page record(s) – both orientations are in a single row
    console.log("[deleteComicPage] Fetching page");
    const { data: page, error: fetchError } = await context.supabase
      .from("comic_pages")
      .select("id, image_path, image_path_landscape")
      .eq("comic_id", comicId)
      .eq("page_index", pageNumber)
      .maybeSingle();

    if (fetchError) {
      console.error("[deleteComicPage] Fetch error:", fetchError);
      throw fetchError;
    }
    if (!page) {
      console.error("[deleteComicPage] Page not found");
      throw new Error("Page not found");
    }
    console.log("[deleteComicPage] Fetched page:", page);

    // 2. Delete the actual files from R2
    const { r2Delete } = await import("./r2.server");
    const keysToDelete: string[] = [];
    if (page.image_path) keysToDelete.push(page.image_path);
    if (page.image_path_landscape) keysToDelete.push(page.image_path_landscape);

    if (keysToDelete.length > 0) {
      console.log("[deleteComicPage] Deleting R2 keys:", keysToDelete);
      await Promise.all(
        keysToDelete.map(async (key) => {
          try {
            await r2Delete(key);
            console.log(`[deleteComicPage] Deleted R2 key: ${key}`);
          } catch (e) {
            console.warn(`[deleteComicPage] R2 delete failed for ${key}`, e);
          }
        })
      );
    } else {
      console.log("[deleteComicPage] No R2 keys to delete");
    }

    // 3. Delete the database record
    console.log("[deleteComicPage] Deleting database record");
    const { error: deleteError } = await context.supabase
      .from("comic_pages")
      .delete()
      .eq("id", page.id);

    if (deleteError) {
      console.error("[deleteComicPage] Delete error:", deleteError);
      throw deleteError;
    }

    console.log("[deleteComicPage] Done");
    return { ok: true };
  });

// lib/admin.functions.ts – add this function

// ==================== NEW cleanComicImages ====================
export const cleanComicImages = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { comicId: string }) => input)
  .handler(async ({ data, context }) => {
    console.log("[cleanComicImages] START for comic:", data.comicId);
    await assertAdmin(context.supabase);
    console.log("[cleanComicImages] Admin check passed");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { r2List, r2Delete } = await import("./r2.server");

    const { comicId } = data;

    // 1. Fetch all existing page image paths from DB
    const { data: pages, error: pagesError } = await supabaseAdmin
      .from("comic_pages")
      .select("image_path, image_path_landscape")
      .eq("comic_id", comicId);
    if (pagesError) {
      console.error("[cleanComicImages] DB fetch error:", pagesError);
      throw pagesError;
    }

    const dbPaths = new Set<string>();
    if (pages) {
      pages.forEach((p: any) => {
        if (p.image_path) dbPaths.add(p.image_path);
        if (p.image_path_landscape) dbPaths.add(p.image_path_landscape);
      });
    }
    console.log(`[cleanComicImages] Found ${dbPaths.size} referenced paths in DB`);

    // 2. List all files in R2 under comic-pages/comicId/portrait/ and landscape/
    const prefixes = [
      `comic-pages/${comicId}/portrait/`,
      `comic-pages/${comicId}/landscape/`,
    ];
    const allR2Keys: string[] = [];
    for (const prefix of prefixes) {
      try {
        const keys = await r2List(prefix);
        console.log(`[cleanComicImages] Listed ${keys.length} files under ${prefix}`);
        allR2Keys.push(...keys);
      } catch (e) {
        console.warn(`[cleanComicImages] Failed to list ${prefix}:`, e);
      }
    }

    // 3. Find orphaned keys (not in DB)
    const orphaned = allR2Keys.filter((key) => !dbPaths.has(key));
    console.log(`[cleanComicImages] Found ${orphaned.length} orphaned files`);

    if (orphaned.length === 0) {
      console.log("[cleanComicImages] No orphaned files to delete");
      return { deletedCount: 0 };
    }

    // 4. Delete orphaned files
    console.log("[cleanComicImages] Deleting orphaned files...");
    let deletedCount = 0;
    await Promise.all(
      orphaned.map(async (key) => {
        try {
          await r2Delete(key);
          console.log(`[cleanComicImages] Deleted orphaned: ${key}`);
          deletedCount++;
        } catch (e) {
          console.warn(`[cleanComicImages] Failed to delete ${key}:`, e);
        }
      })
    );
    console.log(`[cleanComicImages] Done, deleted ${deletedCount} files`);
    return { deletedCount };
  });