import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { getCart, updateCartQty, removeFromCart } from "@/lib/cart.functions";
import { resolveCover } from "@/lib/covers";
import { SiteHeader, SiteFooter } from "@/components/site-chrome";
import { useCurrency } from "@/lib/currency";
import { Minus, Plus, Trash2, ShoppingBag, ArrowRight } from "lucide-react";

const cartQuery = queryOptions({ queryKey: ["cart"], queryFn: () => getCart() });

export const Route = createFileRoute("/_authenticated/cart")({
  loader: ({ context }) => context.queryClient.ensureQueryData(cartQuery),
  head: () => ({ meta: [{ title: "Your Cart — ComicSoar" }] }),
  errorComponent: ({ error }) => <div className="p-10 text-center text-sm text-muted-foreground">{error.message}</div>,
  component: CartPage,
});

function CartPage() {
  const fetchCart = useServerFn(getCart);
  const { data } = useSuspenseQuery({ ...cartQuery, queryFn: () => fetchCart() });
  const update = useServerFn(updateCartQty);
  const remove = useServerFn(removeFromCart);
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { format, resolveAmount, currency } = useCurrency();
  const [busy, setBusy] = useState<string | null>(null);

  async function changeQty(id: string, qty: number) {
    setBusy(id);
    await update({ data: { id, quantity: qty } });
    await qc.invalidateQueries({ queryKey: ["cart"] });
    await qc.invalidateQueries({ queryKey: ["cart-count"] });
    setBusy(null);
  }

  async function removeItem(id: string) {
    setBusy(id);
    await remove({ data: { id } });
    await qc.invalidateQueries({ queryKey: ["cart"] });
    await qc.invalidateQueries({ queryKey: ["cart-count"] });
    setBusy(null);
  }

  const subtotal = data.lines.reduce(
    (s, l) => s + resolveAmount(l.comic.price, l.comic as any) * l.quantity,
    0,
  );
  const totalLabel =
    currency === "NGN"
      ? `₦${subtotal.toLocaleString("en-NG", { maximumFractionDigits: 0 })}`
      : currency === "EUR"
      ? `€${subtotal.toFixed(2)}`
      : `$${subtotal.toFixed(2)}`;

  const gateway = currency === "NGN" ? "Paystack" : "Flutterwave";

  return (
    <div className="min-h-screen bg-vignette">
      <SiteHeader />
      <main className="container-tight py-12">
        <header className="mb-10">
          <div className="text-xs uppercase tracking-[0.25em] text-gold">Your cart</div>
          <h1 className="mt-2 font-display text-4xl text-foreground">Review your collection</h1>
        </header>

        {data.lines.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-16 text-center">
            <ShoppingBag className="mx-auto h-8 w-8 text-gold" />
            <p className="mt-4 text-muted-foreground">Your cart is empty.</p>
            <Link to="/shop" className="mt-6 inline-block rounded-md bg-gold px-5 py-2.5 text-sm font-semibold text-primary-foreground">
              Browse the catalog
            </Link>
          </div>
        ) : (
          <div className="grid lg:grid-cols-[1fr_360px] gap-10">
            <ul className="space-y-4">
              {data.lines.map((l) => (
                <li key={l.id} className="flex gap-4 rounded-lg border border-border bg-card p-4">
                  <img src={resolveCover(l.comic.cover_url)} alt="" className="h-28 w-20 rounded-md object-cover" />
                  <div className="flex-1 min-w-0">
                    <Link to="/comics/$slug" params={{ slug: l.comic.slug }} className="font-display text-lg text-foreground hover:text-gold line-clamp-1">
                      {l.comic.title}
                    </Link>
                    {/* <p className="text-xs text-muted-foreground">{l.comic.writer} · {l.comic.publisher?.name}</p> */}
                    <p className="text-xs text-muted-foreground">{"Comic Soar"} </p>
                    <div className="mt-3 flex items-center gap-3">
                      {/* <div className="inline-flex items-center rounded-md border border-border">
                        <button disabled={busy === l.id} onClick={() => changeQty(l.id, l.quantity - 1)} className="p-1.5 hover:text-gold disabled:opacity-50"><Minus className="h-3.5 w-3.5" /></button>
                        <span className="px-3 text-sm tabular-nums">{l.quantity}</span>
                        <button disabled={busy === l.id} onClick={() => changeQty(l.id, l.quantity + 1)} className="p-1.5 hover:text-gold disabled:opacity-50"><Plus className="h-3.5 w-3.5" /></button>
                      </div> */}
                      <button disabled={busy === l.id} onClick={() => removeItem(l.id)} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-red-400 disabled:opacity-50">
                        <Trash2 className="h-3.5 w-3.5" /> 
                      </button>
                    </div>
                    
                  </div>
                  <div className="text-right">
                    <div className="font-mono text-gold">{format(l.comic.price * l.quantity, l.comic as any)}</div>
                    <div className="text-[10px] text-muted-foreground">{format(l.comic.price, l.comic as any)} </div>
                  </div>
                </li>
              ))}
            </ul>

            <aside className="h-fit rounded-xl border border-gold-soft bg-card p-6 sticky top-24">
              <h2 className="font-display text-2xl text-foreground">Order summary</h2>
              <dl className="mt-4 space-y-2 text-sm">
                <div className="flex justify-between"><dt className="text-muted-foreground">Subtotal</dt><dd className="font-mono">{totalLabel}</dd></div>
                <div className="flex justify-between"><dt className="text-muted-foreground">Delivery</dt><dd className="font-mono text-gold">Digital · Free</dd></div>
                <div className="flex justify-between border-t border-border pt-3 text-base"><dt className="font-display">Total</dt><dd className="font-display text-gold">{totalLabel}</dd></div>
              </dl>
              <button onClick={() => navigate({ to: "/checkout" })} className="mt-6 w-full inline-flex items-center justify-center gap-2 rounded-md bg-gold px-5 py-3 text-sm font-semibold text-primary-foreground shadow-glow">
                Checkout <ArrowRight className="h-4 w-4" />
              </button>
              <p className="mt-3 text-[11px] text-center text-muted-foreground">
                Paying in {currency} via {gateway}.
              </p>
            </aside>
          </div>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
