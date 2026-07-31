import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { BookOpen, Download, Loader2 } from "lucide-react";
import { useState } from "react";
import { getAccountOverview, getDownloadUrl } from "@/lib/account.functions";
import { resolveCover } from "@/lib/covers";
import { SiteHeader, SiteFooter } from "@/components/site-chrome";

const libraryQuery = queryOptions({
  queryKey: ["library"],
  queryFn: () => getAccountOverview(),
});

export const Route = createFileRoute("/_authenticated/library")({
  head: () => ({
    meta: [
      { title: "Your Library — ComicSoar" },
      { name: "description", content: "Every ComicSoar e-book you own — read in the browser or download the PDF." },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(libraryQuery),
  component: LibraryPage,
});

function LibraryPage() {
  const fetchOverview = useServerFn(getAccountOverview);
  const { data } = useSuspenseQuery({ ...libraryQuery, queryFn: () => fetchOverview() });
  const download = useServerFn(getDownloadUrl);
  const [busy, setBusy] = useState<string | null>(null);

  async function handleDownload(purchaseId: string) {
    setBusy(purchaseId);
    try {
      const { url } = await download({ data: { purchaseId } });
      window.open(url, "_blank");
    } finally {
      setBusy(null);
    }
  }


  return (
    <div className="min-h-screen bg-vignette">
      <SiteHeader />
      <main className="container-tight py-12">
        <div className="flex items-end justify-between gap-4 mb-8">
          <div>
            <div className="text-xs uppercase tracking-[0.25em] text-gold flex items-center gap-2">
              <BookOpen className="h-4 w-4" /> Your Library
            </div>
            <h1 className="mt-2 font-display text-4xl md:text-5xl">Every e-book you own</h1>
            <p className="mt-2 text-sm text-muted-foreground max-w-lg">
              Read instantly in the browser or download the PDF to keep offline.
            </p>
          </div>
        </div>

        {data.library.length === 0 ? (
          <div className="rounded-xl border border-border bg-card/60 p-12 text-center">
            <p className="text-muted-foreground mb-4">Your library is empty.</p>
            <Link to="/shop" className="text-gold underline">Browse the store</Link>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-6 gap-y-10">
            {data.library.map((item) => (
              <div key={item.id} className="group">
                <Link
                  to="/reader/$slug"
                  params={{ slug: item.comic.slug }}
                  className="block overflow-hidden rounded-md border border-border bg-card hover:border-gold-soft transition-colors"
                >
                  <img
                    src={resolveCover(item.comic.cover_url)}
                    alt={item.comic.title}
                    className="w-full aspect-[2/3] object-cover"
                    loading="lazy"
                  />
                </Link>
                <div className="mt-3">
                  <Link
                    to="/reader/$slug"
                    params={{ slug: item.comic.slug }}
                    className="font-display text-base line-clamp-1 hover:text-gold"
                  >
                    {item.comic.title}
                  </Link>
                  <div className="text-[11px] text-muted-foreground line-clamp-1">
                    {item.comic.writer ?? item.comic.format}
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <Link
                      to="/reader/$slug"
                      params={{ slug: item.comic.slug }}
                      className="inline-flex items-center gap-1 rounded-md bg-gold px-2.5 py-1 text-[11px] font-semibold text-primary-foreground"
                    >
                      <BookOpen className="h-3 w-3" /> Read
                    </Link>
                    <button
                      onClick={() => handleDownload(item.id)}
                      disabled={busy === item.id}
                      className="inline-flex items-center gap-1 rounded-md border border-border px-2.5 py-1 text-[11px] hover:border-gold-soft"
                    >
                      {busy === item.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Download className="h-3 w-3" />}
                      PDF
                    </button>

                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
