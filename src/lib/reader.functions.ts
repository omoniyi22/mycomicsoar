import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { r2PublicUrl } from "./r2.server"; // must exist and export r2PublicUrl
import { Database } from "@/integrations/supabase/types";

// Resolve a stored key into a public URL. Keys look like:
//   "comic-pages/<id>/..."  or  "comic-pdfs/<id>/..."
// (after the R2 migration). If a legacy row still holds a bare supabase key,
export async function resolveUrl(
  bucketHint: string,
  key: string | null,
  expiryInSeconds: number = 60 * 60 // default 1 hour
): Promise<string> {
  if (!key) return "";
  if (/^https?:\/\//.test(key)) return key;
  // R2 public URL
  if (key.startsWith(`${bucketHint}/`)) return r2PublicUrl(key);
  // Supabase signed URL
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin.storage
    .from(bucketHint)
    .createSignedUrl(key, expiryInSeconds);
  return data?.signedUrl ?? "";
}

export const getReaderUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { slug: string }) => input)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // 1. Fetch comic details
    const { data: comic, error: comicError } = await supabaseAdmin
      .from("comics")
      .select("id, title, slug, pdf_path, pdf_path_landscape, page_count")
      .eq("slug", data.slug)
      .maybeSingle<Database["public"]["Tables"]["comics"]["Row"]>();

    if (comicError || !comic) {
      throw new Error("Comic not found");
    }

    // 2. Check if the current user is an admin using the database function
    let isAdmin = false;
    try {
      const { data: adminResult, error: adminError } = await supabase.rpc("is_admin");
      if (!adminError && typeof adminResult === "boolean") {
        isAdmin = adminResult;
      } else {
        // Fallback: hard-coded admin email (optional)
        const adminEmail = process.env.ADMIN_EMAIL || "admin@example.com";
        const { data: userRow } = await supabaseAdmin.auth.admin.getUserById(userId);
        isAdmin = userRow?.user?.email?.toLowerCase() === adminEmail.toLowerCase();
      }
    } catch (e) {
      // If the RPC fails, fall back to the email check
      const adminEmail = process.env.ADMIN_EMAIL || "admin@example.com";
      const { data: userRow } = await supabaseAdmin.auth.admin.getUserById(userId);
      isAdmin = userRow?.user?.email?.toLowerCase() === adminEmail.toLowerCase();
    }

    // 3. If not admin, verify ownership (purchase)
    if (!isAdmin) {
      const { data: owned, error: ownedError } = await supabase
        .from("purchases")
        .select("id")
        .eq("user_id", userId)
        .eq("comic_id", comic.id)
        .maybeSingle<Database["public"]["Tables"]["purchases"]["Row"]>();

      if (ownedError || !owned) {
        throw new Error("You don't own this issue yet.");
      }
    }

    // 4. Fetch pages
    const { data: pageRows, error: pageError } = await supabaseAdmin
      .from("comic_pages")
      .select("id, page_index, image_path, image_path_landscape")
      .eq("comic_id", comic.id)
      .order("page_index", { ascending: true })
      .returns<Database["public"]["Tables"]["comic_pages"]["Row"][]>();

    if (pageError) {
      throw new Error("Failed to load pages");
    }

    const pages = await Promise.all(
      (pageRows ?? []).map(async (p) => ({
        index: p.page_index,
        urlPortrait: p.image_path ? await resolveUrl("comic-pages", p.image_path) : "",
        urlLandscape: p.image_path_landscape
          ? await resolveUrl("comic-pages", p.image_path_landscape)
          : "",
      }))
    );

    // 5. Resolve PDF URLs
    const pdfUrlPortrait = comic.pdf_path
      ? await resolveUrl("comic-pdfs", comic.pdf_path)
      : null;
    const pdfUrlLandscape = comic.pdf_path_landscape
      ? await resolveUrl("comic-pdfs", comic.pdf_path_landscape)
      : null;

    if (pages.length === 0 && !pdfUrlPortrait && !pdfUrlLandscape) {
      throw new Error("No content uploaded for this issue yet.");
    }

    return {
      title: comic.title,
      slug: comic.slug,
      pages,
      pdfUrlPortrait,
      pdfUrlLandscape,
      pdfUrl: pdfUrlPortrait ?? pdfUrlLandscape,
      pageCount: pages.length || comic.page_count || 0,
    };
  });