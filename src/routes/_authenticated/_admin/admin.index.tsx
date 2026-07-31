import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listAdminComics, updateComic } from "@/lib/admin.functions";
import { FileText, Plus } from "lucide-react";
import { useState } from "react";

const q = queryOptions({ queryKey: ["admin-comics"], queryFn: () => listAdminComics() });

export const Route = createFileRoute("/_authenticated/_admin/admin/")({
  loader: ({ context }) => context.queryClient.ensureQueryData(q),
  head: () => ({ meta: [{ title: "Admin — Comics" }] }),
  component: AdminComicsList,
});

function AdminComicsList() {
  const fetcher = useServerFn(listAdminComics);
  const updateComicFn = useServerFn(updateComic);
  const queryClient = useQueryClient();
  const { data } = useSuspenseQuery({ ...q, queryFn: () => fetcher() });
  const [updating, setUpdating] = useState<string | null>(null);

  const handleStatusChange = async (comicId: string, newStatus: string) => {
    setUpdating(comicId);
    try {
      await updateComicFn({ data: { id: comicId, patch: { status: newStatus } } });
      await queryClient.invalidateQueries({ queryKey: ["admin-comics"] });
    } catch (e) {
      console.error("Failed to update status", e);
    } finally {
      setUpdating(null);
    }
  };

  return (
    <main className="container-tight py-10">
      <header className="mb-6 flex items-end justify-between">
        <div>
          <h1 className="font-display text-3xl text-foreground">Catalog</h1>
          <p className="text-sm text-muted-foreground">{data.comics.length} comics in the vault</p>
        </div>
        <div className="flex gap-2">
          <Link to="/admin/publishers" className="inline-flex items-center gap-2 rounded-md border border-border px-4 py-2 text-sm text-foreground hover:border-gold-soft">
            Publishers
          </Link>
          <Link to="/admin/soundtracks" className="inline-flex items-center gap-2 rounded-md border border-border px-4 py-2 text-sm text-foreground hover:border-gold-soft">
            Soundtracks
          </Link>
          <Link to="/admin/new" className="inline-flex items-center gap-2 rounded-md bg-gold px-4 py-2 text-sm font-semibold text-primary-foreground">
            <Plus className="h-4 w-4" /> New comic
          </Link>
        </div>
      </header>

      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-background/60 text-left text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Title</th>
              <th className="px-4 py-3">Publisher</th>
              <th className="px-4 py-3">Price</th>
              <th className="px-4 py-3">PDF</th>
              <th className="px-4 py-3">Pages</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {data.comics.map((c: any) => {
              const status = c.status || "published";
              return (
                <tr key={c.id} className="hover:bg-background/40">
                  <td className="px-4 py-3">
                    <div className="font-display text-foreground">{c.title}</div>
                    <div className="text-xs text-muted-foreground">/{c.slug}</div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{c.publisher?.name ?? "—"}</td>
                  <td className="px-4 py-3 font-mono text-gold">${Number(c.price).toFixed(2)}</td>
                  <td className="px-4 py-3">
                    {c.pdf_path ? <span className="inline-flex items-center gap-1 text-xs text-gold"><FileText className="h-3.5 w-3.5" /> Yes</span> : <span className="text-xs text-muted-foreground">—</span>}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{c.page_count || "—"}</td>
                  <td className="px-4 py-3">
                    <select
                      value={status}
                      onChange={(e) => handleStatusChange(c.id, e.target.value)}
                      disabled={updating === c.id}
                      className="rounded border border-border bg-background px-2 py-0.5 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-gold"
                    >
                      <option value="draft">Draft</option>
                      <option value="published">Published</option>
                      <option value="archived">Archived</option>
                    </select>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link to="/admin/$comicId" params={{ comicId: c.id }} className="text-gold hover:underline text-xs">Edit →</Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </main>
  );
}