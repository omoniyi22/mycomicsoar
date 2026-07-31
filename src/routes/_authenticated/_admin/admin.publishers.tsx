import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import {
  listPublishersAdmin,
  createPublisher,
  updatePublisher,
  deletePublisher,
} from "@/lib/admin.functions";
import { ArrowLeft, Loader2, Plus, Trash2, Save } from "lucide-react";

const q = queryOptions({ queryKey: ["admin-publishers"], queryFn: () => listPublishersAdmin() });

export const Route = createFileRoute("/_authenticated/_admin/admin/publishers")({
  loader: ({ context }) => context.queryClient.ensureQueryData(q),
  head: () => ({ meta: [{ title: "Admin — Publishers" }] }),
  component: PublishersAdmin,
});

function PublishersAdmin() {
  const fetcher = useServerFn(listPublishersAdmin);
  const { data } = useSuspenseQuery({ ...q, queryFn: () => fetcher() });
  const create = useServerFn(createPublisher);
  const update = useServerFn(updatePublisher);
  const del = useServerFn(deletePublisher);
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function refresh() {
    await qc.invalidateQueries({ queryKey: ["admin-publishers"] });
  }

  async function submitNew(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    const f = new FormData(e.currentTarget);
    try {
      await create({
        data: {
          name: String(f.get("name") || "").trim(),
          slug: String(f.get("slug") || "").trim().toLowerCase().replace(/\s+/g, "-"),
          tagline: String(f.get("tagline") || "") || null,
          accent: String(f.get("accent") || "") || null,

        },
      });
      (e.currentTarget as HTMLFormElement).reset();
      await refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="container-tight py-10">
      <Link to="/admin" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-gold">
        <ArrowLeft className="h-3.5 w-3.5" /> Back to catalog
      </Link>
      <h1 className="mt-2 font-display text-3xl text-foreground">Publishers</h1>
      <p className="text-sm text-muted-foreground">{data.publishers.length} houses</p>

      <form onSubmit={submitNew} className="mt-6 grid gap-3 rounded-lg border border-border bg-card p-5 sm:grid-cols-4">
        <Input name="name" placeholder="Name" required />
        <Input name="slug" placeholder="slug" required />
        <Input name="tagline" placeholder="Tagline" />
        <Input name="accent" placeholder="Accent color (hex)" />
        <div className="sm:col-span-4 flex items-center justify-between">

          {err && <p className="text-sm text-red-400">{err}</p>}
          <button disabled={busy} className="ml-auto inline-flex items-center gap-2 rounded-md bg-gold px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Add publisher
          </button>
        </div>
      </form>

      <div className="mt-8 grid gap-3">
        {data.publishers.map((p: any) => (
          <PubRow key={p.id} pub={p} onSaved={refresh} onDeleted={refresh} update={update} del={del} />
        ))}
      </div>
    </main>
  );
}

function PubRow({
  pub,
  onSaved,
  onDeleted,
  update,
  del,
}: {
  pub: any;
  onSaved: () => void;
  onDeleted: () => void;
  update: ReturnType<typeof useServerFn<typeof updatePublisher>>;
  del: ReturnType<typeof useServerFn<typeof deletePublisher>>;
}) {
  const [busy, setBusy] = useState(false);
  const [state, setState] = useState({
    name: pub.name ?? "",
    slug: pub.slug ?? "",
    tagline: pub.tagline ?? "",
    accent: pub.accent ?? "",
  });

  async function save() {
    setBusy(true);
    try {
      await update({ data: { id: pub.id, patch: { ...state, tagline: state.tagline || null, accent: state.accent || null } } });
      onSaved();
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!confirm(`Delete "${pub.name}"? Comics keep their publisher_id but will show "—".`)) return;
    setBusy(true);
    try {
      await del({ data: { id: pub.id } });
      onDeleted();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Delete failed (likely linked comics).");
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-2 rounded-lg border border-border bg-card p-4 sm:grid-cols-[1fr_1fr_1fr_120px_auto] items-center">
      <Input value={state.name} onChange={(e) => setState((s) => ({ ...s, name: e.target.value }))} />
      <Input value={state.slug} onChange={(e) => setState((s) => ({ ...s, slug: e.target.value }))} />
      <Input value={state.tagline} onChange={(e) => setState((s) => ({ ...s, tagline: e.target.value }))} placeholder="Tagline" />
      <Input value={state.accent} onChange={(e) => setState((s) => ({ ...s, accent: e.target.value }))} placeholder="Accent" />

      <div className="flex gap-1 justify-end">
        <button onClick={save} disabled={busy} className="rounded-md bg-gold p-2 text-primary-foreground disabled:opacity-60" aria-label="Save">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
        </button>
        <button onClick={remove} disabled={busy} className="rounded-md border border-border p-2 text-red-400 hover:border-red-400" aria-label="Delete">
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`rounded-md border border-border bg-background/40 px-3 py-2 text-sm focus:outline-none focus:border-gold-soft ${props.className ?? ""}`} />;
}
