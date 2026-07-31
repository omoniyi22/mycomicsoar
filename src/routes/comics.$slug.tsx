import { createFileRoute, Link, notFound, useNavigate } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery, useQueryClient, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Star, Heart, ShoppingBag, Sparkles, ChevronRight, BookOpen, Loader2, Check } from "lucide-react";
import { getComicBySlug } from "@/lib/catalog.functions";
import { addToCart, getCart } from "@/lib/cart.functions";
import { toggleWishlist } from "@/lib/account.functions";
import { supabase } from "@/integrations/supabase/client";
import { resolveCover } from "@/lib/covers";
import { ComicCard, SectionHeader } from "@/components/comic-card";
import { SiteHeader, SiteFooter } from "@/components/site-chrome";
import { useCurrency } from "@/lib/currency";

// ---- Query definitions ----
const comicQuery = (slug: string) =>
  queryOptions({
    queryKey: ["comic", slug],
    queryFn: async () => {
      const data = await getComicBySlug({ data: { slug } });
      if (!data.comic) throw notFound();
      return data;
    },
  });

// Cart query (reused from checkout)
const cartQuery = queryOptions({
  queryKey: ["cart"],
  queryFn: () => getCart(),
  staleTime: 1000 * 60 * 5, // 5 minutes
});

export const Route = createFileRoute("/comics/$slug")({
  loader: ({ context, params }) => context.queryClient.ensureQueryData(comicQuery(params.slug)),
  head: ({ loaderData }) => {
    const c = loaderData?.comic;
    const title = c ? `${c.title} — Vault & Quill` : "Comic — Vault & Quill";
    const desc = c?.synopsis ?? "Discover collectible comics at Vault & Quill.";
    return {
      meta: [
        { title },
        { name: "description", content: desc },
        { property: "og:title", content: title },
        { property: "og:description", content: desc },
      ],
    };
  },
  errorComponent: ({ error }) => (
    <div className="min-h-screen grid place-items-center bg-vignette p-6 text-center">
      <div>
        <p className="font-display text-2xl text-foreground">Something went wrong.</p>
        <p className="mt-2 text-sm text-muted-foreground">{error.message}</p>
        <Link to="/shop" className="mt-6 inline-block text-gold hover:underline">Back to shop</Link>
      </div>
    </div>
  ),
  notFoundComponent: () => (
    <div className="min-h-screen grid place-items-center bg-vignette p-6 text-center">
      <div>
        <p className="font-display text-3xl text-foreground">Issue not found.</p>
        <p className="mt-2 text-sm text-muted-foreground">That title may have sold out or never existed.</p>
        <Link to="/shop" className="mt-6 inline-block rounded-md bg-gold px-5 py-2.5 text-sm font-semibold text-primary-foreground">
          Browse the catalog
        </Link>
      </div>
    </div>
  ),
  component: ComicDetail,
});

function ComicDetail() {
  const { data } = useSuspenseQuery(comicQuery(Route.useParams().slug));
  const comic = data.comic!;
  const cover = resolveCover(comic.cover_url);
  const { format } = useCurrency();

  return (
    <div className="min-h-screen bg-vignette">
      <SiteHeader />

      <nav className="container-tight pt-6 text-xs text-muted-foreground flex items-center gap-1.5">
        <Link to="/" className="hover:text-gold">Home</Link>
        <ChevronRight className="h-3 w-3" />
        <Link to="/shop" className="hover:text-gold">Shop</Link>
        {comic.publisher && (
          <>
            <ChevronRight className="h-3 w-3" />
            <Link to="/shop" search={{ publisher: comic.publisher.slug }} className="hover:text-gold">
              {comic.publisher.name}
            </Link>
          </>
        )}
        <ChevronRight className="h-3 w-3" />
        <span className="text-foreground/80 truncate">{comic.title}</span>
      </nav>

      <main className="container-tight py-10">
        <section className="grid lg:grid-cols-[minmax(0,420px)_1fr] gap-10 lg:gap-16">
          <div className="relative">
            <div className="absolute -inset-6 rounded-xl bg-gold/10 blur-3xl" />
            <div className="relative rounded-lg border border-gold-soft bg-card p-3 shadow-elegant">
              <img
                src={cover}
                alt={`${comic.title} cover art`}
                width={768}
                height={1152}
                className="w-full aspect-[2/3] object-cover rounded-md"
              />
            </div>
            {comic.is_new && (
              <span className="absolute top-5 left-5 rounded-sm bg-gold px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-primary-foreground">
                New release
              </span>
            )}
          </div>

          <div className="flex flex-col">
            {comic.publisher && (
              <div className="text-xs uppercase tracking-[0.25em] text-gold">
                {/* {comic.publisher.name} · {comic.format} */}
              </div>
            )}
            <h1 className="mt-3 font-display text-4xl md:text-6xl text-foreground leading-[1.05]">
              {comic.title}
            </h1>

            <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-muted-foreground">
              {comic.writer && <span><span className="text-foreground/80">Writer</span> {"Comic Soar"}</span>}
              <span className="inline-flex items-center gap-1">
                {comic.rating.toFixed(1)}
                <Star className="h-4 w-4 fill-gold text-gold" />
              </span>
            </div>

            {comic.synopsis && (
              <p className="mt-6 max-w-2xl text-base text-muted-foreground leading-relaxed">
                {comic.synopsis}
              </p>
            )}

            <div className="mt-8 flex items-baseline gap-3">
              <span className="font-display text-5xl text-gold">{format(comic.price, comic as any)}</span>
              <span className="text-xs uppercase tracking-wider text-muted-foreground">Digital · instant download</span>
            </div>

            <BuyButtons comicId={comic.id} />

            <dl className="mt-10 grid grid-cols-2 sm:grid-cols-4 gap-6 border-t border-border/60 pt-6 text-sm">
              {[
                { k: "Genre", v: comic.genre },
                { k: "Released", v: comic.release_date },
                { k: "Format", v: "online reader and pdf" },
              ].map((f) => (
                <div key={f.k}>
                  <dt className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">{f.k}</dt>
                  <dd className="mt-1 font-display text-base text-foreground">{f.v ?? "—"}</dd>
                </div>
              ))}
            </dl>

            <div className="mt-10 rounded-lg border border-border bg-card/60 p-5 flex items-start gap-4">
              <BookOpen className="h-5 w-5 text-gold mt-0.5" />
              <div className="text-sm text-muted-foreground">
                <span className="text-foreground">Vault Perks:</span> Free preview pages, members
                save 10% on every back-issue order, and every order ships in archival sleeves.
              </div>
            </div>
          </div>
        </section>

        {data.related.length > 0 && (
          <section className="mt-28">
            <SectionHeader
              eyebrow="If you liked this"
              title="More like it"
              description={comic.genre ? `Other ${comic.genre.toLowerCase()} titles from the vault.` : undefined}
            />
            <div className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-10">
              {data.related.map((c) => (
                <ComicCard key={c.id} comic={c} />
              ))}
            </div>
          </section>
        )}
      </main>

      <SiteFooter />
    </div>
  );
}

// ---- BuyButtons (only one primary button: Add/View) ----
// ... all imports and query definitions remain the same ...

// ---- BuyButtons (fixed inCart check) ----
function BuyButtons({ comicId }: { comicId: string }) {
  const addFn = useServerFn(addToCart);
  const wishFn = useServerFn(toggleWishlist);
  const qc = useQueryClient();
  const navigate = useNavigate();

  const [adding, setAdding] = useState(false);
  const [added, setAdded] = useState(false);
  const [wishing, setWishing] = useState(false);
  const [wished, setWished] = useState(false);

  const { data: cart, isLoading, refetch: refetchCart } = useQuery({
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

  // ✅ FIX: use line.comic.id instead of line.comic_id
  const inCart = cart?.lines?.some((line: any) => line.comic?.id === comicId) ?? false;

  async function ensureAuth() {
    const { data } = await supabase.auth.getUser();
    if (!data.user) {
      navigate({ to: "/auth" });
      return false;
    }
    return true;
  }

  async function handleAdd() {
    if (!(await ensureAuth())) return;
    setAdding(true);
    try {
      await addFn({ data: { comicId } });
      await qc.invalidateQueries({ queryKey: ["cart"] });
      await refetchCart();
      setAdded(true);
      setTimeout(() => setAdded(false), 1800);
    } finally {
      setAdding(false);
    }
  }

  async function handleWish() {
    if (!(await ensureAuth())) return;
    setWishing(true);
    try {
      const res = await wishFn({ data: { comicId } });
      setWished(res.wishlisted);
      await qc.invalidateQueries({ queryKey: ["account-overview"] });
    } finally {
      setWishing(false);
    }
  }

  if (isLoading) {
    return (
      <div className="mt-6 flex flex-wrap gap-3">
        <button disabled className="inline-flex items-center gap-2 rounded-md bg-gold px-6 py-3 text-sm font-semibold text-primary-foreground shadow-glow opacity-60">
          <Loader2 className="h-4 w-4 animate-spin" />
          Checking cart...
        </button>
        <button disabled className="inline-flex items-center gap-2 rounded-md border border-border px-6 py-3 text-sm font-medium text-muted-foreground opacity-60">
          <Heart className="h-4 w-4 text-gold" />
          Wishlist
        </button>
      </div>
    );
  }

  return (
    <div className="mt-6 flex flex-wrap gap-3">
      {inCart ? (
        <Link
          to="/cart"
          className="inline-flex items-center gap-2 rounded-md border border-gold-soft bg-background/40 px-6 py-3 text-sm font-medium text-foreground hover:border-gold"
        >
          <ShoppingBag className="h-4 w-4" />
          View in cart
        </Link>
      ) : (
        <button
          onClick={handleAdd}
          disabled={adding}
          className="inline-flex items-center gap-2 rounded-md bg-gold px-6 py-3 text-sm font-semibold text-primary-foreground shadow-glow hover:scale-[1.02] transition-transform disabled:opacity-60"
        >
          {adding ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : added ? (
            <Check className="h-4 w-4" />
          ) : (
            <ShoppingBag className="h-4 w-4" />
          )}
          {added ? "Added to cart" : "Add to cart"}
        </button>
      )}

      <button
        onClick={handleWish}
        disabled={wishing}
        className="inline-flex items-center gap-2 rounded-md border border-border px-6 py-3 text-sm font-medium text-muted-foreground hover:border-gold-soft hover:text-foreground disabled:opacity-60"
      >
        <Heart className={`h-4 w-4 ${wished ? "fill-gold text-gold" : "text-gold"}`} />
        {wished ? "Wishlisted" : "Wishlist"}
      </button>
    </div>
  );
}