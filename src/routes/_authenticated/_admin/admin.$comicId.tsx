import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import {
  getAdminComic,
  updateComic,
  deleteComic,
  uploadComicPdf,
  uploadCoverImage,
  deleteComicPageOrientation,
  cleanComicImages,
} from "@/lib/admin.functions";
import { Loader2, Trash2, Upload, FileText, BookOpen, Image as ImageIcon } from "lucide-react";
import { fileToBase64 } from "@/lib/file-utils";
import { ComicPageManager } from "@/components/admin/comic-page-manager";
import { resolveCover } from "@/lib/covers";

const detailQuery = (id: string) =>
  queryOptions({
    queryKey: ["admin-comic", id],
    queryFn: () => getAdminComic({ data: { id } }),
  });

export const Route = createFileRoute("/_authenticated/_admin/admin/$comicId")({
  loader: ({ context, params }) =>
    context.queryClient.ensureQueryData(detailQuery(params.comicId)),
  head: () => ({ meta: [{ title: "Admin — Edit comic" }] }),
  component: EditComicPage,
});

function EditComicPage() {
  const { comicId } = Route.useParams();
  const fetcher = useServerFn(getAdminComic);
  const { data } = useSuspenseQuery({
    ...detailQuery(comicId),
    queryFn: () => fetcher({ data: { id: comicId } }),
  });
  const update = useServerFn(updateComic);
  const del = useServerFn(deleteComic);
  const uploadPdf = useServerFn(uploadComicPdf);
  const uploadCover = useServerFn(uploadCoverImage);
  const deletePageOrientation = useServerFn(deleteComicPageOrientation);
  const cleanFn = useServerFn(cleanComicImages);
  const qc = useQueryClient();
  const navigate = useNavigate();

  const [busy, setBusy] = useState(false);
  const [uploadBusy, setUploadBusy] = useState(false);
  const [coverBusy, setCoverBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [coverUrl, setCoverUrl] = useState(data.comic?.cover_url ?? "");

  const [deletePageIndex, setDeletePageIndex] = useState<number>(1);
  const [deleteOrientation, setDeleteOrientation] = useState<"portrait" | "landscape" | "both">("both");
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [cleanBusy, setCleanBusy] = useState(false);

  const c = data.comic;
  if (!c)
    return (
      <main className="p-10 text-center text-muted-foreground">
        Comic not found.
      </main>
    );

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErr(null);
    setMsg(null);
    setBusy(true);
    const f = new FormData(e.currentTarget);
    const patch: any = {
      title: f.get("title"),
      slug: String(f.get("slug")).trim().toLowerCase().replace(/\s+/g, "-"),
      writer: f.get("writer") || null,
      artist: f.get("artist") || null,
      cover_url: f.get("cover_url") || null,
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
      is_bestseller: f.get("is_bestseller") === "on",
      is_trending: f.get("is_trending") === "on",
    };

    try {
      await update({ data: { id: comicId, patch } });
      await qc.invalidateQueries({ queryKey: ["admin-comic", comicId] });
      setMsg("Saved.");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  async function handlePdf(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setErr(null);
    setMsg(null);
    setUploadBusy(true);
    try {
      const base64 = await fileToBase64(file);

      let pageCount = 0;
      try {
        const buf = await file.arrayBuffer();
        const pdfjs: any = await import("pdfjs-dist");
        pdfjs.GlobalWorkerOptions.workerSrc = new URL(
          "pdfjs-dist/build/pdf.worker.min.mjs",
          import.meta.url
        ).toString();
        const doc = await pdfjs.getDocument({ data: buf.slice(0) }).promise;
        pageCount = doc.numPages;
      } catch {
        /* ignore */
      }

      await uploadPdf({ data: { comicId, filename: file.name, base64, pageCount } });
      await qc.invalidateQueries({ queryKey: ["admin-comic", comicId] });
      setMsg(`PDF uploaded${pageCount ? ` · ${pageCount} pages` : ""}.`);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploadBusy(false);
      e.target.value = "";
    }
  }

  async function handleCover(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setErr(null);
    setMsg(null);
    setCoverBusy(true);
    try {
      const base64 = await fileToBase64(file);
      const { url } = await uploadCover({
        data: { filename: file.name, contentType: file.type, base64 },
      });
      setCoverUrl(url);
      await update({ data: { id: comicId, patch: { cover_url: url } } });
      await qc.invalidateQueries({ queryKey: ["admin-comic", comicId] });
      setMsg("Cover uploaded.");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Cover upload failed");
    } finally {
      setCoverBusy(false);
      e.target.value = "";
    }
  }

  async function handleDelete() {
    if (!confirm("Delete this comic? This cannot be undone.")) return;
    await del({ data: { id: comicId } });
    await qc.invalidateQueries({ queryKey: ["admin-comics"] });
    navigate({ to: "/admin" });
  }

  async function handleClean() {
    if (!confirm("Delete orphaned images from R2 storage? This cannot be undone.")) return;
    setCleanBusy(true);
    setErr(null);
    setMsg(null);
    try {
      const { deletedCount } = await cleanFn({ data: { comicId } });
      setMsg(`Cleaned up ${deletedCount} orphaned image(s).`);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Cleanup failed");
    } finally {
      setCleanBusy(false);
    }
  }

  async function handleDeletePageOrientation() {
    if (!confirm(`Delete ${deleteOrientation} version of page ${deletePageIndex}?`)) return;
    setDeleteBusy(true);
    setErr(null);
    setMsg(null);
    try {
      await deletePageOrientation({
        data: {
          comicId,
          pageIndex: deletePageIndex,
          orientation: deleteOrientation,
        },
      });
      await qc.invalidateQueries({ queryKey: ["admin-comic", comicId] });
      setMsg(`Deleted ${deleteOrientation} for page ${deletePageIndex}.`);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Deletion failed");
    } finally {
      setDeleteBusy(false);
    }
  }

  return (
    <main className="container-tight py-10">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-3xl text-foreground">{c.title}</h1>
        <div className="flex gap-2">
          <Link
            to="/comics/$slug"
            params={{ slug: c.slug }}
            className="text-xs text-muted-foreground hover:text-gold"
          >
            View public →
          </Link>
          <button
            onClick={handleDelete}
            className="inline-flex items-center gap-1 text-xs text-red-400 hover:text-red-300"
          >
            <Trash2 className="h-3.5 w-3.5" /> Delete
          </button>
          <button
            onClick={handleClean}
            disabled={cleanBusy}
            className="inline-flex items-center gap-1 text-xs text-yellow-400 hover:text-yellow-300 disabled:opacity-50"
          >
            {cleanBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
            Clean
          </button>
        </div>
      </div>

      <ComicPageManager comicId={comicId} />

      <section className="mt-6 rounded-lg border border-border bg-card p-6">
        <h3 className="font-display text-lg text-foreground">Delete page orientation</h3>
        <p className="text-xs text-muted-foreground">
          Remove only the portrait, landscape, or both versions of a specific page.
        </p>
        <div className="mt-4 flex flex-wrap items-end gap-4">
          <label className="block">
            <span className="text-xs uppercase tracking-wider text-muted-foreground">Page index</span>
            <input
              type="number"
              min={1}
              value={deletePageIndex}
              onChange={(e) => setDeletePageIndex(Number(e.target.value))}
              className="mt-1 w-24 rounded-md border border-border bg-background/40 px-3 py-2 text-sm"
            />
          </label>
          <label className="block">
            <span className="text-xs uppercase tracking-wider text-muted-foreground">Orientation</span>
            <select
              value={deleteOrientation}
              onChange={(e) => setDeleteOrientation(e.target.value as any)}
              className="mt-1 rounded-md border border-border bg-background/40 px-3 py-2 text-sm"
            >
              <option value="portrait">Portrait</option>
              <option value="landscape">Landscape</option>
              <option value="both">Both</option>
            </select>
          </label>
          <button
            onClick={handleDeletePageOrientation}
            disabled={deleteBusy}
            className="inline-flex items-center gap-2 rounded-md bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
          >
            {deleteBusy && <Loader2 className="h-4 w-4 animate-spin" />}
            <Trash2 className="h-4 w-4" />
            Delete
          </button>
        </div>
      </section>

      <section className="mt-6 rounded-lg border border-border bg-card p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-display text-xl text-foreground">
              Legacy PDF upload
            </h2>
            <p className="text-xs text-muted-foreground">
              {c.pdf_path ? (
                <>
                  <FileText className="inline h-3.5 w-3.5 text-gold" />{" "}
                  {c.pdf_path.split("/").pop()} · {c.page_count || "?"} pages
                </>
              ) : (
                "Optional — pages above auto-generate a PDF on demand."
              )}
            </p>
          </div>
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-border px-4 py-2 text-sm font-semibold text-foreground hover:bg-background/40">
            {uploadBusy ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Upload className="h-4 w-4" />
            )}
            Replace PDF
            <input
              type="file"
              accept="application/pdf"
              onChange={handlePdf}
              disabled={uploadBusy}
              className="hidden"
            />
          </label>
        </div>
        {c.pdf_path && (
          <Link
            to="/reader/$slug"
            params={{ slug: c.slug }}
            className="mt-3 inline-flex items-center gap-2 text-xs text-gold hover:underline"
          >
            <BookOpen className="h-3.5 w-3.5" /> Open reader
          </Link>
        )}
      </section>

      <form
        onSubmit={submit}
        className="mt-6 grid gap-4 rounded-lg border border-border bg-card p-6"
      >
        <Row>
          <F label="Title" name="title" defaultValue={c.title} required />
          <F label="Slug" name="slug" defaultValue={c.slug} required />
        </Row>
        <Row>
          <F label="Writer" name="writer" defaultValue={c.writer ?? ""} />
          <F label="Artist" name="artist" defaultValue={c.artist ?? ""} />
        </Row>
        <Row>
          <F
            label="Price (USD $)"
            name="price"
            type="number"
            step="0.01"
            defaultValue={String(c.price)}
          />
          <F
            label="Price (NGN ₦) — optional"
            name="price_ngn"
            type="number"
            step="1"
            defaultValue={c.price_ngn != null ? String(c.price_ngn) : ""}
            placeholder="e.g. 7500"
          />
        </Row>
        <Row>
          <F
            label="Price (EUR €) — optional"
            name="price_eur"
            type="number"
            step="0.01"
            defaultValue={
              (c as any).price_eur != null ? String((c as any).price_eur) : ""
            }
            placeholder="e.g. 4.99"
          />
          <div />
        </Row>

        <Row>
          <F
            label="Rating"
            name="rating"
            type="number"
            step="0.1"
            max="5"
            defaultValue={String(c.rating)}
          />
          <F
            label="Release date"
            name="release_date"
            type="date"
            defaultValue={c.release_date ?? ""}
          />
        </Row>

        <Row>
          <F label="Format" name="format" defaultValue={c.format ?? ""} />
          <label className="block">
            <span className="text-xs uppercase tracking-wider text-muted-foreground">
              Genre
            </span>
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
            <span className="text-xs uppercase tracking-wider text-muted-foreground">
              Publisher
            </span>
            <select
              name="publisher_id"
              defaultValue={c.publisher_id ?? ""}
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
          <div className="flex items-start gap-4">
            <img
              src={resolveCover(coverUrl)}
              alt=""
              className="h-32 w-24 rounded object-cover shadow-elegant"
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
                <ImageIcon className="h-3.5 w-3.5" /> Cover image
              </div>
              <label className="mt-2 inline-flex cursor-pointer items-center gap-2 rounded-md bg-gold px-3 py-1.5 text-sm font-semibold text-primary-foreground">
                {coverBusy ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="h-4 w-4" />
                )}
                Upload new cover
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleCover}
                  disabled={coverBusy}
                  className="hidden"
                />
              </label>
              <label className="mt-3 block">
                <span className="text-xs uppercase tracking-wider text-muted-foreground">
                  …or paste URL / asset key
                </span>
                <input
                  name="cover_url"
                  value={coverUrl}
                  onChange={(e) => setCoverUrl(e.target.value)}
                  className="mt-1 w-full rounded-md border border-border bg-background/40 px-3 py-2 text-sm focus:outline-none focus:border-gold-soft"
                />
              </label>
            </div>
          </div>
        </div>

        <label className="block">
          <span className="text-xs uppercase tracking-wider text-muted-foreground">
            Synopsis
          </span>
          <textarea
            name="synopsis"
            defaultValue={c.synopsis ?? ""}
            rows={4}
            className="mt-1 w-full rounded-md border border-border bg-background/40 px-3 py-2 text-sm"
          />
        </label>

        <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
          {[
            ["is_new", "New", c.is_new],
            ["is_featured", "Featured", c.is_featured],
            ["is_bestseller", "Bestseller", c.is_bestseller],
            ["is_trending", "Trending", c.is_trending],
          ].map(([n, l, v]) => (
            <label key={n as string} className="flex items-center gap-2">
              <input type="checkbox" name={n as string} defaultChecked={v as boolean} />{" "}
              {l as string}
            </label>
          ))}
        </div>

        {msg && <p className="text-sm text-gold">{msg}</p>}
        {err && <p className="text-sm text-red-400">{err}</p>}

        <button
          disabled={busy}
          className="inline-flex items-center justify-center gap-2 rounded-md bg-gold px-5 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-60"
        >
          {busy && <Loader2 className="h-4 w-4 animate-spin" />}
          Save changes
        </button>
      </form>
    </main>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-4 sm:grid-cols-2">{children}</div>;
}

function F({
  label,
  name,
  ...rest
}: { label: string; name: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="block">
      <span className="text-xs uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      <input
        name={name}
        {...rest}
        className="mt-1 w-full rounded-md border border-border bg-background/40 px-3 py-2 text-sm focus:outline-none focus:border-gold-soft"
      />
    </label>
  );
}