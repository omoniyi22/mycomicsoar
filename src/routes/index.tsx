import { subscribeToNewsletter } from "@/lib/newsletter.functions";
// routes/index.tsx

import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery, useQueryClient, useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  Star,
  Sparkles,
  Calendar,
  Mail,
  CheckCircle,
  Loader2,
  Music,
  SettingsIcon,
  Maximize,
  ZoomIn,
  BookOpen,
  Smartphone,
  ShoppingBag,
  Check,
} from "lucide-react";
import heroImg from "@/assets/hero.jpg";
import { getHomeData, type Comic } from "@/lib/catalog.functions";
import { resolveCover } from "@/lib/covers";
import { ComicCard, SectionHeader } from "@/components/comic-card";
import { SiteHeader, SiteFooter } from "@/components/site-chrome";
import { useCurrency } from "@/lib/currency";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { addToCart, getCart } from "@/lib/cart.functions";
import { supabase } from "@/integrations/supabase/client";

const homeQuery = queryOptions({
  queryKey: ["home"],
  queryFn: () => getHomeData(),
});

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Comicsoar — A Curated Comics Emporium" },
      {
        name: "description",
        content:
          "Discover new releases, collectible manga, and creator-owned indies on Comicsoar. Subscribe to your favorite series and build your collection.",
      },
      { property: "og:title", content: "Comicsoar — A Curated Comics Emporium" },
      {
        property: "og:description",
        content:
          "New issues every Wednesday. Comics worth the shelf space. Subscriptions, pull lists, and graded collectibles.",
      },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(homeQuery),
  component: Home,
});

function Home() {
  const { data } = useSuspenseQuery(homeQuery);
  const { format } = useCurrency();
  const heroPicks = (data.featured.length ? data.featured : data.newReleases).slice(0, 3);

  return (
    <div className="min-h-screen bg-vignette">
      <SiteHeader />
      <Hero picks={heroPicks} format={format} />

      <main className="container-tight space-y-28 mt-24">
        {/* New: Quick Browse Section */}
        {/* <QuickBrowse data={data} format={format} /> */}
        {/* New: How It Works Section */}

        <section>
          <SectionHeader
            eyebrow="This Week"
            title="New Releases"
            description="Fresh off the press. Reserved for collectors who refuse to wait."
            action="See the release calendar"
          />
          <CardGrid items={data.newReleases} />
        </section>

        <HowItWorks />
        {/* New: Shop by Category Section */}
        <ShopByCategory />

        <section>
          <SectionHeader eyebrow="Hot Right Now" title="Trending Comics" action="Browse all trending" />
          <CardGrid items={data.trending} />
        </section>

        <FeaturedNovel comic={data.graphicNovels[0]} format={format} />

        <section>
          <SectionHeader eyebrow="Manga Corner" title="From Tokyo, with edge" action="Explore manga" />
          <CardGrid items={data.manga.length ? data.manga : data.trending.slice(0, 4)} />
        </section>

        <ReaderFeatures />

        <section>
          <SectionHeader eyebrow="The Vault" title="Best Sellers" action="See top 100" />
          <CardGrid items={data.bestsellers} />
        </section>

        <SubscriptionBanner />

        <NewsletterBlock />
      </main>

      <SiteFooter />
      
      {/* New: Mobile Shop CTA */}
      <MobileShopCTA />
    </div>
  );
}

// ---- Hero (now passes the whole comic for price formatting) ----
function Hero({ picks, format }: { picks: Comic[]; format: (usd: number, prices?: any) => string }) {
  return (
    <section className="relative overflow-hidden">
      <div className="absolute inset-0">
        <img
          src={heroImg}
          alt=""
          width={1920}
          height={1080}
          className="h-full w-full object-cover opacity-60"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-background via-background/85 to-background/30" />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent" />
      </div>
      <div className="container-tight relative grid lg:grid-cols-[1.1fr_1fr] gap-10 pt-20 pb-32 lg:pt-32 lg:pb-40">
        <div className="max-w-2xl">
          <div className="mb-5 flex items-center gap-3 text-xs uppercase tracking-[0.25em] text-gold">
            <span className="h-px w-10 bg-gold/60" />
            The Digital Comic E-book Store
          </div>
          <h1 className="font-display text-5xl md:text-7xl leading-[1.02] text-foreground">
            Stories worth <span className="italic text-gold">collecting.</span>
            <br />
            Delivered as e-books.
          </h1>
          <p className="mt-6 max-w-xl text-base md:text-lg text-muted-foreground">
            ComicSoar is a 100% digital comic e-book store. Buy any issue,
            manga, or indie original and read it instantly in your browser — or download
            the PDF to keep forever. No shipping. No waiting. Just ink on your screen.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/shop">
              <button className="group inline-flex items-center gap-2 rounded-md bg-gold px-8 py-4 text-base font-semibold text-primary-foreground shadow-glow transition-transform hover:scale-[1.02]">
                Start browsing 12,400+ comics
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </button>
            </Link>
          </div>
          <dl className="mt-12 grid grid-cols-3 max-w-md gap-6 border-t border-border/60 pt-6">
            {[
              { k: "12,400+", v: "E-book titles" },
              { k: "Instant", v: "Digital delivery" },
              { k: "Read + PDF", v: "Yours forever" },
            ].map((s) => (
              <div key={s.v}>
                <dt className="font-display text-2xl text-gold">{s.k}</dt>
                <dd className="text-xs uppercase tracking-wider text-muted-foreground mt-1">{s.v}</dd>
              </div>
            ))}
          </dl>
        </div>

        {picks.length > 0 && (
          <div className="hidden lg:block relative">
            <div className="absolute -inset-6 rounded-xl bg-gold/15 blur-3xl" />
            <div className="relative grid grid-cols-2 gap-4 items-end">
              {picks.slice(0, 2).map((c, i) => (
                <Link to={`/comics/${c.slug}`} key={c.id}>
                  <div
                    className={`rounded-lg border border-gold-soft bg-card p-3 shadow-elegant ${i === 8 ? "translate-y-4" : "-translate-y-2"
                      }`}
                  >
                    <img
                      src={resolveCover(c.cover_url)}
                      alt={`${c.title} cover`}
                      width={640}
                      height={960}
                      className="rounded-md w-full aspect-[2/3] object-cover"
                    />
                    <div className="px-1 py-3">
                      <div className="text-[10px] uppercase tracking-[0.22em] text-gold flex items-baseline justify-between ">
                        {i === 0 ? "Featured Drop" : "Also This Week"}
                        <div className="ml-auto">{"Comic Soar" ?? c.format}</div>
                      </div>
                      <h3 className="mt-1 font-display text-lg text-foreground line-clamp-1">{c.title}</h3>
                      <p className="mt-0.5 text-[11px] text-muted-foreground line-clamp-1">
                        {/* {c.writer ?? c.format} · {c.publisher?.name} */}
                      </p>
                      <div className="mt-2 flex items-center justify-between">
                        <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                          <Star className="h-3 w-3 fill-gold text-gold" />
                          {c.rating.toFixed(1)}
                        </div>
                        <span className="font-mono text-xs text-gold">
                          {/* Pass the whole comic object to format */}
                          {format(c.price, c)}
                        </span>
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
            {picks[2] && (
              <Link to="/comics/$slug" params={{ slug: picks[2].slug }} className="lg:block relative mt-12 bg-gold/15 ">
                <div className="mt-6 flex items-center gap-3 rounded-lg -inset-2 border absolute border-border bg-card/70 p-3 h-fit " style={{ zIndex: 87 }}>
                  <img
                    src={resolveCover(picks[2].cover_url)}
                    alt=""
                    width={120}
                    height={180}
                    className="h-20 w-14 rounded object-cover"
                  />
                  <div className="min-w-0">
                    <div className="text-[10px] uppercase tracking-[0.22em] text-gold">Staff Pick</div>
                    <div className="font-display text-base text-foreground truncate">{picks[2].title}</div>
                    <div className="text-[11px] text-muted-foreground truncate">
                      {"Comic Soar" ?? picks[2].format}
                    </div>
                  </div>
                  <span className="ml-auto font-mono text-xs text-gold">
                    {format(picks[2].price, picks[2])}
                  </span>
                </div>
              </Link>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

// ---- Quick Browse Component ----
function QuickBrowse({ data, format }: { data: any; format: (usd: number, prices?: any) => string }) {
  const quickPicks = data.newReleases.slice(0, 6);
  
  return (
    <section className="border-t border-border/40 pt-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <span className="text-xs uppercase tracking-[0.25em] text-gold">Start Browsing</span>
          <h2 className="font-display text-2xl md:text-3xl mt-1">New this week</h2>
        </div>
        <Link 
          to="/shop" 
          className="text-sm text-gold hover:underline flex items-center gap-1"
        >
          View all <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {quickPicks.map((comic: Comic) => (
          <Link to={`/comics/${comic.slug}`} key={comic.id}>
            <div className="group cursor-pointer">
              <div className="aspect-[2/3] rounded-md overflow-hidden border border-border/40 group-hover:border-gold-soft transition-all">
                <img
                  src={resolveCover(comic.cover_url)}
                  alt={comic.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  loading="lazy"
                />
              </div>
              <p className="mt-2 text-sm font-medium text-foreground truncate">{comic.title}</p>
              <p className="text-xs font-mono text-gold">{format(comic.price, comic)}</p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}

// ---- How It Works Component ----
function HowItWorks() {
  return (
    <section className="grid grid-cols-1 md:grid-cols-3 gap-6 py-8 border-t border-border/40">
      {[
        { icon: ShoppingBag, title: "1. Browse", desc: "Explore 12,400+ digital comics" },
        { icon: Check, title: "2. Buy", desc: "Pay once, read forever" },
        { icon: BookOpen, title: "3. Read", desc: "Instant access in browser or PDF" }
      ].map((step) => (
        <div key={step.title} className="flex items-center gap-4">
          <div className="h-10 w-10 rounded-full bg-gold/10 flex items-center justify-center flex-shrink-0">
            <step.icon className="h-5 w-5 text-gold" />
          </div>
          <div>
            <p className="font-display text-sm">{step.title}</p>
            <p className="text-xs text-muted-foreground">{step.desc}</p>
          </div>
        </div>
      ))}
    </section>
  );
}

// ---- Shop by Category Component ----
function ShopByCategory() {
  const categories = [
    { name: "Mystery", icon: "🔍", count: "1,200+", description: "Uncover thrilling tales" },
    { name: "Adventures", icon: "⚔️", count: "2,500+", description: "Epic journeys await" },
    { name: "Sci-Fi", icon: "🚀", count: "1,800+", description: "Explore the future" },
    { name: "SuperHeroes", icon: "🦸", count: "3,100+", description: "Discover your hero" }
  ];
  
  return (
    <section className="py-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <span className="text-xs uppercase tracking-[0.25em] text-gold">Shop by Category</span>
          <h2 className="font-display text-2xl md:text-3xl mt-1">Find your next read</h2>
        </div>
        <Link 
          to="/shop" 
          className="text-sm text-gold hover:underline flex items-center gap-1"
        >
          Browse all <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {categories.map((cat) => (
          <Link to={`/shop?category=${cat.name.toLowerCase()}`} key={cat.name}>
            <div className="group rounded-lg border border-border/40 p-6 text-center hover:border-gold-soft transition-all hover:shadow-glow bg-card/30 hover:bg-card/60">
              <span className="text-4xl block mb-3">{cat.icon}</span>
              <h4 className="font-display text-lg text-foreground group-hover:text-gold transition-colors">{cat.name}</h4>
              <p className="text-xs text-muted-foreground mt-1">{cat.description}</p>
              <p className="text-[10px] text-gold/70 mt-2">{cat.count} titles</p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}


// ---- Mobile Shop CTA Component ----
function MobileShopCTA() {
  return (
    <div className="fixed bottom-0 left-0 right-0 bg-card/95 backdrop-blur-lg border-t border-border p-4 md:hidden z-50">
      <div className="flex items-center justify-between max-w-md mx-auto">
        <div>
          <p className="text-xs text-muted-foreground">12,400+ titles</p>
          <p className="text-sm font-medium">Start collecting today</p>
        </div>
        <Link to="/shop">
          <button className="bg-gold text-primary-foreground px-6 py-2.5 rounded-md font-semibold text-sm flex items-center gap-2">
            Browse <ShoppingBag className="h-4 w-4" />
          </button>
        </Link>
      </div>
    </div>
  );
}

// ---- CardGrid (uses ComicCard which handles price correctly) ----
function CardGrid({ items }: { items: Comic[] }) {
  if (!items.length) return null;
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-6 gap-y-10">
      {items.map((c) => (
        <ComicCard key={c.id} comic={c} />
      ))}
    </div>
  );
}

// ---- FeaturedNovel (already passes the whole comic) ----
function FeaturedNovel({ comic, format }: { comic: Comic | undefined; format: (usd: number, prices?: any) => string }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const addFn = useServerFn(addToCart);

  const [adding, setAdding] = useState(false);
  const [added, setAdded] = useState(false);

  if (!comic) return null;

  const { data: cart, isLoading: cartLoading } = useQuery({
    queryKey: ["cart"],
    queryFn: async () => {
      try {
        return await getCart();
      } catch {
        return { lines: [] };
      }
    },
    staleTime: 1000 * 60 * 5,
    suspense: false,
  });

  const inCart = cart?.lines?.some((line: any) => line.comic?.id === comic.id) ?? false;

  async function handleAction() {
    const { data } = await supabase.auth.getUser();
    if (!data.user) {
      navigate({ to: "/auth" });
      return;
    }

    if (inCart) {
      navigate({ to: "/cart" });
      return;
    }

    setAdding(true);
    try {
      await addFn({ data: { comicId: comic.id } });
      await qc.invalidateQueries({ queryKey: ["cart"] });
      await qc.invalidateQueries({ queryKey: ["cart-count"] });
      setAdded(true);
      setTimeout(() => navigate({ to: "/cart" }), 300);
    } catch (error) {
      console.error("Failed to add to cart:", error);
      setAdding(false);
    }
  }

  if (cartLoading) {
    return (
      <section className="relative overflow-hidden rounded-2xl border border-gold-soft bg-card">
        <div className="grid md:grid-cols-[1fr_1.2fr] gap-0">
          <div className="relative bg-ink p-10 md:p-14 flex items-center justify-center">
            <div className="absolute inset-0 bg-gradient-to-br from-gold/10 to-transparent" />
            <img
              src={resolveCover(comic.cover_url)}
              alt={comic.title}
              width={768}
              height={1152}
              loading="lazy"
              className="relative max-h-[520px] aspect-[2/3] object-cover rounded-md shadow-elegant"
            />
          </div>
          <div className="p-10 md:p-14 flex flex-col justify-center">
            <div className="text-xs uppercase tracking-[0.25em] text-gold">Collector's Edition</div>
            <h3 className="mt-3 font-display text-4xl md:text-5xl text-foreground">{comic.title}</h3>
            <p className="mt-4 text-muted-foreground leading-relaxed max-w-lg">{comic.synopsis}</p>
            <div className="mt-8 flex items-center gap-4">
              <span className="font-display text-3xl text-gold">{format(comic.price, comic)}</span>
              <div className="inline-flex items-center gap-2 rounded-md bg-gold/50 px-5 py-2.5 text-sm font-semibold text-primary-foreground opacity-60">
                <Loader2 className="h-4 w-4 animate-spin" />
                Checking cart...
              </div>
            </div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="relative overflow-hidden rounded-2xl border border-gold-soft bg-card">
      <div className="grid md:grid-cols-[1fr_1.2fr] gap-0">
        <div className="relative bg-ink p-10 md:p-14 flex items-center justify-center">
          <div className="absolute inset-0 bg-gradient-to-br from-gold/10 to-transparent" />
          <img
            src={resolveCover(comic.cover_url)}
            alt={comic.title}
            width={768}
            height={1152}
            loading="lazy"
            className="relative max-h-[520px] aspect-[2/3] object-cover rounded-md shadow-elegant"
          />
        </div>
        <div className="p-10 md:p-14 flex flex-col justify-center">
          <div className="text-xs uppercase tracking-[0.25em] text-gold">Collector's Edition</div>
          <h3 className="mt-3 font-display text-4xl md:text-5xl text-foreground">{comic.title}</h3>
          <p className="mt-4 text-muted-foreground leading-relaxed max-w-lg">{comic.synopsis}</p>
          <div className="mt-6 flex flex-wrap gap-x-6 gap-y-3 text-sm text-muted-foreground">
            <span><span className="text-foreground/80">Format:</span> {"PDF"}</span>
            <span><span className="text-foreground/80">Writer:</span> {"Comic Soar"}</span>
          </div>
          <div className="mt-8 flex items-center gap-4">
            <span className="font-display text-3xl text-gold">{format(comic.price, comic)}</span>
            <button
              onClick={handleAction}
              disabled={adding}
              className="inline-flex items-center gap-2 rounded-md bg-gold px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:scale-[1.02] transition-transform disabled:opacity-60"
            >
              {adding ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : inCart ? (
                ""
              ) : added ? (
                <Check className="h-4 w-4" />
              ) : (
                ""
              )}
              {adding
                ? "Adding..."
                : inCart
                  ? "Add to collection"
                  : added
                    ? "Added!"
                    : "Add to collection"}
            </button>
            <Link to={`/comics/${comic.slug}`}>
              <button className="rounded-md border border-gold-soft px-5 py-2.5 text-sm text-foreground hover:border-gold transition-colors">
                Preview
              </button>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

// ---- PublisherGrid (unchanged) ----
function PublisherGrid({
  publishers,
}: {
  publishers: { id: string; name: string; slug: string; tagline: string | null; accent: string | null }[];
}) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
      {publishers?.map((p) => (
        <button
          key={p.id}
          className="group relative overflow-hidden rounded-lg border border-border bg-card p-5 text-left transition-colors hover:border-gold-soft"
        >
          <div
            className="absolute -top-10 -right-10 h-32 w-32 rounded-full opacity-20 blur-2xl transition-opacity group-hover:opacity-40"
            style={{ backgroundColor: p.accent ?? "var(--gold)" }}
          />
          <div className="relative">
            <h4 className="font-display text-xl text-foreground">{p.name}</h4>
            <p className="mt-1 text-xs text-muted-foreground">{p.tagline}</p>
            <div className="mt-4 text-[10px] uppercase tracking-wider text-gold opacity-70 group-hover:opacity-100">
              Browse →
            </div>
          </div>
        </button>
      ))}
    </div>
  );
}

// ---- SubscriptionBanner (unchanged) ----
function SubscriptionBanner() {
  return (
    <section className="relative overflow-hidden rounded-2xl border border-gold-soft">
      <div className="absolute inset-0 bg-gradient-to-r from-ink via-ink to-card" />
      <div className="absolute inset-0 opacity-30 bg-[radial-gradient(circle_at_80%_20%,var(--gold),transparent_55%)]" />
      <div className="relative grid md:grid-cols-2 gap-8 p-10 md:p-16">
        <div>
          <div className="text-xs uppercase tracking-[0.25em] text-gold">The Pull List Club</div>
          <h3 className="mt-3 font-display text-4xl md:text-5xl text-foreground">
            Never miss a Wednesday again.
          </h3>
          <p className="mt-4 text-muted-foreground max-w-md">
            Auto-add your favorite ongoing series to your digital library, plus a
            curated monthly drop of staff picks and exclusive variant covers —
            delivered straight to your reader. Cancel anytime.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              to="/shop"
              className="rounded-md border border-gold-soft px-5 py-2.5 text-sm text-foreground hover:border-gold transition-colors inline-flex items-center"
            >
              Go to shop
            </Link>
            <button
              className="rounded-md bg-gold px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:scale-[1.02] transition-transform"
              onClick={() =>
                document
                  .getElementById("newsletter-dispatch")
                  ?.scrollIntoView({ behavior: "smooth" })
              }
            >
              Subscribe
            </button>
          </div>
        </div>
        <ul className="grid grid-cols-2 gap-6 self-center">
          {[
            { icon: Calendar, t: "Weekly drops", d: "New issues every Wednesday." },
            { icon: Mail, t: "Email drops", d: "First looks, straight to your inbox." },
            { icon: Star, t: "Early access", d: "48-hour heads-up on pre-orders." },
            { icon: Sparkles, t: "Staff picks", d: "Curated monthly drop from our team." },
          ].map((p) => (
            <li key={p.t} className="rounded-lg border border-border bg-background/40 p-4 backdrop-blur">
              <p.icon className="h-5 w-5 text-gold" />
              <div className="mt-2 font-display text-lg text-foreground">{p.t}</div>
              <div className="text-xs text-muted-foreground">{p.d}</div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

// ---- NewsletterBlock (unchanged) ----
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
      <h3 className="mt-4 font-display text-3xl md:text-4xl">Dispatch from the Vault</h3>
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

// ---- Reader Features Component (unchanged) ----
function ReaderFeatures() {
  const features = [
    {
      icon: Music,
      title: "Built-in Soundtrack",
      description: "Listen to curated tracks or upload your own while you read.",
    },
    {
      icon: Maximize,
      title: "Fullscreen Immersion",
      description: "Go fullscreen and focus on the art, with auto‑hide controls.",
    },
    {
      icon: ZoomIn,
      title: "Pinch & Zoom",
      description: "Zoom in on details and pan around high‑res pages.",
    },
    {
      icon: SettingsIcon,
      title: "Custom Transitions",
      description: "Choose from slide, flip, jitter, shake, and light burst.",
    },
    {
      icon: BookOpen,
      title: "Thumbnail Navigation",
      description: "Jump to any page instantly from the thumbnail strip.",
    },
    {
      icon: Smartphone,
      title: "Responsive Design",
      description: "Optimized for portrait and landscape on any device.",
    },
  ];

  return (
    <section className="text-center max-w-5xl mx-auto">
      <div className="text-xs uppercase tracking-[0.25em] text-gold">The Reader Experience</div>
      <h3 className="mt-3 font-display text-3xl md:text-4xl">Built for comic lovers</h3>
      <p className="mt-3 text-sm text-muted-foreground max-w-2xl mx-auto">
        Our reader puts the art front and center, with intuitive controls and
        personalization to make every page a joy.
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mt-10">
        {features.map((f) => (
          <div
            key={f.title}
            className="rounded-lg border border-border bg-card/50 p-6 text-left transition hover:border-gold/30 hover:bg-card/80"
          >
            <f.icon className="h-8 w-8 text-gold mb-3" />
            <h4 className="font-display text-lg text-foreground">{f.title}</h4>
            <p className="text-sm text-muted-foreground mt-2">{f.description}</p>
          </div>
        ))}
      </div>
      <div className="mt-8">
        <Link
          to="/shop"
          className="inline-flex items-center gap-2 text-gold hover:underline"
        >
          Explore a comic <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </section>
    
  );
}