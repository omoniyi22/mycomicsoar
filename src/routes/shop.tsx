import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { Search, SlidersHorizontal, X } from "lucide-react";
import { getShopData, type ShopFilters } from "@/lib/catalog.functions";
import { ComicCard } from "@/components/comic-card";
import { SiteHeader, SiteFooter } from "@/components/site-chrome";
import { useLayoutEffect, useRef, useEffect } from "react";

const SORTS = [
  { value: "new", label: "Newest first" },
  { value: "rating", label: "Top rated" },
  { value: "price-asc", label: "Price: low to high" },
  { value: "price-desc", label: "Price: high to low" },
] as const;

function validateSearch(s: Record<string, unknown>): ShopFilters {
  const sort = s.sort as ShopFilters["sort"];
  return {
    q: typeof s.q === "string" ? s.q : undefined,
    publisher: typeof s.publisher === "string" ? s.publisher : undefined,
    genre: typeof s.genre === "string" ? s.genre : undefined,
    format: typeof s.format === "string" ? s.format : undefined,
    sort: SORTS.some((x) => x.value === sort) ? sort : undefined,
  };
}

const shopQuery = (filters: ShopFilters) =>
  queryOptions({
    queryKey: ["shop", filters],
    queryFn: () => getShopData({ data: filters }),
  });

// ---- always fetch all genres (unfiltered) ----
const genresQueryOptions = queryOptions({
  queryKey: ["genres"],
  queryFn: () => getShopData({ data: { sort: "new" } }),
  select: (data) => data.genres,
  staleTime: Infinity,
});

export const Route = createFileRoute("/shop")({
  validateSearch,
  loaderDeps: ({ search }) => search,
  loader: ({ context, deps }) => context.queryClient.ensureQueryData(shopQuery(deps)),
  head: () => ({
    meta: [
      { title: "Shop — Vault & Quill" },
      { name: "description", content: "Browse our entire comics catalog. Filter by publisher, genre, and format." },
      { property: "og:title", content: "Shop — Vault & Quill" },
      { property: "og:description", content: "New releases, graphic novels, manga, and back issues." },
    ],
  }),
  component: ShopPage,
});

function ShopPage() {
  const filters = Route.useSearch();
  const { data } = useSuspenseQuery(shopQuery(filters));
  const { data: allGenres } = useSuspenseQuery(genresQueryOptions);
  const navigate = useNavigate({ from: "/shop" });

  // ---- disable browser auto-scroll restoration ----
  useEffect(() => {
    const original = window.history.scrollRestoration;
    window.history.scrollRestoration = "manual";
    return () => {
      window.history.scrollRestoration = original;
    };
  }, []);

  // ---- manual scroll preservation ----
  const scrollPosRef = useRef(0);

  const update = (patch: Partial<ShopFilters>) => {
    scrollPosRef.current = window.scrollY;
    navigate({
      search: (prev: ShopFilters) => ({ ...prev, ...patch }),
      scroll: false,
      replace: true,
    });
  };

  useLayoutEffect(() => {
    if (scrollPosRef.current > 0) {
      window.scrollTo(0, scrollPosRef.current);
      scrollPosRef.current = 0;
    }
  }, [filters]);

  const activeChips = Object.entries(filters).filter(([, v]) => v) as [keyof ShopFilters, string][];

  return (
    <div className="min-h-screen bg-vignette">
      <SiteHeader />

      <header className="border-b border-border/60 bg-background/40">
        <div className="container-tight py-12 md:py-16">
          <div className="text-xs uppercase tracking-[0.25em] text-gold">The Catalog</div>
          <h1 className="mt-2 font-display text-4xl md:text-5xl text-foreground">
            Every shelf in the vault.
          </h1>
          <p className="mt-3 max-w-xl text-sm text-muted-foreground">
            {data.total} titles in stock. Filter by house, genre, or format.
          </p>
        </div>
      </header>

      <main className="container-tight py-10 grid lg:grid-cols-[260px_1fr] gap-10">
        <aside className="space-y-8">
          {/* Search */}
          <div>
            <label className="flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2 focus-within:border-gold-soft">
              <Search className="h-4 w-4 text-muted-foreground" />
              <input
                value={filters.q ?? ""}
                onChange={(e) => update({ q: e.target.value || undefined })}
                placeholder="Search titles…"
                className="w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
              />
            </label>
          </div>

          <FilterGroup title="Genre">
            <FilterPill active={!filters.genre} onClick={() => update({ genre: undefined })}>
              Any
            </FilterPill>
            {allGenres.map((g) => (
              <FilterPill key={g} active={filters.genre === g} onClick={() => update({ genre: g })}>
                {g}
              </FilterPill>
            ))}
          </FilterGroup>
          {/* Publishers */}
          {/* <FilterGroup title="Publisher">
            <FilterPill active={!filters.publisher} onClick={() => update({ publisher: undefined })}>
              All houses
            </FilterPill>
            {data.publishers.map((p) => (
              <FilterPill
                key={p.slug}
                active={filters.publisher === p.slug}
                onClick={() => update({ publisher: p.slug })}
              >
                {p.name}
              </FilterPill>
            ))}
          </FilterGroup> */}




        </aside>

        <section>
          <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <SlidersHorizontal className="h-4 w-4 text-gold" />
              {data.comics.length} {data.comics.length === 1 ? "title" : "titles"}
              {activeChips.length > 0 && (
                <div className="ml-2 flex flex-wrap gap-2">
                  {activeChips.map(([k, v]) => (
                    <button
                      key={k}
                      onClick={() => update({ [k]: undefined } as Partial<ShopFilters>)}
                      className="inline-flex items-center gap-1 rounded-full border border-gold-soft px-2.5 py-0.5 text-[11px] text-foreground hover:border-gold"
                    >
                      {v}
                      <X className="h-3 w-3" />
                    </button>
                  ))}
                </div>
              )}
            </div>
            <select
              value={filters.sort ?? "new"}
              onChange={(e) => update({ sort: e.target.value as ShopFilters["sort"] })}
              className="rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground focus:outline-none focus:border-gold-soft"
            >
              {SORTS.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>

          {data.comics.length === 0 ? (
            <div className="rounded-lg border border-border bg-card p-16 text-center">
              <p className="font-display text-2xl text-foreground">No titles match.</p>
              <p className="mt-2 text-sm text-muted-foreground">Try clearing a filter or two.</p>
              <Link
                to="/shop"
                search={{}}
                scroll={false}
                replace={true}
                className="mt-6 inline-block rounded-md bg-gold px-5 py-2.5 text-sm font-semibold text-primary-foreground"
              >
                Reset filters
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-10">
              {data.comics.map((c) => (
                <ComicCard key={c.id} comic={c} />
              ))}
            </div>
          )}
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}

// ---- Helper components ----
function FilterGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="mb-3 text-xs uppercase tracking-[0.2em] text-gold">{title}</h3>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

function FilterPill({
  active,
  onClick,
  children,
}: {
  active?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full border px-3 py-1 text-xs transition-colors ${active
          ? "border-gold bg-gold/10 text-foreground"
          : "border-border text-muted-foreground hover:border-gold-soft hover:text-foreground"
        }`}
    >
      {children}
    </button>
  );
}