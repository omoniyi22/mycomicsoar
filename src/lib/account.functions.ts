import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Comic } from "./catalog.functions";
import { resolveUrl } from "./reader.functions"; // import shared resolver

export type Profile = {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
};

export type LibraryItem = {
  id: string;
  price_paid: number;
  download_count: number;
  purchased_at: string;
  last_downloaded_at: string | null;
  comic: Comic;
};

export type WishlistItem = {
  id: string;
  created_at: string;
  comic: Comic;
};

const COMIC_COLS =
  "id,title,slug,writer,artist,cover_url,price,rating,release_date,format,genre,synopsis,is_new,is_trending,is_bestseller,is_featured,is_graphic_novel,is_manga,publisher:publishers(name,slug,accent)";

export const getAccountOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    const [{ data: profile }, { data: lib }, { data: wish }] = await Promise.all([
      supabase.from("profiles").select("id,display_name,avatar_url").eq("id", userId).maybeSingle(),
      supabase
        .from("purchases")
        .select(`id,price_paid,download_count,purchased_at,last_downloaded_at,comic:comics(${COMIC_COLS})`)
        .order("purchased_at", { ascending: false })
        .limit(8),
      supabase
        .from("wishlist")
        .select(`id,created_at,comic:comics(${COMIC_COLS})`)
        .order("created_at", { ascending: false }),
    ]);

    return {
      profile: (profile ?? null) as Profile | null,
      library: ((lib ?? []) as unknown as LibraryItem[]).filter((x) => x.comic),
      wishlist: ((wish ?? []) as unknown as WishlistItem[]).filter((x) => x.comic),
    };
  });

export type OrderRow = {
  id: string;
  total: number;
  status: string;
  email: string | null;
  created_at: string;
  items: Array<{
    id: string;
    title: string;
    unit_price: number;
    quantity: number;
    comic: { slug: string; cover_url: string | null } | null;
  }>;
};
export const getDownloadUrlBySlug = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { slug: string }) => input)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // 1. Fetch comic by slug
    const { data: comic } = await supabaseAdmin
      .from("comics")
      .select("id, pdf_path, title")
      .eq("slug", data.slug)
      .maybeSingle();
    if (!comic) throw new Error("Comic not found");
    if (!comic.pdf_path) throw new Error("No PDF available for this comic.");

    // 2. Verify ownership
    const { data: purchase } = await supabase
      .from("purchases")
      .select("id")
      .eq("user_id", userId)
      .eq("comic_id", comic.id)
      .maybeSingle();
    if (!purchase) throw new Error("You do not own this comic.");

    // 3. Generate signed URL
    const { data: signed, error } = await supabaseAdmin.storage
      .from("comic-pdfs")
      .createSignedUrl(comic.pdf_path, 60 * 5);
    if (error || !signed) throw error ?? new Error("Could not generate URL");

    return { url: signed.signedUrl, title: comic.title };
  });
export const listMyOrders = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("orders")
      .select(`id,total,status,email,created_at,currency,items:order_items(id,title,unit_price,quantity,comic:comics(slug,cover_url))`)
      .order("created_at", { ascending: false });
    return { orders: (data ?? []) as unknown as OrderRow[] };
  });

export const getLibrary = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("purchases")
      .select(`id,price_paid,download_count,purchased_at,last_downloaded_at,comic:comics(${COMIC_COLS})`)
      .order("purchased_at", { ascending: false });
    return ((data ?? []) as unknown as LibraryItem[]).filter((x) => x.comic);
  });

export const recordDownload = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { purchaseId: string }) => input)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: row } = await supabase
      .from("purchases")
      .select("download_count")
      .eq("id", data.purchaseId)
      .eq("user_id", userId)
      .maybeSingle();
    if (!row) return { ok: false as const };
    await supabase
      .from("purchases")
      .update({
        download_count: (row.download_count ?? 0) + 1,
        last_downloaded_at: new Date().toISOString(),
      })
      .eq("id", data.purchaseId);
    return { ok: true as const };
  });

export const toggleWishlist = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { comicId: string }) => input)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: existing } = await supabase
      .from("wishlist")
      .select("id")
      .eq("user_id", userId)
      .eq("comic_id", data.comicId)
      .maybeSingle();
    if (existing) {
      await supabase.from("wishlist").delete().eq("id", existing.id);
      return { wishlisted: false };
    }
    await supabase.from("wishlist").insert({ user_id: userId, comic_id: data.comicId });
    return { wishlisted: true };
  });

export const updateProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { display_name?: string; avatar_url?: string }) => input)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await supabase
      .from("profiles")
      .update({
        display_name: data.display_name,
        avatar_url: data.avatar_url,
      })
      .eq("id", userId);
    return { ok: true };
  });
export const getComicDownloadUrls = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { comicId: string }) => input)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // 1. Verify ownership
    const { data: purchase } = await supabase
      .from("purchases")
      .select("id")
      .eq("user_id", userId)
      .eq("comic_id", data.comicId)
      .maybeSingle();
    if (!purchase) throw new Error("You don't own this comic.");

    // 2. Fetch PDF paths
    const { data: comic } = await supabaseAdmin
      .from("comics")
      .select("pdf_path, pdf_path_landscape, title")
      .eq("id", data.comicId)
      .maybeSingle();
    if (!comic) throw new Error("Comic not found.");
    if (!comic.pdf_path && !comic.pdf_path_landscape) throw new Error("No PDF available.");

    // 3. Resolve both variants using the same resolver the reader uses
    const portraitUrl = await resolveUrl("comic-pdfs", comic.pdf_path);
    const landscapeUrl = await resolveUrl("comic-pdfs", comic.pdf_path_landscape);
    console.log({ portraitUrl, landscapeUrl, title: comic.title })
    return { portraitUrl, landscapeUrl, title: comic.title };
  });


export const getDownloadUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { purchaseId: string }) => input)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    // Dynamically import supabaseAdmin to use for signed URL generation (bypasses RLS)
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // 1. Verify purchase ownership
    const { data: row } = await supabase
      .from("purchases")
      .select("id,comic_id,download_count")
      .eq("id", data.purchaseId)
      .eq("user_id", userId)
      .maybeSingle();
    if (!row) throw new Error("Purchase not found");

    // 2. Fetch the PDF path from the comic
    const { data: comic } = await supabaseAdmin
      .from("comics")
      .select("pdf_path,title")
      .eq("id", (row as any).comic_id)
      .maybeSingle();
    if (!comic?.pdf_path) throw new Error("No PDF available for this comic yet.");

    // 3. Generate a signed URL (short‑lived)
    const { data: signed, error } = await supabaseAdmin.storage
      .from("comic-pdfs")
      .createSignedUrl(comic.pdf_path, 60 * 5); // 5 minutes expiry
    if (error || !signed) throw error ?? new Error("Could not generate URL");

    // 4. Increment download count (optional)
    await supabase
      .from("purchases")
      .update({
        download_count: ((row as any)?.download_count ?? 0) + 1,
        last_downloaded_at: new Date().toISOString(),
      })
      .eq("id", data.purchaseId);

    return { url: signed.signedUrl, title: comic.title };
  });

