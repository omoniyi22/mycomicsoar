import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertAdmin(supabase: any) {
  const { data, error } = await supabase.rpc("is_admin");
  if (error || !data) throw new Error("Forbidden");
}

export type Orientation = "portrait" | "landscape";

export type ComicPage = {
  id: string;
  comic_id: string;
  page_index: number;
  image_path: string | null;
  image_path_landscape: string | null;
  width: number | null;
  height: number | null;
};

async function urlFor(path: string | null) {
  if (!path) return "";
  if (/^https?:\/\//.test(path)) return path;
  const { r2PublicUrl } = await import("./r2.server");
  if (path.startsWith("comic-pages/")) return r2PublicUrl(path);
  // legacy fallback (pre-migration)
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin.storage.from("comic-pages").createSignedUrl(path, 60 * 60);
  return data?.signedUrl ?? "";
}


// ---------- Admin: list pages ----------
export const listComicPages = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { comicId: string }) => input)
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin
      .from("comic_pages")
      .select("id,comic_id,page_index,image_path,image_path_landscape,width,height")
      .eq("comic_id", data.comicId)
      .order("page_index", { ascending: true });
    if (error) throw error;
    const pages = (rows ?? []) as ComicPage[];
    const signed = await Promise.all(
      pages.map(async (p) => ({
        ...p,
        urlPortrait: await urlFor(p.image_path),
        urlLandscape: await urlFor(p.image_path_landscape),
      })),
    );
    return { pages: signed };

  });

// ---------- Admin: upload one page (portrait or landscape) ----------
// If pageId is provided, update that row's slot for the given orientation.
// Otherwise create a new page row appended at the end holding that orientation.
export const uploadComicPage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: {
    comicId: string;
    filename: string;
    contentType: string;
    base64: string;
    orientation?: Orientation; // defaults to "portrait" for backward compat
    pageId?: string | null;
    width?: number;
    height?: number;
  }) => input)
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { r2Put } = await import("./r2.server");
    const orientation: Orientation = data.orientation ?? "portrait";
    const buffer = Buffer.from(data.base64, "base64");
    const safe = data.filename.replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = `comic-pages/${data.comicId}/${orientation}/${Date.now()}-${safe}`;
    await r2Put(path, buffer, data.contentType || "image/jpeg");

    const col = orientation === "portrait" ? "image_path" : "image_path_landscape";
    const otherCol = orientation === "portrait" ? "image_path_landscape" : "image_path";

    if (data.pageId) {
      const { error } = await supabaseAdmin
        .from("comic_pages")
        .update({ [col]: path } as any)
        .eq("id", data.pageId);
      if (error) throw error;
      return { id: data.pageId, path };
    }

    // Bulk-upload path: try to fill an existing row whose current-orientation
    // slot is empty (the sibling orientation was uploaded first). We pick the
    // lowest page_index so bulk uploads pair up in row order.
    const { data: emptyRow } = await supabaseAdmin
      .from("comic_pages")
      .select("id")
      .eq("comic_id", data.comicId)
      .is(col, null)
      .not(otherCol, "is", null)
      .order("page_index", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (emptyRow?.id) {
      const { error } = await supabaseAdmin
        .from("comic_pages")
        .update({ [col]: path } as any)
        .eq("id", emptyRow.id);
      if (error) throw error;
      return { id: emptyRow.id, path };
    }

    // Otherwise append a new row at the end.
    const { data: maxRow } = await supabaseAdmin
      .from("comic_pages")
      .select("page_index")
      .eq("comic_id", data.comicId)
      .order("page_index", { ascending: false })
      .limit(1)
      .maybeSingle();
    const nextIdx = (maxRow?.page_index ?? -1) + 1;

    const insertRow: any = {
      comic_id: data.comicId,
      page_index: nextIdx,
      width: data.width ?? null,
      height: data.height ?? null,
    };
    insertRow[col] = path;

    const { data: row, error: insErr } = await supabaseAdmin
      .from("comic_pages")
      .insert(insertRow)
      .select("id")
      .single();
    if (insErr) throw insErr;
    return { id: row.id, path };
  });


// ---------- Admin: reorder ----------
export const reorderComicPages = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { comicId: string; orderedIds: string[] }) => input)
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const ids = data.orderedIds;
    for (let i = 0; i < ids.length; i++) {
      await supabaseAdmin
        .from("comic_pages")
        .update({ page_index: -(i + 1) - 1000 })
        .eq("id", ids[i])
        .eq("comic_id", data.comicId);
    }
    for (let i = 0; i < ids.length; i++) {
      await supabaseAdmin
        .from("comic_pages")
        .update({ page_index: i })
        .eq("id", ids[i])
        .eq("comic_id", data.comicId);
    }
    return { ok: true };
  });

// ---------- Admin: delete page (entire row, both orientations) ----------
export const deleteComicPage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { pageId: string }) => input)
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // const { r2Delete } = await import("./r2.server");
    const { data: row } = await supabaseAdmin
      .from("comic_pages")
      .select("image_path,image_path_landscape")
      .eq("id", data.pageId)
      .maybeSingle();
    if (!row) return { ok: true };
    // const toRemove = [row.image_path, row.image_path_landscape].filter(Boolean) as string[];
    // await Promise.all(toRemove.map((k) => r2Delete(k).catch(() => null)));
    await supabaseAdmin.from("comic_pages").delete().eq("id", data.pageId);
    return { ok: true };
  });

// ---------- Admin: delete a single orientation from a page ----------
export const deleteComicPageOrientation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { pageId: string; orientation: Orientation }) => input)
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { r2Delete } = await import("./r2.server");
    const col = data.orientation === "portrait" ? "image_path" : "image_path_landscape";
    const { data: row } = await supabaseAdmin
      .from("comic_pages")
      .select(`id,${col}`)
      .eq("id", data.pageId)
      .maybeSingle();
    if (!row) return { ok: true };
    const path = (row as any)[col] as string | null;
    if (path) await r2Delete(path).catch(() => null);
    await supabaseAdmin.from("comic_pages").update({ [col]: null } as any).eq("id", data.pageId);
    return { ok: true };
  });

// ---------- Admin: build PDF from pages (per orientation) ----------
export const generateComicPdf = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { comicId: string; orientation?: Orientation }) => input)
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { r2Put, r2Get, r2PublicUrl } = await import("./r2.server");
    const { PDFDocument } = await import("pdf-lib");
    const orientation: Orientation = data.orientation ?? "portrait";
    const col = orientation === "portrait" ? "image_path" : "image_path_landscape";

    const { data: pages, error } = await supabaseAdmin
      .from("comic_pages")
      .select(`${col},page_index`)
      .eq("comic_id", data.comicId)
      .order("page_index", { ascending: true });
    if (error) throw error;
    const filtered = (pages ?? []).filter((p: any) => p[col]) as any[];
    if (filtered.length === 0) throw new Error(`No ${orientation} pages to convert.`);

    async function loadBytes(path: string): Promise<Uint8Array> {
      if (path.startsWith("comic-pages/")) {
        const res = await r2Get(path);
        return new Uint8Array(await res.arrayBuffer());
      }
      // legacy fallback
      const { data: file, error: dErr } = await supabaseAdmin.storage
        .from("comic-pages")
        .download(path);
      if (dErr || !file) throw dErr ?? new Error("Could not load page");
      return new Uint8Array(await file.arrayBuffer());
    }

    const pdf = await PDFDocument.create();
    for (const p of filtered) {
      const path = p[col] as string;
      const bytes = await loadBytes(path);
      const isPng = path.toLowerCase().endsWith(".png");
      const img = isPng
        ? await pdf.embedPng(bytes)
        : await pdf.embedJpg(bytes).catch(async () => pdf.embedPng(bytes));
      const page = pdf.addPage([img.width, img.height]);
      page.drawImage(img, { x: 0, y: 0, width: img.width, height: img.height });
    }
    const pdfBytes = await pdf.save();
    const pdfPath = `comic-pdfs/${data.comicId}/${orientation}-${Date.now()}.pdf`;
    await r2Put(pdfPath, pdfBytes, "application/pdf");

    const patch: any = orientation === "portrait"
      ? { pdf_path: pdfPath, page_count: filtered.length }
      : { pdf_path_landscape: pdfPath };
    await supabaseAdmin.from("comics").update(patch).eq("id", data.comicId);

    return { ok: true, pdfPath, pageCount: filtered.length, orientation, url: r2PublicUrl(pdfPath) };
  });
