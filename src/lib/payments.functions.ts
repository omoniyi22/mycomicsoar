import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { sendPurchaseConfirmation } from "./email.server";
import { resolveUrl } from "./reader.functions";

const FALLBACK_NGN_RATE = 1500;
const FALLBACK_EUR_RATE = 0.92;

type Currency = "NGN" | "USD" | "EUR";

type CartLineRow = {
  id: string;
  quantity: number;
  comic: {
    id: string;
    title: string;
    price: number;
    price_ngn: number | null;
    price_eur: number | null;
  } | null;
};

/* ---------- Helpers with logging ---------- */

async function loadCart(supabase: any) {
  console.log("[PAYMENTS] loadCart: fetching cart items");
  const { data, error } = await supabase
    .from("cart_items")
    .select("id,quantity,comic:comics(id,title,price,price_ngn,price_eur)")
    .order("created_at", { ascending: false });
  if (error) {
    console.error("[PAYMENTS] loadCart error:", error);
    throw error;
  }
  const lines = (data ?? []) as unknown as CartLineRow[];
  const filtered = lines.filter((l) => l.comic);
  console.log(`[PAYMENTS] loadCart: found ${filtered.length} valid items (out of ${lines.length})`);
  return filtered;
}

function priceFor(
  c: { price: number; price_ngn: number | null; price_eur: number | null },
  currency: Currency,
) {
  if (currency === "NGN") {
    const val = c.price_ngn && c.price_ngn > 0
      ? Number(c.price_ngn)
      : Math.round(Number(c.price) * FALLBACK_NGN_RATE);
    console.log(`[PAYMENTS] priceFor: NGN price = ${val} (base USD ${c.price})`);
    return val;
  }
  if (currency === "EUR") {
    const val = c.price_eur && c.price_eur > 0
      ? Number(c.price_eur)
      : Number((Number(c.price) * FALLBACK_EUR_RATE).toFixed(2));
    console.log(`[PAYMENTS] priceFor: EUR price = ${val} (base USD ${c.price})`);
    return val;
  }
  console.log(`[PAYMENTS] priceFor: USD price = ${c.price}`);
  return Number(c.price);
}

// ─── All writes use supabaseAdmin (bypasses RLS) ──────────────────────────────

async function createPendingOrder(
  userId: string,
  lines: CartLineRow[],
  currency: Currency,
  email: string | null,
  provider: "paystack" | "flutterwave",
  reference: string,
) {
  console.log(`[PAYMENTS] createPendingOrder: user ${userId}, provider ${provider}, ref ${reference}, currency ${currency}`);
  const total = lines.reduce((s, l) => s + priceFor(l.comic!, currency) * l.quantity, 0);
  console.log(`[PAYMENTS] createPendingOrder: computed total = ${total} ${currency}`);

  const { data: order, error } = await supabaseAdmin
    .from("orders")
    .insert({
      user_id: userId,
      total,
      currency,
      email,
      status: "pending",
      payment_provider: provider,
      payment_reference: reference,
    })
    .select("id")
    .single();
  if (error || !order) {
    console.error("[PAYMENTS] createPendingOrder: insert order failed", error);
    throw error ?? new Error("Could not create order");
  }
  console.log(`[PAYMENTS] createPendingOrder: order created with id ${order.id}`);

  const orderItems = lines.map((l) => ({
    order_id: order.id,
    comic_id: l.comic!.id,
    title: l.comic!.title,
    unit_price: priceFor(l.comic!, currency),
    quantity: l.quantity,
  }));
  const { error: itemsError } = await supabaseAdmin.from("order_items").insert(orderItems);
  if (itemsError) {
    console.error("[PAYMENTS] createPendingOrder: insert order_items failed", itemsError);
    throw itemsError;
  }
  console.log(`[PAYMENTS] createPendingOrder: inserted ${orderItems.length} order_items`);
  return { orderId: order.id, total };
}

async function finalizeOrder(
  userId: string,
  reference: string,
  paid: boolean,
  detail: string,
) {
  console.log(`[PAYMENTS] finalizeOrder: user ${userId}, ref ${reference}, paid=${paid}, detail=${detail}`);

  // Fetch the order (admin client, but still filter by user_id and reference)
  const { data: order, error: fetchError } = await supabaseAdmin
    .from("orders")
    .select("id,total,currency,status,email")
    .eq("payment_reference", reference)
    .eq("user_id", userId)
    .maybeSingle();

  if (fetchError) {
    console.error("[PAYMENTS] finalizeOrder: fetch order error", fetchError);
    throw fetchError;
  }
  if (!order) {
    console.error(`[PAYMENTS] finalizeOrder: Order not found for ref ${reference}, user ${userId}`);
    throw new Error("Order not found");
  }
  console.log(`[PAYMENTS] finalizeOrder: found order ${order.id}, status ${order.status}`);

  // Already completed – idempotent
  if (order.status === "completed") {
    console.log(`[PAYMENTS] finalizeOrder: order already completed, returning early`);
    return {
      orderId: order.id,
      total: Number(order.total),
      currency: order.currency,
      alreadyCompleted: true,
    };
  }

  // Payment failed
  if (!paid) {
    console.log(`[PAYMENTS] finalizeOrder: payment not successful, marking order as failed`);
    const { error: updateError } = await supabaseAdmin
      .from("orders")
      .update({ status: "failed", status_detail: detail })
      .eq("id", order.id);
    if (updateError) {
      console.error("[PAYMENTS] finalizeOrder: update to failed error", updateError);
      throw updateError;
    }
    throw new Error(`Payment ${detail}`);
  }

  // Payment succeeded: atomically update status to completed only if still pending
  console.log("[PAYMENTS] finalizeOrder: attempting to claim order (update to completed)");
  const { data: updatedRows, error: updateStatusError } = await supabaseAdmin
    .from("orders")
    .update({ status: "completed", status_detail: detail })
    .eq("id", order.id)
    .eq("status", "pending")   // only if still pending
    .select("id");             // return updated rows to check count

  if (updateStatusError) {
    console.error("[PAYMENTS] finalizeOrder: conditional status update error", updateStatusError);
    throw updateStatusError;
  }

  // If no rows were updated, another call already completed this order
  if (!updatedRows || updatedRows.length === 0) {
    console.log("[PAYMENTS] finalizeOrder: order was already completed by another process, returning");
    const { data: current } = await supabaseAdmin
      .from("orders")
      .select("status")
      .eq("id", order.id)
      .single();
    console.log(`[PAYMENTS] finalizeOrder: current order status: ${current?.status}`);
    return {
      orderId: order.id,
      total: Number(order.total),
      currency: order.currency,
      alreadyCompleted: true,
    };
  }

  console.log(`[PAYMENTS] finalizeOrder: successfully claimed order, proceeding with purchases`);

  // Process purchases
  const { data: items, error: itemsError } = await supabaseAdmin
    .from("order_items")
    .select("comic_id,unit_price")
    .eq("order_id", order.id);
  if (itemsError) {
    console.error("[PAYMENTS] finalizeOrder: fetch order_items error", itemsError);
    throw itemsError;
  }
  console.log(`[PAYMENTS] finalizeOrder: found ${items?.length || 0} order_items`);

  // Insert/upsert purchase records
  for (const it of items ?? []) {
    console.log(`[PAYMENTS] finalizeOrder: upserting purchase for comic ${it.comic_id}, price ${it.unit_price}`);
    const { error: upsertError } = await supabaseAdmin
      .from("purchases")
      .upsert(
        { user_id: userId, comic_id: it.comic_id, price_paid: it.unit_price },
        { onConflict: "user_id, comic_id", ignoreDuplicates: true }
      );
    if (upsertError) {
      console.error("[PAYMENTS] finalizeOrder: upsert purchase error", upsertError);
      throw upsertError;
    }
  }

  // Clear cart
  const { error: clearCartError } = await supabaseAdmin
    .from("cart_items")
    .delete()
    .eq("user_id", userId);
  if (clearCartError) {
    console.error("[PAYMENTS] finalizeOrder: clear cart error", clearCartError);
    // Not critical – log but don't throw
  }

  console.log(`[PAYMENTS] finalizeOrder: completed successfully for order ${order.id}`);

  // ─── Send confirmation email ──────────────────────────────────────
  try {
    const { data: orderWithItems } = await supabaseAdmin
      .from("orders")
      .select("email, items:order_items(comic_id, title, unit_price, quantity)")
      .eq("id", order.id)
      .single();

    if (orderWithItems?.email && orderWithItems.items?.length) {
      const emailItems = await Promise.all(
        orderWithItems.items.map(async (it: any) => {
          const { data: comic } = await supabaseAdmin
            .from("comics")
            .select("pdf_path, pdf_path_landscape, cover_url")
            .eq("id", it.comic_id)
            .maybeSingle();

          return {
            title: it.title,
            comicId: it.comic_id,
            unitPrice: it.unit_price,
            quantity: it.quantity,
            portraitPath: comic?.pdf_path ?? null,
            landscapePath: comic?.pdf_path_landscape ?? null,
            coverUrl: comic?.cover_url ?? null,
          };
        })
      );

      const validItems = emailItems.filter(
        (item) => item.portraitPath || item.landscapePath
      );

      if (validItems.length > 0) {
        await sendPurchaseConfirmation(
          orderWithItems.email,
          order.id,
          validItems,
          Number(order.total),
          order.currency
        );
        console.log(`[PAYMENTS] Confirmation email sent to ${orderWithItems.email}`);
      } else {
        console.warn("[PAYMENTS] No PDFs found for email items");
      }
    }
  } catch (emailErr) {
    console.error("[PAYMENTS] Email sending failed:", emailErr);
  }

  return {
    orderId: order.id,
    total: Number(order.total),
    currency: order.currency,
    alreadyCompleted: false,
    email: order.email,
  };
}

/* ---------- Paystack (NGN) ---------- */

export const initPaystack = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: { email?: string; callbackUrl: string }) => input)
  .handler(async ({ data, context }) => {
    console.log("[PAYMENTS] initPaystack: start");
    const key = process.env.PAYSTACK_SECRET_KEY;
    if (!key) {
      console.error("[PAYMENTS] initPaystack: PAYSTACK_SECRET_KEY not set");
      throw new Error("Paystack is not configured.");
    }
    const { supabase, userId, claims } = context;
    console.log(`[PAYMENTS] initPaystack: userId ${userId}, email from input ${data.email}, claims email ${(claims as any)?.email}`);

    const lines = await loadCart(supabase);
    if (lines.length === 0) {
      console.error("[PAYMENTS] initPaystack: cart empty");
      throw new Error("Your cart is empty.");
    }
    const email = data.email || (claims as any)?.email || `user-${userId}@vault.local`;
    const total = lines.reduce((s, l) => s + priceFor(l.comic!, "NGN") * l.quantity, 0);
    console.log(`[PAYMENTS] initPaystack: total ${total} NGN`);
    const reference = `cs_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    console.log(`[PAYMENTS] initPaystack: generated reference ${reference}`);

    await createPendingOrder(userId, lines, "NGN", email, "paystack", reference);

    console.log("[PAYMENTS] initPaystack: calling Paystack initialize API");
    let res;
    try {
      res = await fetch("https://api.paystack.co/transaction/initialize", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
          "User-Agent": "ComicSoar/1.0 (https://comicsoar.com)",
          "Accept": "application/json",
        },
        body: JSON.stringify({
          email,
          amount: Math.round(total * 100),
          currency: "NGN",
          reference,
          callback_url: data.callbackUrl,
        }),
      });
    } catch (fetchErr) {
      console.error("[PAYMENTS] initPaystack: network error", fetchErr);
      throw new Error("Network error while contacting Paystack");
    }

    // Check for non-OK status and read response as text
    if (!res.ok) {
      const text = await res.text();
      console.error(`[PAYMENTS] initPaystack: API returned ${res.status}`, text);
      // If it's a Cloudflare challenge, give a clear message
      if (res.status === 403 && text.includes("Just a moment")) {
        throw new Error("Paystack is blocking our server request. Please try again later or contact support.");
      }
      throw new Error(`Paystack API error: ${res.status} - ${text.substring(0, 200)}`);
    }

    // Parse JSON, handle possible parsing errors
    let json;
    try {
      json = await res.json();
    } catch (parseErr) {
      const text = await res.text();
      console.error("[PAYMENTS] initPaystack: failed to parse JSON", parseErr);
      throw new Error(`Paystack response not JSON: ${text.substring(0, 200)}`);
    }

    console.log(`[PAYMENTS] initPaystack: Paystack response status ${res.status}, ok ${res.ok}`);
    if (!json?.status) {
      console.error("[PAYMENTS] initPaystack: Paystack error", json);
      throw new Error(json?.message || "Paystack init failed");
    }
    console.log(`[PAYMENTS] initPaystack: success, auth URL ${json.data.authorization_url}`);
    return { authorizationUrl: json.data.authorization_url as string, reference };
  });

export const verifyPaystack = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: { reference: string }) => input)
  .handler(async ({ data, context }) => {
    console.log(`[PAYMENTS] verifyPaystack: verifying reference ${data.reference}`);
    const key = process.env.PAYSTACK_SECRET_KEY;
    if (!key) {
      console.error("[PAYMENTS] verifyPaystack: PAYSTACK_SECRET_KEY not set");
      throw new Error("Paystack is not configured.");
    }
    const { userId } = context;

    let res;
    try {
      res = await fetch(
        `https://api.paystack.co/transaction/verify/${encodeURIComponent(data.reference)}`,
        {
          headers: {
            Authorization: `Bearer ${key}`,
            "User-Agent": "ComicSoar/1.0 (https://comicsoar.com)",
            "Accept": "application/json",
          }
        },
      );
    } catch (fetchErr) {
      console.error("[PAYMENTS] verifyPaystack: network error", fetchErr);
      throw new Error("Network error while verifying Paystack");
    }

    if (!res.ok) {
      const text = await res.text();
      console.error(`[PAYMENTS] verifyPaystack: API returned ${res.status}`, text);
      if (res.status === 403 && text.includes("Just a moment")) {
        throw new Error("Paystack is blocking our verification request. Please try again later.");
      }
      throw new Error(`Paystack API error: ${res.status} - ${text.substring(0, 200)}`);
    }

    let json;
    try {
      json = await res.json();
    } catch (parseErr) {
      const text = await res.text();
      console.error("[PAYMENTS] verifyPaystack: failed to parse JSON", parseErr);
      throw new Error(`Paystack response not JSON: ${text.substring(0, 200)}`);
    }

    console.log(`[PAYMENTS] verifyPaystack: Paystack verify response status ${res.status}, ok ${res.ok}`);
    console.log(`[PAYMENTS] verifyPaystack: reference=${data.reference}, status=${json?.data?.status}, paid=${json?.data?.status === 'success'}`);
    const ok = res.ok && json?.status && json?.data?.status === "success";
    console.log(`[PAYMENTS] verifyPaystack: payment successful? ${ok}`);
    return finalizeOrder(userId, data.reference, ok, json?.data?.status ?? "failed");
  });

export async function handlePaystackWebhook(body: any, signature?: string) {
  console.log("[PAYMENTS] handlePaystackWebhook: received webhook");
  console.log(`[PAYMENTS] handlePaystackWebhook: body: ${JSON.stringify(body)}`);
  const event = body?.event;
  const data = body?.data;
  if (event === "charge.success" && data) {
    const reference = data.reference;
    console.log(`[PAYMENTS] handlePaystackWebhook: charge.success for reference ${reference}`);
  } else {
    console.log(`[PAYMENTS] handlePaystackWebhook: ignored event ${event}`);
  }
}

/* ---------- Flutterwave (USD / EUR) ---------- */

export const initFlutterwave = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: { email?: string; currency: "USD" | "EUR"; successUrl: string }) => input)
  .handler(async ({ data, context }) => {
    console.log("[PAYMENTS] initFlutterwave: start");
    const key = process.env.FLUTTERWAVE_SECRET_KEY;
    if (!key) {
      console.error("[PAYMENTS] initFlutterwave: FLUTTERWAVE_SECRET_KEY not set");
      throw new Error("Flutterwave is not configured.");
    }
    const { supabase, userId, claims } = context;
    console.log(`[PAYMENTS] initFlutterwave: userId ${userId}, currency ${data.currency}`);

    const lines = await loadCart(supabase);
    if (lines.length === 0) {
      console.error("[PAYMENTS] initFlutterwave: cart empty");
      throw new Error("Your cart is empty.");
    }
    const email = data.email || (claims as any)?.email || `user-${userId}@comicsoar.local`;
    const total = lines.reduce((s, l) => s + priceFor(l.comic!, data.currency) * l.quantity, 0);
    console.log(`[PAYMENTS] initFlutterwave: total ${total} ${data.currency}`);
    const reference = `cs_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    console.log(`[PAYMENTS] initFlutterwave: generated reference ${reference}`);

    await createPendingOrder(userId, lines, data.currency, email, "flutterwave", reference);

    console.log("[PAYMENTS] initFlutterwave: calling Flutterwave payments API");
    let res;
    try {
      res = await fetch("https://api.flutterwave.com/v3/payments", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
          "User-Agent": "ComicSoar/1.0 (https://comicsoar.com)",
          "Accept": "application/json",
        },
        body: JSON.stringify({
          tx_ref: reference,
          amount: Number(total.toFixed(2)),
          currency: data.currency,
          redirect_url: data.successUrl,
          customer: { email },
          customizations: { title: "ComicSoar", description: `${lines.length} issue(s)` },
        }),
      });
    } catch (fetchErr) {
      console.error("[PAYMENTS] initFlutterwave: network error", fetchErr);
      throw new Error("Network error while contacting Flutterwave");
    }

    if (!res.ok) {
      const text = await res.text();
      console.error(`[PAYMENTS] initFlutterwave: API returned ${res.status}`, text);
      if (res.status === 403 && text.includes("Just a moment")) {
        throw new Error("Flutterwave is blocking our server request. Please try again later or contact support.");
      }
      throw new Error(`Flutterwave API error: ${res.status} - ${text.substring(0, 200)}`);
    }

    let json;
    try {
      json = await res.json();
    } catch (parseErr) {
      const text = await res.text();
      console.error("[PAYMENTS] initFlutterwave: failed to parse JSON", parseErr);
      throw new Error(`Flutterwave response not JSON: ${text.substring(0, 200)}`);
    }

    console.log(`[PAYMENTS] initFlutterwave: Flutterwave response status ${res.status}, ok ${res.ok}`);
    if (!json?.status || json.status !== "success" || !json?.data?.link) {
      console.error("[PAYMENTS] initFlutterwave: Flutterwave error", json);
      throw new Error(json?.message || "Flutterwave init failed");
    }
    console.log(`[PAYMENTS] initFlutterwave: success, checkout URL ${json.data.link}`);
    return { checkoutUrl: json.data.link as string, reference };
  });

export const verifyFlutterwave = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: { reference: string; transactionId?: string }) => input)
  .handler(async ({ data, context }) => {
    console.log(`[PAYMENTS] verifyFlutterwave: verifying reference ${data.reference}, txId ${data.transactionId}`);
    const key = process.env.FLUTTERWAVE_SECRET_KEY;
    if (!key) {
      console.error("[PAYMENTS] verifyFlutterwave: FLUTTERWAVE_SECRET_KEY not set");
      throw new Error("Flutterwave is not configured.");
    }
    const { userId } = context;

    const url = data.transactionId
      ? `https://api.flutterwave.com/v3/transactions/${encodeURIComponent(data.transactionId)}/verify`
      : `https://api.flutterwave.com/v3/transactions/verify_by_reference?tx_ref=${encodeURIComponent(data.reference)}`;

    console.log(`[PAYMENTS] verifyFlutterwave: calling ${url}`);
    let res;
    try {
      res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${key}`,
          "User-Agent": "ComicSoar/1.0 (https://comicsoar.com)",
          "Accept": "application/json",
          "Cache-Control": "no-cache"


        }
      });
    } catch (fetchErr) {
      console.error("[PAYMENTS] verifyFlutterwave: network error", fetchErr);
      throw new Error("Network error while verifying Flutterwave");
    }

    if (!res.ok) {
      const text = await res.text();
      console.error(`[PAYMENTS] verifyFlutterwave: API returned ${res.status}`, text);
      if (res.status === 403 && text.includes("Just a moment")) {
        throw new Error("Flutterwave is blocking our verification request. Please try again later.");
      }
      throw new Error(`Flutterwave API error: ${res.status} - ${text.substring(0, 200)}`);
    }

    let json;
    try {
      json = await res.json();
    } catch (parseErr) {
      const text = await res.text();
      console.error("[PAYMENTS] verifyFlutterwave: failed to parse JSON", parseErr);
      throw new Error(`Flutterwave response not JSON: ${text.substring(0, 200)}`);
    }

    console.log(`[PAYMENTS] verifyFlutterwave: response status ${res.status}, ok ${res.ok}`);
    console.log(`[PAYMENTS] verifyFlutterwave: reference=${data.reference}, status=${json?.data?.status}`);
    const paid =
      res.ok &&
      json?.status === "success" &&
      (json?.data?.status === "successful" || json?.data?.status === "success");
    console.log(`[PAYMENTS] verifyFlutterwave: payment successful? ${paid}`);
    return finalizeOrder(userId, data.reference, paid, json?.data?.status ?? "failed");
  });

export async function handleFlutterwaveWebhook(body: any, signature?: string) {
  console.log("[PAYMENTS] handleFlutterwaveWebhook: received webhook");
  console.log(`[PAYMENTS] handleFlutterwaveWebhook: body: ${JSON.stringify(body)}`);
  const event = body?.event;
  const data = body?.data;
  if (event === "charge.completed" && data) {
    const tx_ref = data.tx_ref;
    const status = data.status;
    console.log(`[PAYMENTS] handleFlutterwaveWebhook: charge.completed for tx_ref ${tx_ref}, status ${status}`);
  } else {
    console.log(`[PAYMENTS] handleFlutterwaveWebhook: ignored event ${event}`);
  }
}