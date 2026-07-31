import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Comic } from "./catalog.functions";

export type CartLine = {
  id: string;
  quantity: number;
  comic: Comic;
};

const COMIC_COLS =
  "id,title,slug,writer,price_eur,artist,cover_url,price,price_ngn,rating,release_date,format,genre,synopsis,is_new,is_trending,is_bestseller,is_featured,is_graphic_novel,is_manga,publisher:publishers(name,slug,accent)";

export const getCart = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;

    // Join with comics table and filter by status = 'published'
    const { data, error } = await supabase
      .from("cart_items")
      .select(`
        id,
        quantity,
        comic:comics!inner(${COMIC_COLS})
      `)
      .eq("comic.status", "published")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[getCart] Error:", error);
      return { lines: [], subtotal: 0 };
    }

    const lines = ((data ?? []) as unknown as CartLine[]).filter((l) => l.comic);
    const subtotal = lines.reduce((s, l) => s + l.comic.price * l.quantity, 0);
    return { lines, subtotal };
  });

export const addToCart = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { comicId: string }) => input)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Check that the comic is published before adding
    const { data: comic, error: comicError } = await supabase
      .from("comics")
      .select("id")
      .eq("id", data.comicId)
      .eq("status", "published")
      .maybeSingle();

    if (comicError || !comic) {
      throw new Error("Comic not available for purchase.");
    }

    const { data: existing } = await supabase
      .from("cart_items")
      .select("id,quantity")
      .eq("user_id", userId)
      .eq("comic_id", data.comicId)
      .maybeSingle();

    if (existing) {
      await supabase
        .from("cart_items")
        .update({ quantity: existing.quantity + 1 })
        .eq("id", existing.id);
    } else {
      await supabase.from("cart_items").insert({ user_id: userId, comic_id: data.comicId, quantity: 1 });
    }
    return { ok: true };
  });

export const updateCartQty = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string; quantity: number }) => input)
  .handler(async ({ data, context }) => {
    if (data.quantity <= 0) {
      await context.supabase.from("cart_items").delete().eq("id", data.id);
    } else {
      await context.supabase.from("cart_items").update({ quantity: data.quantity }).eq("id", data.id);
    }
    return { ok: true };
  });

export const removeFromCart = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ data, context }) => {
    await context.supabase.from("cart_items").delete().eq("id", data.id);
    return { ok: true };
  });

export const getCartCount = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    // Count only cart items that belong to published comics
    const { data, error } = await context.supabase
      .from("cart_items")
      .select("quantity, comic:comics(status)")
      .eq("comic.status", "published");

    if (error) return { count: 0 };
    const count = (data ?? []).reduce((s, r) => s + (r.quantity ?? 0), 0);
    return { count };
  });

export const checkout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { email?: string }) => input ?? {})
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Fetch cart items with published comics only
    const { data: lines, error } = await supabase
      .from("cart_items")
      .select(`
        id,
        quantity,
        comic:comics!inner(id,title,price)
      `)
      .eq("comic.status", "published")
      .order("created_at", { ascending: false });

    if (error) throw new Error("Failed to fetch cart");

    const items = (lines ?? []) as unknown as Array<{
      id: string;
      quantity: number;
      comic: { id: string; title: string; price: number } | null;
    }>;

    const real = items.filter((i) => i.comic);
    if (real.length === 0) throw new Error("Your cart is empty or contains only unavailable comics.");

    const total = real.reduce((s, l) => s + l.comic!.price * l.quantity, 0);

    const { data: order, error: orderErr } = await supabase
      .from("orders")
      .insert({ user_id: userId, total, email: data.email ?? null, status: "completed" })
      .select("id")
      .single();

    if (orderErr || !order) throw orderErr ?? new Error("Could not create order");

    await supabase.from("order_items").insert(
      real.map((l) => ({
        order_id: order.id,
        comic_id: l.comic!.id,
        title: l.comic!.title,
        unit_price: l.comic!.price,
        quantity: l.quantity,
      })),
    );

    // Grant to library (ignore conflicts if already owned)
    for (const l of real) {
      await supabase
        .from("purchases")
        .insert({ user_id: userId, comic_id: l.comic!.id, price_paid: l.comic!.price })
        .select()
        .maybeSingle();
    }

    // Clear cart (only the items we processed)
    await supabase.from("cart_items").delete().in(
      "id",
      real.map((l) => l.id),
    );

    return { orderId: order.id, total };
  });