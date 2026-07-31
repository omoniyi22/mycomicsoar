import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { createComic, listPublishersAdmin, uploadCoverImage } from "@/lib/admin.functions";
import { Loader2, Upload } from "lucide-react";
import { fileToBase64 } from "@/lib/file-utils";

const pubsQuery = queryOptions({ queryKey: ["admin-publishers"], queryFn: () => listPublishersAdmin() });

export const Route = createFileRoute("/_authenticated/_admin/admin/new")({
  loader: ({ context }) => context.queryClient.ensureQueryData(pubsQuery),
  head: () => ({ meta: [{ title: "Admin — New comic" }] }),
  component: NewComicPage,
});

function NewComicPage() {
  const fetcher = useServerFn(listPublishersAdmin);
  const { data } = useSuspenseQuery({ ...pubsQuery, queryFn: () => fetcher() });
  const create = useServerFn(createComic);
  const upload = useServerFn(uploadCoverImage);
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [coverUrl, setCoverUrl] = useState("");
  const [err, setErr] = useState<string | null>(null);

  async function pickCover(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setErr(null);
    try {
      const base64 = await fileToBase64(file);
      const { url } = await upload({ data: { filename: file.name, contentType: file.type, base64 } });
      setCoverUrl(url);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    const f = new FormData(e.currentTarget);
    const payload: any = {
      title: f.get("title"),
      slug: String(f.get("slug")).trim().toLowerCase().replace(/\s+/g, "-"),
      writer: f.get("writer") || null,
      artist: f.get("artist") || null,
      cover_url: coverUrl || f.get("cover_url") || null,
      price: Number(f.get("price") || 0),
      price_ngn: f.get("price_ngn") ? Number(f.get("price_ngn")) : null,
      price_eur: f.get("price_eur") ? Number(f.get("price_eur")) : null,
      rating: Number(f.get("rating") || 0),
      release_date: f.get("release_date") || null,
      format: f.get("format") || null,
      genre: f.get("genre") || null,
      synopsis: f.get("synopsis") || null,
      publisher_id: f.get("publisher_id") || null,
      is_new: f.get("is_new") === "on",
      is_featured: f.get("is_featured") === "on",
      status: f.get("status") || "published", // <-- added status
    };

    try {
      const { id } = await create({ data: payload });
      navigate({ to: "/admin/$comicId", params: { comicId: id } });
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed");
      setBusy(false);
    }
  }

  return (
    <main className="container-tight py-10">
      <h1 className="font-display text-3xl text-foreground">New comic</h1>
      <p className="text-sm text-muted-foreground">Create the listing, then upload the PDF on the edit page.</p>

      <form onSubmit={submit} className="mt-6 grid gap-4 rounded-lg border border-border bg-card p-6">
        <Row>
          <F label="Title" name="title" required />
          <F label="Slug" name="slug" required placeholder="amazing-issue-1" />
        </Row>
        <Row>
          <F label="Writer" name="writer" />
          <F label="Artist" name="artist" />
        </Row>
        <Row>
          <F label="Price (USD $)" name="price" type="number" step="0.01" defaultValue="4.99" />
          <F label="Price (NGN ₦) — optional" name="price_ngn" type="number" step="1" placeholder="e.g. 7500" />
        </Row>
        <Row>
          <F label="Price (EUR €) — optional" name="price_eur" type="number" step="0.01" placeholder="e.g. 4.99" />
          <div />
        </Row>

        <Row>
          <F label="Rating" name="rating" type="number" step="0.1" max="5" defaultValue="4.5" />
          <F label="Release date" name="release_date" type="date" />
        </Row>

        <Row>
          <F label="Format" name="format" placeholder="Single Issue" />
          <label className="block">
            <span className="text-xs uppercase tracking-wider text-muted-foreground">Genre</span>
            <select
              name="genre"
              className="mt-1 w-full rounded-md border border-border bg-background/40 px-3 py-2 text-sm focus:outline-none focus:border-gold-soft"
            >
              <option value="">Select genre</option>
              <option value="Superhero">SuperHeroes</option>
              <option value="Action/Adventures">Action/Adventures</option>
              <option value="Sci fiction">Sci fiction</option>
              <option value="Comedy">Comedy</option>
              <option value="Non-Fiction">Non-Fiction</option>
              <option value="Heartwarming">Heartwarming</option>
              <option value="Mystery">Mystery</option>
            </select>
          </label>
        </Row>

        <Row>
          <label className="block">
            <span className="text-xs uppercase tracking-wider text-muted-foreground">Publisher</span>
            <select
              name="publisher_id"
              className="mt-1 w-full rounded-md border border-border bg-background/40 px-3 py-2 text-sm"
            >
              <option value="">—</option>
              {data.publishers.map((p: any) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          <div />
        </Row>

        <div className="rounded-md border border-border bg-background/40 p-4">
          <div className="flex flex-wrap items-center gap-4">
            {coverUrl ? (
              <img src={coverUrl} alt="" className="h-24 w-16 rounded object-cover shadow-elegant" />
            ) : (
              <div className="grid h-24 w-16 place-items-center rounded border border-dashed border-border text-xs text-muted-foreground">
                No cover
              </div>
            )}
            <label className="inline-flex items-center gap-2 rounded-md bg-gold px-3 py-1.5 text-sm font-semibold text-primary-foreground cursor-pointer">
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              Upload cover image
              <input
                type="file"
                accept="image/*"
                onChange={pickCover}
                disabled={uploading}
                className="hidden"
              />
            </label>
          </div>
          <label className="mt-3 block">
            <span className="text-xs uppercase tracking-wider text-muted-foreground">…or paste a cover URL / asset key</span>
            <input
              name="cover_url"
              value={coverUrl}
              onChange={(e) => setCoverUrl(e.target.value)}
              placeholder="https://…  or  cover-3"
              className="mt-1 w-full rounded-md border border-border bg-background/40 px-3 py-2 text-sm focus:outline-none focus:border-gold-soft"
            />
          </label>
        </div>

        <label className="block">
          <span className="text-xs uppercase tracking-wider text-muted-foreground">Synopsis</span>
          <textarea
            name="synopsis"
            rows={4}
            className="mt-1 w-full rounded-md border border-border bg-background/40 px-3 py-2 text-sm"
          />
        </label>

        <div className="flex flex-wrap gap-6 text-sm">
          <label className="flex items-center gap-2">
            <input type="checkbox" name="is_new" defaultChecked /> New release
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" name="is_featured" /> Featured
          </label>
        </div>

        <label className="block">
          <span className="text-xs uppercase tracking-wider text-muted-foreground">Status</span>
          <select
            name="status"
            className="mt-1 w-full rounded-md border border-border bg-background/40 px-3 py-2 text-sm focus:outline-none focus:border-gold-soft"
          >
            <option value="draft">Draft</option>
            <option value="published" selected>Published</option>
            <option value="archived">Archived</option>
          </select>
        </label>

        {err && <p className="text-sm text-red-400">{err}</p>}
        <button
          disabled={busy}
          className="inline-flex justify-center items-center gap-2 rounded-md bg-gold px-5 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-60"
        >
          {busy && <Loader2 className="h-4 w-4 animate-spin" />}
          Create comic
        </button>
      </form>
    </main>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return <div className="grid sm:grid-cols-2 gap-4">{children}</div>;
}

function F({
  label,
  name,
  ...rest
}: { label: string; name: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="block">
      <span className="text-xs uppercase tracking-wider text-muted-foreground">{label}</span>
      <input
        name={name}
        {...rest}
        className="mt-1 w-full rounded-md border border-border bg-background/40 px-3 py-2 text-sm focus:outline-none focus:border-gold-soft"
      />
    </label>
  );
}