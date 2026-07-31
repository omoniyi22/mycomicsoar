import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Search, ShoppingBag, Heart, User, Shield, Menu, LogOut } from "lucide-react";
import { useEffect, useState } from "react";
import { getCartCount } from "@/lib/cart.functions";
import { checkIsAdmin } from "@/lib/admin.functions";
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { supabase } from "@/integrations/supabase/client";
import logoUrl from "@/assets/comicsoar-logo.png";

const nav: { to: "/" | "/shop"; label: string; search?: Record<string, string> }[] = [
  { to: "/shop", label: "Mystery", search: { genre: "Mystery" } },
  { to: "/shop", label: "Adventures", search: { genre: "Action/Adventures" } },
  { to: "/shop", label: "Sci-fiction", search: { genre: "Sci fiction" } },
];
const nav2: { to: "/" | "/shop"; label: string; search?: Record<string, string> }[] = [
  { to: "/shop", label: "Comedy", search: { genre: "Comedy" } },
  { to: "/shop", label: "Non-Fiction", search: { genre: "Non-Fiction" } },
  { to: "/shop", label: "Heartwarming", search: { genre: "Heartwarming" } },
  { to: "/shop", label: "SuperHeroes", search: { genre: "SuperHeroes" } },
];

export function SiteHeader() {
  const fetchCount = useServerFn(getCartCount);
  const fetchAdmin = useServerFn(checkIsAdmin);
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const searchParams = useRouterState({ select: (s) => s.location.search as Record<string, unknown> });
  const [q, setQ] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (pathname === "/shop" && typeof searchParams.q === "string") setQ(searchParams.q);
  }, [pathname, searchParams]);

  const { data: cart } = useQuery({
    queryKey: ["cart-count"],
    queryFn: () => fetchCount().catch(() => ({ count: 0 })),
    staleTime: 30_000,
  });
  const { data: admin } = useQuery({
    queryKey: ["is-admin"],
    queryFn: () => fetchAdmin().catch(() => ({ admin: false })),
    staleTime: 5 * 60_000,
  });
  const cartCount = cart?.count ?? 0;

  function submitSearch(e: React.FormEvent) {
    e.preventDefault();
    const value = q.trim();
    navigate({ to: "/shop", search: { q: value || undefined } as never });
    setMenuOpen(false);
  }

  return (
    <header className="sticky top-0 z-40 border-b border-border/60 backdrop-blur-md bg-background/70">
      <div className="container-tight flex h-16 items-center gap-4">
        <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
          <SheetTrigger asChild>
            <button className="lg:hidden rounded-md p-2 text-muted-foreground hover:text-gold" aria-label="Open menu">
              <Menu className="h-5 w-5" />
            </button>
          </SheetTrigger>
          <SheetContent side="left" className="w-80">
            <SheetHeader>
              <SheetTitle className="font-display text-2xl">
                <span><span className="text-gold">Comic</span>Soar</span>
              </SheetTitle>
            </SheetHeader>

            <form onSubmit={submitSearch} className="mt-6 flex items-center gap-2 rounded-md border border-border bg-card/60 px-3 py-2">
              <Search className="h-4 w-4 text-muted-foreground" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search titles…"
                className="w-full bg-transparent text-sm focus:outline-none"
              />
            </form>
            <nav className="mt-6 flex flex-col gap-1">
              {[...nav, ...nav2].map((n) => (
                <Link
                  key={n.label}
                  to={n.to}
                  search={n.search as never}
                  onClick={() => setMenuOpen(false)}
                  className="rounded-md px-3 py-2 text-sm text-foreground hover:bg-card hover:text-gold"
                >
                  {n.label}
                </Link>
              ))}
              <div className="my-2 h-px bg-border" />
              <Link to="/account" onClick={() => setMenuOpen(false)} className="rounded-md px-3 py-2 text-sm hover:bg-card hover:text-gold">
                Account
              </Link>
              <Link to="/cart" onClick={() => setMenuOpen(false)} className="rounded-md px-3 py-2 text-sm hover:bg-card hover:text-gold">
                Cart {cartCount > 0 && <span className="ml-1 text-gold">({cartCount})</span>}
              </Link>
              {admin?.admin && (
                <Link to="/admin" onClick={() => setMenuOpen(false)} className="rounded-md px-3 py-2 text-sm text-gold hover:bg-card">
                  <Shield className="inline h-4 w-4 mr-1.5" /> Admin
                </Link>
              )}
              <button
                onClick={async () => { await supabase.auth.signOut(); setMenuOpen(false); navigate({ to: "/auth", replace: true }); }}
                className="mt-2 inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground hover:text-foreground"
              >
                <LogOut className="h-4 w-4" /> Sign out
              </button>
            </nav>
          </SheetContent>
        </Sheet>

        <Link to="/" className="flex items-center gap-2 shrink-0">
          <span className="flex items-center gap-1">
            <img src={logoUrl} alt="" className="h-8 w-8 object-contain" />
            <span className="font-display text-2xl tracking-wide text-gold">Comic</span>
            <span className="font-display text-2xl tracking-wide text-foreground">Soar</span>
          </span>
        </Link>


        <nav className="hidden lg:flex items-center gap-6 text-sm text-muted-foreground">
          {nav.map((n) => (
            <Link key={n.label} to={n.to} search={n.search as never} className="hover:text-gold transition-colors">
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <form onSubmit={submitSearch} className="hidden md:flex items-center gap-2 rounded-md border border-border bg-card/60 px-3 py-1.5 focus-within:border-gold-soft">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search titles, creators…"
              className="w-40 lg:w-64 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
            />
          </form>
          {admin?.admin && (
            <Link to="/admin" className="rounded-md p-2 text-gold hover:text-gold/80" aria-label="Admin">
              <Shield className="h-5 w-5" />
            </Link>
          )}
          <Link to="/account?section=wishlist" className="hidden sm:inline-flex rounded-md p-2 text-muted-foreground hover:text-gold transition-colors" aria-label="Wishlist">
            <Heart className="h-5 w-5" />
          </Link>
          <Link to="/account" className="rounded-md p-2 text-muted-foreground hover:text-gold transition-colors" aria-label="Account">
            <User className="h-5 w-5" />
          </Link>
          <Link to="/cart" className="relative rounded-md p-2 text-muted-foreground hover:text-gold transition-colors" aria-label="Cart">
            <ShoppingBag className="h-5 w-5" />
            {cartCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 grid h-4 min-w-4 px-1 place-items-center rounded-full bg-gold text-[10px] font-semibold text-primary-foreground">
                {cartCount}
              </span>
            )}
          </Link>
        </div>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="mt-32 border-t border-border/60 bg-ink">
      <div className="container-tight grid grid-cols-2 md:grid-cols-5 gap-10 py-16">
        <div className="col-span-2">
          <div className="flex items-center gap-2">
            <img src={logoUrl} alt="" className="h-8 w-8 object-contain" />
            <span className="font-display text-2xl text-gold">Comic</span>
            <span className="font-display text-2xl">Soar</span>
          </div>
          <p className="mt-3 max-w-sm text-sm text-muted-foreground">
            A digital comic e-book store. Buy once, read forever — instant downloads, no shipping, no waiting.
          </p>
        </div>
        {[
          { title: "Shop", items: ["Mystery", "Adventures", "SuperHeroes", "Sci fiction",] },
          { title: "Collect", items: ["Shop", "Library", "Cart", "Orders"] },
          { title: "Support", items: ["FAQ", "Reader", "Account", "Contact"] },
        ].map((col) => (
          <div key={col.title}>
            <h4 className="font-display text-lg text-foreground">{col.title}</h4>
            <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
              {col.items.map((i) => (
                <li key={i}>
                  <Link
                    to={col.title === "Shop" ? (i != "Adventures" ? `/shop?genre=${i}` : "/shop?genre=Action/Adventures") : col.title && (i == "Account" || i == "Cart" ||  i == "Shop") ? `/${i.toLowerCase()}` : col.title === "Collect" ? `/account?section=${i.toLowerCase()}` : `/support?tab=${i.toLowerCase()}`}
                    className="hover:text-gold transition-colors cursor-pointer"
                  >
                    {i}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-border/60 py-5 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} Comicsoar. 
      </div>
    </footer>

  );
}
