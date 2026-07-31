import { createServerFn } from "@tanstack/react-start";
import { deduplicateByKey } from "./deduplicate";

// ----------------------------------------------------------------------
// TYPES
// ----------------------------------------------------------------------

export type Comic = {
  id: string;
  title: string;
  slug: string;
  writer: string | null;
  artist: string | null;
  cover_url: string | null;
  price: number;
  price_ngn: number | null;
  rating: number;
  release_date: string | null;
  format: string | null;
  genre: string | null;
  synopsis: string | null;
  is_new: boolean;
  is_trending: boolean;
  is_bestseller: boolean;
  is_featured: boolean;
  is_graphic_novel: boolean;
  is_manga: boolean;
  publisher: { name: string; slug: string; accent: string | null } | null;
};

export type Publisher = {
  id: string;
  name: string;
  slug: string;
  tagline: string | null;
  accent: string | null;
};

export type HomeData = {
  featured: Comic[];
  newReleases: Comic[];
  trending: Comic[];
  bestsellers: Comic[];
  graphicNovels: Comic[];
  manga: Comic[];
  publishers: Publisher[];
};

export type ShopFilters = {
  q?: string;
  publisher?: string;
  genre?: string;
  format?: string;
  sort?: "new" | "rating" | "price-asc" | "price-desc";
};

export type ShopData = {
  comics: Comic[];
  publishers: Publisher[];
  genres: string[];
  formats: string[];
  total: number;
};

// ----------------------------------------------------------------------
// CONSTANTS
// ----------------------------------------------------------------------

const COMIC_COLS =
  "id,title,slug,writer,artist,cover_url,price,price_ngn,rating,release_date,format,genre,synopsis,is_new,is_trending,is_bestseller,is_featured,is_graphic_novel,is_manga,publisher:publishers(name,slug,accent),price_eur";

console.log("📄 [MODULE] catalog.functions.ts loaded");
console.log("📄 [MODULE] COMIC_COLS:", COMIC_COLS);

// ----------------------------------------------------------------------
// HOMEPAGE DATA
// ----------------------------------------------------------------------

export const getHomeData = createServerFn({ method: "GET" }).handler(
  async (): Promise<HomeData> => {
    console.log("🏠 [Home] ====== STARTING getHomeData ======");
    
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    console.log("🏠 [Home] Step 1: supabaseAdmin imported ✅");

    // Only fetch comics with status = 'published'
    console.log("🏠 [Home] Step 2: Fetching published comics...");
    const [{ data: comicsRaw, error: comicsError }, { data: publishers, error: publishersError }] = await Promise.all([
      supabaseAdmin
        .from("comics")
        .select(COMIC_COLS)
        .eq("status", "published")
        .order("release_date", { ascending: false }),
      supabaseAdmin.from("publishers").select("id,name,slug,tagline,accent").order("name"),
    ]);

    if (comicsError) console.error("❌ [Home] Comics query error:", comicsError);
    else console.log("✅ [Home] Comics query successful!");

    if (publishersError) console.error("❌ [Home] Publishers query error:", publishersError);
    else console.log("✅ [Home] Publishers query successful!");

    console.log("🏠 [Home] Step 3: Raw comics data length:", comicsRaw?.length ?? 0);
    console.log("🏠 [Home] Step 3: Raw publishers data length:", publishers?.length ?? 0);

    const comics = (comicsRaw ?? []) as Comic[];
    const publisherList = (publishers ?? []) as Publisher[];

    console.log("🏠 [Home] Step 6: Filtering counts...");
    const featured = comics.filter(c => c.is_featured);
    const newReleases = comics.filter(c => c.is_new);
    const trending = comics.filter(c => c.is_trending);
    const bestsellers = comics.filter(c => c.is_bestseller);
    const graphicNovels = comics.filter(c => c.is_graphic_novel);
    const manga = comics.filter(c => c.is_manga);

    console.log("🏠 [Home] Step 6: Featured count:", featured.length);
    console.log("🏠 [Home] Step 6: New releases count:", newReleases.length);
    console.log("🏠 [Home] Step 6: Trending count:", trending.length);
    console.log("🏠 [Home] Step 6: Bestsellers count:", bestsellers.length);
    console.log("🏠 [Home] Step 6: Graphic novels count:", graphicNovels.length);
    console.log("🏠 [Home] Step 6: Manga count:", manga.length);

    const uniquePublishers = deduplicateByKey(publisherList, "slug") as Publisher[];

    const homeData: HomeData = {
      featured,
      newReleases,
      trending,
      bestsellers,
      graphicNovels,
      manga,
      publishers: uniquePublishers,
    };

    console.log("🏠 [Home] ====== COMPLETED getHomeData ======");
    return homeData;
  },
);

// ----------------------------------------------------------------------
// SHOP DATA (filtered, sorted)
// ----------------------------------------------------------------------

export const getShopData = createServerFn({ method: "GET" })
  .inputValidator((input: ShopFilters) => input ?? {})
  .handler(async ({ data }): Promise<ShopData> => {
    console.log("🛒 [Shop] ====== STARTING getShopData ======");
    console.log("🛒 [Shop] Input filters:", data);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Start with base query: only published comics
    let query = supabaseAdmin
      .from("comics")
      .select(COMIC_COLS)
      .eq("status", "published");

    console.log("🛒 [Shop] Step 2: Base query (only published) created");

    // Apply filters
    if (data.q) {
      console.log("🛒 [Shop] Step 3: Applying search filter:", data.q);
      query = query.ilike("title", `%${data.q}%`);
    }
    if (data.genre) {
      console.log("🛒 [Shop] Step 3: Applying genre filter:", data.genre);
      query = query.eq("genre", data.genre);
    }
    if (data.format) {
      console.log("🛒 [Shop] Step 3: Applying format filter:", data.format);
      query = query.eq("format", data.format);
    }

    // Apply sorting
    switch (data.sort) {
      case "rating":
        console.log("🛒 [Shop] Step 4: Sorting by rating (desc)");
        query = query.order("rating", { ascending: false });
        break;
      case "price-asc":
        console.log("🛒 [Shop] Step 4: Sorting by price (asc)");
        query = query.order("price", { ascending: true });
        break;
      case "price-desc":
        console.log("🛒 [Shop] Step 4: Sorting by price (desc)");
        query = query.order("price", { ascending: false });
        break;
      default:
        console.log("🛒 [Shop] Step 4: Sorting by release_date (desc) - default");
        query = query.order("release_date", { ascending: false });
    }

    const [{ data: comicsRaw, error: comicsError }, { data: publishers, error: publishersError }] = await Promise.all([
      query,
      supabaseAdmin.from("publishers").select("id,name,slug,tagline,accent").order("name"),
    ]);

    if (comicsError) console.error("❌ [Shop] Comics query error:", comicsError);
    else console.log("✅ [Shop] Comics query successful!");

    if (publishersError) console.error("❌ [Shop] Publishers query error:", publishersError);
    else console.log("✅ [Shop] Publishers query successful!");

    console.log("🛒 [Shop] Step 6: Raw comics data length:", comicsRaw?.length ?? 0);
    console.log("🛒 [Shop] Step 6: Raw publishers data length:", publishers?.length ?? 0);

    let comics = (comicsRaw ?? []) as Comic[];

    // Filter by publisher (client‑side because publisher is nested)
    if (data.publisher) {
      console.log("🛒 [Shop] Step 8: Filtering by publisher slug:", data.publisher);
      comics = comics.filter((c) => c.publisher?.slug === data.publisher);
    }

    // Derive unique genres and formats from the filtered result
    const genres = Array.from(
      new Set(comics.map((c) => c.genre).filter(Boolean) as string[])
    ).sort();
    const formats = Array.from(
      new Set(comics.map((c) => c.format).filter(Boolean) as string[])
    ).sort();

    const uniquePublishers = deduplicateByKey(
      (publishers ?? []) as Publisher[],
      "slug"
    );

    const shopData: ShopData = {
      comics,
      publishers: uniquePublishers,
      genres,
      formats,
      total: comics.length,
    };

    console.log("🛒 [Shop] ====== COMPLETED getShopData ======");
    return shopData;
  });

// ----------------------------------------------------------------------
// COMIC DETAIL + RELATED
// ----------------------------------------------------------------------

export const getComicBySlug = createServerFn({ method: "GET" })
  .inputValidator((input: { slug: string }) => input)
  .handler(async ({ data }): Promise<{ comic: Comic | null; related: Comic[] }> => {
    console.log("🔍 [Comic] ====== STARTING getComicBySlug ======");
    console.log("🔍 [Comic] Slug:", data.slug);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Fetch comic by slug – only if published
    console.log("🔍 [Comic] Step 2: Fetching published comic by slug:", data.slug);
    const { data: comicRaw, error: comicError } = await supabaseAdmin
      .from("comics")
      .select(COMIC_COLS)
      .eq("slug", data.slug)
      .eq("status", "published")
      .maybeSingle();

    if (comicError) {
      console.error("❌ [Comic] Comic query error:", comicError);
    } else {
      console.log("✅ [Comic] Comic query successful!");
    }

    console.log("🔍 [Comic] Step 3: Raw comic data:", comicRaw ? "Found" : "Not found");
    if (comicRaw) {
      console.log("🔍 [Comic] Step 3: Comic title:", (comicRaw as any).title);
      console.log("🔍 [Comic] Step 3: Comic publisher:", (comicRaw as any).publisher);
    }

    const comic = (comicRaw ?? null) as Comic | null;
    console.log("🔍 [Comic] Step 4: Comic cast to type:", comic ? "Success" : "null");

    let related: Comic[] = [];
    if (comic) {
      console.log("🔍 [Comic] Step 5: Fetching related published comics...");
      let relQuery = supabaseAdmin
        .from("comics")
        .select(COMIC_COLS)
        .eq("status", "published")
        .neq("slug", data.slug);
      
      if (comic.genre) {
        console.log("🔍 [Comic] Step 5: Filtering related by genre:", comic.genre);
        relQuery = relQuery.eq("genre", comic.genre);
      }
      
      const { data: relRaw, error: relError } = await relQuery.limit(4);
      
      if (relError) {
        console.error("❌ [Comic] Related query error:", relError);
      } else {
        console.log("✅ [Comic] Related query successful!");
      }
      
      related = (relRaw ?? []) as Comic[];
      console.log("🔍 [Comic] Step 6: Related comics found:", related.length);
    } else {
      console.warn("⚠️ [Comic] Step 5: No comic found, skipping related query");
    }

    const result = { comic, related };
    console.log("🔍 [Comic] Step 7: Final result:", {
      comic: comic ? comic.title : null,
      relatedCount: related.length
    });

    console.log("🔍 [Comic] ====== COMPLETED getComicBySlug ======");
    return result;
  });