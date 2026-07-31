import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { getCart } from "@/lib/cart.functions";
import { initPaystack, initFlutterwave } from "@/lib/payments.functions";
import { useCurrency } from "@/lib/currency";
import { SiteHeader, SiteFooter } from "@/components/site-chrome";
import { Loader2, ShieldCheck, CreditCard } from "lucide-react";

const cartQuery = queryOptions({ queryKey: ["cart"], queryFn: () => getCart() });

export const Route = createFileRoute("/_authenticated/checkout")({
  loader: ({ context }) => context.queryClient.ensureQueryData(cartQuery),
  head: () => ({ meta: [{ title: "Checkout — ComicSoar" }] }),
  component: CheckoutPage,
});

function CheckoutPage() {
  const fetchCart = useServerFn(getCart);
  const { data } = useSuspenseQuery({ ...cartQuery, queryFn: () => fetchCart() });
  const startPaystack = useServerFn(initPaystack);
  const startFlutterwave = useServerFn(initFlutterwave);
  const navigate = useNavigate();
  const { currency, resolveAmount, format } = useCurrency();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const subtotal = data.lines.reduce(
    (s, l) => s + resolveAmount(l.comic.price, l.comic as any) * l.quantity,
    0,
  );

  const gateway = currency === "NGN" ? "Paystack" : "Flutterwave";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      if (currency === "NGN") {
        const { authorizationUrl } = await startPaystack({
          data: {
            email: email || undefined,
            callbackUrl: `${window.location.origin}/checkout/success?provider=paystack`,
          },
        });
        window.location.href = authorizationUrl;
      } else {
        const { checkoutUrl } = await startFlutterwave({
          data: {
            email: email || undefined,
            currency,
            successUrl: `${window.location.origin}/checkout/success?provider=flutterwave`,
          },
        });
        window.location.href = checkoutUrl;
      }
    } catch (e) {
      console.log({ e })
      setErr(e instanceof Error ? e.message : "Checkout failed");
      setBusy(false);
    }
  }

  if (data.lines.length === 0) {
    return (
      <div className="min-h-screen bg-vignette">
        <SiteHeader />
        <main className="container-tight py-20 text-center">
          <p className="text-muted-foreground">Your cart is empty.</p>
          <Link to="/shop" className="mt-4 inline-block text-gold hover:underline">Browse the catalog →</Link>
        </main>
        <SiteFooter />
      </div>
    );
  }

  const totalLabel =
    currency === "NGN"
      ? `₦${subtotal.toLocaleString("en-NG", { maximumFractionDigits: 0 })}`
      : currency === "EUR"
        ? `€${subtotal.toFixed(2)}`
        : `$${subtotal.toFixed(2)}`;

  return (
    <div className="min-h-screen bg-vignette">
      <SiteHeader />
      <main className="container-tight py-12 max-w-3xl">
        <header className="mb-8">
          <div className="text-xs uppercase tracking-[0.25em] text-gold">Final step</div>
          <h1 className="mt-2 font-display text-4xl text-foreground">Checkout</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Paying in {currency} via {gateway}.
          </p>
        </header>

        <form onSubmit={submit} className="grid md:grid-cols-[1fr_300px] gap-8">
          <div className="space-y-5">
            <section className="rounded-lg border border-border bg-card p-5">
              <h2 className="font-display text-xl text-foreground">Delivery email</h2>
              <p className="text-xs text-muted-foreground mt-1">Receipt and download link go here.</p>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@inbox.com"
                className="mt-3 w-full rounded-md border border-border bg-background/40 px-3 py-2 text-sm focus:outline-none focus:border-gold-soft"
              />
            </section>

            <section className="rounded-lg border border-border bg-card p-5">
              <h2 className="font-display text-xl text-foreground">Payment</h2>
              <div className="mt-3 flex items-center gap-2 rounded-md border border-dashed border-gold-soft bg-gold/5 px-3 py-2.5 text-xs text-muted-foreground">
                <ShieldCheck className="h-4 w-4 text-gold" />
                You'll be redirected to {gateway} to complete payment securely.
              </div>
            </section>

            {err && <p className="text-sm text-red-400">{err}</p>}
          </div>

          <aside className="h-fit rounded-xl border border-gold-soft bg-card p-5 sticky top-24">
            <h2 className="font-display text-lg text-foreground">{data.lines.length} {data.lines.length === 1 ? "issue" : "issues"}</h2>
            <ul className="mt-3 space-y-2 text-sm max-h-60 overflow-auto">
              {data.lines.map((l) => (
                <li key={l.id} className="flex justify-between gap-2">
                  <span className="truncate text-muted-foreground">{l.comic.title} × {l.quantity}</span>
                  <span className="font-mono text-foreground/90">
                    {format(l.comic.price * l.quantity, l.comic as any)}
                  </span>
                </li>
              ))}
            </ul>
            <div className="mt-4 border-t border-border pt-3 flex justify-between text-base">
              <span className="font-display">Total</span>
              <span className="font-display text-gold">{totalLabel}</span>
            </div>
            <button
              type="submit"
              disabled={busy}
              className="mt-4 w-full inline-flex items-center justify-center gap-2 rounded-md bg-gold px-5 py-3 text-sm font-semibold text-primary-foreground disabled:opacity-60"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}
              Pay {totalLabel}
            </button>
          </aside>
        </form>
      </main>
      <SiteFooter />
    </div>
  );
}
