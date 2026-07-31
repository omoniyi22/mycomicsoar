import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery, useQueryClient, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState, useRef, useEffect } from "react";
import { getAccountOverview, getComicDownloadUrls, listMyOrders } from "@/lib/account.functions";
import { resolveCover } from "@/lib/covers";
import { SiteHeader, SiteFooter } from "@/components/site-chrome";
import { supabase } from "@/integrations/supabase/client";
import { BookOpen, Download, Heart, LogOut, Sparkles, User, Loader2, Receipt, Library, ShoppingBag, Smartphone, Monitor, ChevronDown, Mail, CheckCircle } from "lucide-react";
import { subscribeToNewsletter } from "@/lib/newsletter.functions";

// ─── Search params schema ──────────────────────────────
type AccountSearch = {
  section?: "library" | "orders" | "wishlist";
};

const accountQuery = queryOptions({
  queryKey: ["account-overview"],
  queryFn: () => getAccountOverview(),
});

function NewsletterBlock() {
  const subscribeFn = useServerFn(subscribeToNewsletter);
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("loading");
    setMessage("");

    try {
      const result = await subscribeFn({ data: { email, source: "homepage" } });
      setStatus("success");
      setMessage(result.message);
      setEmail("");
    } catch (err) {
      setStatus("error");
      setMessage(err instanceof Error ? err.message : "Something went wrong");
    }
  };

  return (
    <section id="newsletter-dispatch" className="text-center max-w-2xl mx-auto">
      <Mail className="h-6 w-6 text-gold mx-auto" />
      <h3 className="mt-4 font-display text-3xl md:text-4xl">Subscribe to Newsletter</h3>
      <p className="mt-3 text-sm text-muted-foreground">
        Weekly previews, creator conversations, and exclusive first looks at
        variants we’re printing once—and never again. No spam. Just ink.
      </p>

      {status === "success" ? (
        <div className="mt-6 flex items-center justify-center gap-2 text-gold">
          <CheckCircle className="h-5 w-5" />
          <span className="text-sm">{message}</span>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="mt-6 flex flex-col sm:flex-row gap-2 max-w-md mx-auto">
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="your@inbox.com"
            className="flex-1 rounded-md border border-border bg-card px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-gold-soft focus:ring-2 ring-gold"
            disabled={status === "loading"}
          />
          <button
            type="submit"
            disabled={status === "loading"}
            className="rounded-md bg-gold px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:scale-[1.02] transition-transform disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {status === "loading" ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {status === "loading" ? "Subscribing..." : "Subscribe"}
          </button>
        </form>
      )}
      {status === "error" && (
        <p className="mt-3 text-sm text-red-400">{message}</p>
      )}
    </section>
  );
}

export const Route = createFileRoute("/_authenticated/account")({
  validateSearch: (search: Record<string, unknown>): AccountSearch => {
    const section = search.section;
    if (section === "library" || section === "orders" || section === "wishlist") {
      return { section };
    }
    return { section: "library" };
  },
  loader: ({ context }) => context.queryClient.ensureQueryData(accountQuery),
  head: () => ({
    meta: [{ title: "Your Account — Vault & Quill" }],
  }),
  errorComponent: ({ error }) => (
    <div className="min-h-screen grid place-items-center text-center p-6">
      <p className="text-sm text-muted-foreground">{error.message}</p>
    </div>
  ),
  component: AccountPage,
});

function AccountPage() {
  const search = useSearch({ from: Route.id });
  const navigate = useNavigate();
  const fetchOverview = useServerFn(getAccountOverview);
  const { data } = useSuspenseQuery({
    ...accountQuery,
    queryFn: () => fetchOverview(),
  });
  const queryClient = useQueryClient();

  const wishlistRef = useRef<HTMLDivElement>(null);
  const activeSection = search.section === "wishlist" ? "library" : (search.section ?? "library");

  useEffect(() => {
    if (search.section === "wishlist" && wishlistRef.current) {
      wishlistRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [search.section]);

  async function handleSignOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  const name = data.profile?.display_name ?? "Collector";

  const setSection = (section: "library" | "orders") => {
    navigate({
      to: "/account",
      search: { section },
      replace: true,
    });
  };

  return (
    <div className="min-h-screen bg-vignette">
      <SiteHeader />

      <header className="border-b border-border/60 bg-background/40">
        <div className="container-tight py-12 flex flex-wrap items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="grid h-16 w-16 place-items-center rounded-full border border-gold-soft bg-card text-gold">
              {data.profile?.avatar_url ? (
                <img src={data.profile.avatar_url} alt="" className="h-full w-full rounded-full object-cover" />
              ) : (
                <User className="h-7 w-7" />
              )}
            </div>
            <div>
              <div className="text-xs uppercase tracking-[0.25em] text-gold">Member dashboard</div>
              <h1 className="mt-1 font-display text-4xl text-foreground">Welcome, {name}.</h1>
              <p className="text-sm text-muted-foreground mt-1">
                {data.library.length} {data.library.length === 1 ? "issue" : "issues"} in your library ·{" "}
                {data.wishlist.length} on your wishlist
              </p>
            </div>
          </div>
          <button
            onClick={handleSignOut}
            className="inline-flex items-center gap-2 rounded-md border border-border px-4 py-2 text-sm text-muted-foreground hover:border-gold-soft hover:text-foreground"
          >
            <LogOut className="h-4 w-4" /> Sign out
          </button>
        </div>
      </header>

      {/* ─── Tabs ─────────────────────────────────────── */}
      <div className="container-tight border-b border-border/60">
        <div className="flex gap-2 py-2">
          <button
            onClick={() => setSection("library")}
            className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-t-md transition-all ${activeSection === "library"
              ? "bg-gold text-primary-foreground shadow-glow"
              : "text-muted-foreground hover:text-foreground hover:bg-gold/10"
              }`}
          >
            <Library className="h-4 w-4" />
            Library
          </button>
          <button
            onClick={() => setSection("orders")}
            className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-t-md transition-all ${activeSection === "orders"
              ? "bg-gold text-primary-foreground shadow-glow"
              : "text-muted-foreground hover:text-foreground hover:bg-gold/10"
              }`}
          >
            <ShoppingBag className="h-4 w-4" />
            Orders
          </button>
        </div>
      </div>

      <main className="container-tight py-12 space-y-16">
        {/* ─── Library & Wishlist ────────────────────── */}
        {activeSection === "library" && (
          <>
            <Section
              title="Your Library"
              eyebrow="Owned issues"
              icon={<BookOpen className="h-4 w-4" />}
              empty={data.library.length === 0}
              emptyLabel="No purchases yet. Find your first issue."
            >
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-6 gap-y-10">
                {data.library.map((item) => (
                  <div key={item.id} className="group">
                    <div className="relative overflow-hidden rounded-md border border-border bg-card aspect-[2/3] shadow-elegant">
                      <img
                        src={resolveCover(item.comic.cover_url)}
                        alt={item.comic.title}
                        className="h-full w-full object-cover"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/10 to-transparent opacity-90" />
                      <span className="absolute top-3 left-3 rounded-sm bg-gold/95 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-primary-foreground">
                        Owned
                      </span>
                    </div>
                    <div className="mt-3">
                      <h3 className="font-display text-lg text-foreground line-clamp-1">{item.comic.title}</h3>
                      <p className="text-xs text-muted-foreground">
                        {item.download_count} downloads · {new Date(item.purchased_at).toLocaleDateString()}
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Link
                          to="/reader/$slug"
                          params={{ slug: item.comic.slug }}
                          className="inline-flex items-center gap-1.5 rounded-md bg-gold px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:scale-[1.02] transition-transform"
                        >
                          <BookOpen className="h-3.5 w-3.5" /> Read
                        </Link>
                        <DownloadButton comicId={item.comic.id} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </Section>
            <div className="py-13" ref={wishlistRef}></div>

            {/* Wishlist section */}
            <div>
              <Section
                title="Wishlist"
                eyebrow="Saved for later"
                icon={<Heart className="h-4 w-4" />}
                empty={data.wishlist.length === 0}
                emptyLabel="Heart any comic to save it here."
              >
                <ul className="grid sm:grid-cols-2 gap-4">
                  {data.wishlist.map((w) => (
                    <li
                      key={w.id}
                      className="flex gap-4 rounded-lg border border-border bg-card p-4 hover:border-gold-soft transition-colors"
                    >
                      <img
                        src={resolveCover(w.comic.cover_url)}
                        alt=""
                        className="h-24 w-16 rounded-md object-cover shadow-elegant"
                      />
                      <div className="flex flex-col flex-1 min-w-0">
                        <Link
                          to="/comics/$slug"
                          params={{ slug: w.comic.slug }}
                          className="font-display text-lg text-foreground hover:text-gold transition-colors line-clamp-1"
                        >
                          {w.comic.title}
                        </Link>
                        <p className="text-xs text-muted-foreground line-clamp-1">
                          {w.comic.writer} · {w.comic.publisher?.name}
                        </p>
                        <div className="mt-auto flex items-center justify-between pt-2">
                          <span className="font-mono text-sm text-gold">${w.comic.price.toFixed(2)}</span>
                          <Link
                            to="/comics/$slug"
                            params={{ slug: w.comic.slug }}
                            className="text-xs text-muted-foreground hover:text-gold"
                          >
                            View →
                          </Link>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </Section>
            </div>
          </>
        )}

        {/* ─── Orders ────────────────────────────────── */}
        {activeSection === "orders" && <OrdersSection />}

        {/* ─── Subscription Banner ───────────────────── */}
        <div className="rounded-xl border border-gold-soft p-8 ">
          <NewsletterBlock />
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}

// ─── Helper Components ──────────────────────────────

function Section({
  eyebrow,
  title,
  icon,
  empty,
  emptyLabel,
  children,
}: {
  eyebrow: string;
  title: string;
  icon: React.ReactNode;
  empty: boolean;
  emptyLabel: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="mb-6 flex items-end justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-gold">
            {icon}
            {eyebrow}
          </div>
          <h2 className="mt-1 font-display text-3xl text-foreground">{title}</h2>
        </div>
      </div>
      {empty ? (
        <div className="rounded-lg border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
          {emptyLabel}{" "}
          <Link to="/shop" className="text-gold hover:underline">
            Browse the catalog →
          </Link>
        </div>
      ) : (
        children
      )}
    </section>
  );
}

// ─── Unified Download Button (supports portrait & landscape) ───
function DownloadButton({ comicId }: { comicId: string }) {
  const fn = useServerFn(getComicDownloadUrls);
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const [urls, setUrls] = useState<{ portraitUrl: string | null; landscapeUrl: string | null; title: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const buttonRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (buttonRef.current && !buttonRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  async function fetchUrls() {
    if (urls) {
      setOpen(!open);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const result = await fn({ data: { comicId } });
      setUrls(result);
      setOpen(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load download links");
      alert(error);
    } finally {
      setBusy(false);
    }
  }

  async function downloadAndOpen(url: string, filename: string) {
    setBusy(true);
    setOpen(false);
    try {
      window.open(url, '_blank');
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = objectUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(objectUrl);
      await qc.invalidateQueries({ queryKey: ["account-overview"] });
    } catch (err) {
      console.error('Download error:', err);
      window.open(url, '_blank');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative inline-block" ref={buttonRef}>
      <button
        onClick={fetchUrls}
        disabled={busy}
        className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:border-gold-soft disabled:opacity-60"
      >
        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
        PDF
        <ChevronDown className={`h-3 w-3 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && urls && (
        <div className="absolute right-0 mt-2 w-52 rounded-md border border-white/10 bg-card shadow-2xl z-50 p-1">
          {urls.portraitUrl && (
            <button
              onClick={() => {
                if (!busy) {
                  downloadAndOpen(urls.portraitUrl!, `${urls.title || 'comic'}.pdf`);
                }
              }}
              disabled={busy}
              className="flex items-center gap-2 px-3 py-2 text-xs text-foreground rounded hover:bg-gold/10 hover:text-gold transition-colors w-full text-left disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Smartphone className="h-3.5 w-3.5" />
              <span className="flex-1">Mobile (portrait)</span>
            </button>
          )}
          {urls.landscapeUrl && (
            <button
              onClick={() => {
                if (!busy) {
                  downloadAndOpen(urls.landscapeUrl!, `${urls.title || 'comic'}.pdf`);
                }
              }}
              disabled={busy}
              className="flex items-center gap-2 px-3 py-2 text-xs text-foreground rounded hover:bg-gold/10 hover:text-gold transition-colors w-full text-left disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Monitor className="h-3.5 w-3.5" />
              <span className="flex-1">Desktop (landscape)</span>
            </button>
          )}
          {!urls.portraitUrl && !urls.landscapeUrl && (
            <div className="px-3 py-2 text-xs text-muted-foreground">No PDF available</div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Orders Section ──────────────────────────────────
function OrdersSection() {
  const fetcher = useServerFn(listMyOrders);
  const { data, isLoading } = useQuery({
    queryKey: ["my-orders"],
    queryFn: () => fetcher(),
  });
  const orders = data?.orders ?? [];

  const formatOrderCurrency = (amount: number, currency: string) => {
    if (currency === "NGN") {
      return `₦${amount.toLocaleString("en-NG", { maximumFractionDigits: 0 })}`;
    } else if (currency === "EUR") {
      return `€${amount.toFixed(2)}`;
    }
    return `$${amount.toFixed(2)}`;
  };

  return (
    <section>
      <div className="mb-6">
        <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-gold">
          <Receipt className="h-4 w-4" /> Order history
        </div>
        <h2 className="mt-1 font-display text-3xl text-foreground">Your orders</h2>
      </div>
      {isLoading ? (
        <div className="rounded-lg border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
          <Loader2 className="inline h-4 w-4 animate-spin text-gold" /> Loading…
        </div>
      ) : orders.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
          No orders yet.
        </div>
      ) : (
        <ul className="space-y-4">
          {orders.filter((o) => o.status === 'completed').map((o) => (
            <li key={o.id} className="rounded-lg border border-border bg-card p-5">
              <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 pb-3">
                <div className="min-w-0">
                  <div className="font-mono text-xs text-muted-foreground">#{o.id.slice(0, 8)}</div>
                  <div className="text-sm text-foreground">{new Date(o.created_at).toLocaleString()}</div>
                </div>
                <div className="flex items-center gap-4">
                  <span className="rounded-full border border-gold-soft px-2.5 py-0.5 text-[11px] uppercase tracking-wider text-gold">{o.status}</span>
                  <span className="font-mono text-gold">
                    {formatOrderCurrency(o.total, o.currency)}
                  </span>
                </div>
              </header>
              <ul className="mt-3 grid gap-3 sm:grid-cols-2">
                {o.items.map((it) => (
                  <li key={it.id} className="flex gap-3">
                    <img src={resolveCover(it.comic?.cover_url ?? null)} alt="" className="h-16 w-12 rounded object-cover" />
                    <div className="min-w-0 flex-1">
                      <div className="font-display text-sm text-foreground line-clamp-1">{it.title}</div>
                      <div className="text-xs text-muted-foreground">
                        Qty {it.quantity} · {formatOrderCurrency(it.unit_price, o.currency)}
                      </div>
                      <div className="mt-1 flex flex-wrap gap-2">
                        {it.comic?.slug && (
                          <Link
                            to="/reader/$slug"
                            params={{ slug: it.comic.slug }}
                            className="inline-flex items-center gap-1 text-xs text-gold hover:underline"
                          >
                            <BookOpen className="h-3 w-3" /> Read
                          </Link>
                        )}
                        {it.comic && <DownloadButton comicId={it.comic.id} />}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}