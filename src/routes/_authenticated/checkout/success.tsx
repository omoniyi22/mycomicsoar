import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { SiteHeader, SiteFooter } from "@/components/site-chrome";
import { verifyPaystack, verifyFlutterwave } from "@/lib/payments.functions";
import { CheckCircle2, BookOpen, Loader2, AlertTriangle } from "lucide-react";

export const Route = createFileRoute("/_authenticated/checkout/success")({
  validateSearch: (s: Record<string, unknown>) => ({
    provider: typeof s.provider === "string" ? (s.provider as "paystack" | "flutterwave") : undefined,
    reference: typeof s.reference === "string" ? s.reference : undefined,
    trxref: typeof s.trxref === "string" ? s.trxref : undefined,
    tx_ref: typeof s.tx_ref === "string" ? s.tx_ref : undefined,
    transaction_id: typeof s.transaction_id === "string" ? s.transaction_id : undefined,
    status: typeof s.status === "string" ? s.status : undefined,
  }),
  head: () => ({ meta: [{ title: "Order complete — ComicSoar" }] }),
  component: SuccessPage,
});

function SuccessPage() {
  const { provider, reference, trxref, tx_ref, transaction_id } = Route.useSearch();
  const ref = reference || trxref || tx_ref;
  const runPaystack = useServerFn(verifyPaystack);
  const runFlutterwave = useServerFn(verifyFlutterwave);
  const qc = useQueryClient();
  const [state, setState] = useState<"loading" | "ok" | "error">("loading");
  const [err, setErr] = useState<string | null>(null);
  const [result, setResult] = useState<{ orderId: string; total: number; currency: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!ref || !provider) {
        setErr("Missing payment reference.");
        setState("error");
        return;
      }
      try {
        const res =
          provider === "paystack"
            ? await runPaystack({ data: { reference: ref } })
            : await runFlutterwave({ data: { reference: ref, transactionId: transaction_id } });
        if (cancelled) return;
        setResult({ orderId: res.orderId, total: res.total, currency: res.currency });
        setState("ok");
        await Promise.all([
          qc.invalidateQueries({ queryKey: ["cart"] }),
          qc.invalidateQueries({ queryKey: ["cart-count"] }),
          qc.invalidateQueries({ queryKey: ["account-overview"] }),
          qc.invalidateQueries({ queryKey: ["my-orders"] }),
        ]);
      } catch (e) {
        if (cancelled) return;
        setErr(e instanceof Error ? e.message : "Verification failed");
        setState("error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ref, provider, transaction_id, runPaystack, runFlutterwave, qc]);

  return (
    <div className="min-h-screen bg-vignette">
      <SiteHeader />
      <main className="container-tight py-20 max-w-xl text-center">
        {state === "loading" && (
          <>
            <Loader2 className="mx-auto h-10 w-10 animate-spin text-gold" />
            <h1 className="mt-6 font-display text-3xl text-foreground">Confirming your payment…</h1>
            <p className="mt-2 text-sm text-muted-foreground">Hold tight, this only takes a moment.</p>
          </>
        )}
        {state === "ok" && result && (
          <>
            <div className="grid place-items-center">
              <div className="grid h-20 w-20 place-items-center rounded-full border border-gold-soft bg-card text-gold">
                <CheckCircle2 className="h-10 w-10" />
              </div>
            </div>
            <h1 className="mt-6 font-display text-4xl text-foreground">Your collection grew.</h1>
            <p className="mt-3 text-sm text-muted-foreground">
              Order <span className="font-mono text-foreground/80">{result.orderId.slice(0, 8)}</span> · Total{" "}
              <span className="font-mono text-gold">
                {result.currency === "NGN"
                  ? `₦${result.total.toLocaleString("en-NG", { maximumFractionDigits: 0 })}`
                  : result.currency === "EUR"
                    ? `€${result.total.toFixed(2)}`
                    : `$${result.total.toFixed(2)}`}
              </span>
            </p>
            <p className="mt-4 text-sm text-muted-foreground">Your issues are ready in your digital library.</p>
            <div className="mt-8 flex justify-center gap-3">
              <Link to="/account" className="inline-flex items-center gap-2 rounded-md bg-gold px-5 py-3 text-sm font-semibold text-primary-foreground">
                <BookOpen className="h-4 w-4" /> Read in library
              </Link>
              <Link to="/shop" className="rounded-md border border-border px-5 py-3 text-sm text-muted-foreground hover:border-gold-soft hover:text-foreground">
                Keep browsing
              </Link>
            </div>
          </>
        )}
        {state === "error" && (
          <>
            <AlertTriangle className="mx-auto h-10 w-10 text-red-400" />
            <h1 className="mt-6 font-display text-3xl text-foreground">Payment not completed</h1>
            <p className="mt-2 text-sm text-muted-foreground">{err}</p>
            <div className="mt-8 flex justify-center gap-3">
              <Link to="/cart" className="inline-flex items-center gap-2 rounded-md bg-gold px-5 py-3 text-sm font-semibold text-primary-foreground">
                Back to cart
              </Link>
              <Link to="/account" className="rounded-md border border-border px-5 py-3 text-sm text-muted-foreground hover:border-gold-soft hover:text-foreground">
                Go to account
              </Link>
            </div>
          </>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}