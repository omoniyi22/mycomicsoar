import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Loader2, Trash2, Upload, FileText, Smartphone, Monitor, X, CheckSquare } from "lucide-react";
import {
  listComicPages,
  uploadComicPage,
  reorderComicPages,
  deleteComicPage,
  deleteComicPageOrientation,
  generateComicPdf,
  type Orientation,
} from "@/lib/pages.functions";
import { fileToBase64 } from "@/lib/file-utils";

type PageRow = {
  id: string;
  page_index: number;
  image_path: string | null;
  image_path_landscape: string | null;
  urlPortrait: string;
  urlLandscape: string;
};

export function ComicPageManager({ comicId }: { comicId: string }) {
  const listFn = useServerFn(listComicPages);
  const uploadFn = useServerFn(uploadComicPage);
  const reorderFn = useServerFn(reorderComicPages);
  const deleteFn = useServerFn(deleteComicPage);
  const deleteOrientationFn = useServerFn(deleteComicPageOrientation);
  const buildPdfFn = useServerFn(generateComicPdf);

  const [pages, setPages] = useState<PageRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [uploadCount, setUploadCount] = useState<{ done: number; total: number; orientation: Orientation } | null>(null);
  const [pdfBusy, setPdfBusy] = useState<Orientation | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  // Selection state: map pageId -> { portrait: bool, landscape: bool }
  const [selected, setSelected] = useState<Record<string, { portrait: boolean; landscape: boolean }>>({});
  const [deleteSelectedBusy, setDeleteSelectedBusy] = useState(false);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  async function refresh() {
    const { pages } = await listFn({ data: { comicId } });
    setPages(pages as PageRow[]);
    // Reset selections when pages reload
    setSelected({});
  }

  useEffect(() => {
    refresh().catch((e) => setErr(e instanceof Error ? e.message : "Failed"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [comicId]);

  // Toggle selection for a specific orientation on a page
  function toggleSelection(pageId: string, orientation: Orientation) {
    setSelected((prev) => {
      const current = prev[pageId] || { portrait: false, landscape: false };
      return {
        ...prev,
        [pageId]: {
          ...current,
          [orientation]: !current[orientation],
        },
      };
    });
  }

  // Delete all selected orientations
  async function deleteSelected() {
    // Collect all selected items
    const items: { pageId: string; orientation: Orientation }[] = [];
    for (const [pageId, sel] of Object.entries(selected)) {
      if (sel.portrait) items.push({ pageId, orientation: "portrait" });
      if (sel.landscape) items.push({ pageId, orientation: "landscape" });
    }
    if (items.length === 0) {
      setErr("No orientations selected to delete.");
      return;
    }
    if (!confirm(`Delete ${items.length} selected orientation(s)?`)) return;

    setDeleteSelectedBusy(true);
    setErr(null);
    setMsg(null);

    try {
      // Delete sequentially
      for (const item of items) {
        await deleteOrientationFn({ data: { pageId: item.pageId, orientation: item.orientation } });
        console.log("successful")
      }
      await refresh();
      setMsg(`Deleted ${items.length} orientation(s).`);
      setSelected({});
    } catch (er) {
      console.log("error")
      setErr(er instanceof Error ? er.message : "Bulk delete failed");
    } finally {
      setDeleteSelectedBusy(false);
    }
  }

  // Bulk upload — appends new pages for the chosen orientation.
  async function handleBulkFiles(files: File[], orientation: Orientation) {
    if (files.length === 0) return;
    setErr(null);
    setMsg(null);
    setUploadCount({ done: 0, total: files.length, orientation });
    try {
      for (let i = 0; i < files.length; i++) {
        const f = files[i];
        const base64 = await fileToBase64(f);
        await uploadFn({
          data: {
            comicId,
            filename: f.name,
            contentType: f.type || "image/jpeg",
            base64,
            orientation,
          },
        });
        setUploadCount({ done: i + 1, total: files.length, orientation });
      }
      await refresh();
      setMsg(`Uploaded ${files.length} ${orientation} image${files.length > 1 ? "s" : ""}.`);
    } catch (er) {
      setErr(er instanceof Error ? er.message : "Upload failed");
    } finally {
      setUploadCount(null);
    }
  }

  // Upload a single orientation slot into an existing page row.
  async function uploadToSlot(pageId: string, file: File, orientation: Orientation) {
    setErr(null);
    setMsg(null);
    setBusy(true);
    try {
      const base64 = await fileToBase64(file);
      await uploadFn({
        data: {
          comicId,
          pageId,
          filename: file.name,
          contentType: file.type || "image/jpeg",
          base64,
          orientation,
        },
      });
      await refresh();
    } catch (er) {
      setErr(er instanceof Error ? er.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  async function clearSlot(pageId: string, orientation: Orientation) {
    if (!confirm(`Remove the ${orientation} image from this page?`)) return;
    setBusy(true);
    try {
      await deleteOrientationFn({ data: { pageId, orientation } });
      await refresh();
    } catch (er) {
      setErr(er instanceof Error ? er.message : "Remove failed");
    } finally {
      setBusy(false);
    }
  }

  async function onDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIdx = pages.findIndex((p) => p.id === active.id);
    const newIdx = pages.findIndex((p) => p.id === over.id);
    const next = arrayMove(pages, oldIdx, newIdx).map((p, i) => ({ ...p, page_index: i }));
    setPages(next);
    setBusy(true);
    try {
      await reorderFn({ data: { comicId, orderedIds: next.map((p) => p.id) } });
    } catch (er) {
      setErr(er instanceof Error ? er.message : "Reorder failed");
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    if (!confirm("Remove this page (both orientations)?")) return;
    setBusy(true);
    try {
      console.log("successful")
      await deleteFn({ data: { pageId: id } });
      const remaining = pages.filter((p) => p.id !== id);
      await reorderFn({ data: { comicId, orderedIds: remaining.map((p) => p.id) } });
      await refresh();
      console.log("successful")
    } catch (er) {
      setErr(er instanceof Error ? er.message : "Delete failed");
      console.log("error")
    } finally {
      setBusy(false);
    }
  }

  async function buildPdf(orientation: Orientation) {
    setErr(null);
    setMsg(null);
    setPdfBusy(orientation);
    try {
      const res = await buildPdfFn({ data: { comicId, orientation } });
      setMsg(`${orientation === "portrait" ? "Mobile portrait" : "Desktop landscape"} PDF generated · ${res.pageCount} pages.`);
    } catch (er) {
      setErr(er instanceof Error ? er.message : "PDF generation failed");
    } finally {
      setPdfBusy(null);
    }
  }

  const portraitCount = pages.filter((p) => p.image_path).length;
  const landscapeCount = pages.filter((p) => p.image_path_landscape).length;
  const selectedCount = Object.values(selected).reduce(
    (acc, sel) => acc + (sel.portrait ? 1 : 0) + (sel.landscape ? 1 : 0),
    0
  );

  return (
    <section className="mt-6 rounded-lg border border-border bg-card p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-display text-xl text-foreground">Pages</h2>
          <p className="text-xs text-muted-foreground">
            Each page holds two images — a <span className="text-white/80">portrait (mobile)</span> and a{" "}
            <span className="text-white/80">landscape (desktop)</span>. The reader picks the right one automatically.
          </p>
          <p className="text-[11px] text-muted-foreground mt-1">
            <Smartphone className="inline h-3 w-3" /> {portraitCount} portrait ·{" "}
            <Monitor className="inline h-3 w-3" /> {landscapeCount} landscape · {pages.length} page rows
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <BulkUploadButton
            label="Add mobile pages"
            icon={<Smartphone className="h-4 w-4" />}
            uploading={uploadCount?.orientation === "portrait" ? uploadCount : null}
            onFiles={(files) => handleBulkFiles(files, "portrait")}
            disabled={!!uploadCount}
          />
          <BulkUploadButton
            label="Add desktop pages"
            icon={<Monitor className="h-4 w-4" />}
            uploading={uploadCount?.orientation === "landscape" ? uploadCount : null}
            onFiles={(files) => handleBulkFiles(files, "landscape")}
            disabled={!!uploadCount}
          />
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          onClick={() => buildPdf("portrait")}
          disabled={pdfBusy !== null || portraitCount === 0}
          className="inline-flex items-center gap-2 rounded-md border border-gold/40 px-3 py-1.5 text-xs font-semibold text-gold hover:bg-gold/10 disabled:opacity-50"
        >
          {pdfBusy === "portrait" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileText className="h-3.5 w-3.5" />}
          Build mobile PDF
        </button>
        <button
          onClick={() => buildPdf("landscape")}
          disabled={pdfBusy !== null || landscapeCount === 0}
          className="inline-flex items-center gap-2 rounded-md border border-gold/40 px-3 py-1.5 text-xs font-semibold text-gold hover:bg-gold/10 disabled:opacity-50"
        >
          {pdfBusy === "landscape" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileText className="h-3.5 w-3.5" />}
          Build desktop PDF
        </button>
        <div className="flex-1" />
        {selectedCount > 0 && (
          <button
            onClick={deleteSelected}
            disabled={deleteSelectedBusy}
            className="inline-flex items-center gap-2 rounded-md bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-60"
          >
            {deleteSelectedBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
            Delete selected ({selectedCount})
          </button>
        )}
      </div>

      {msg && <p className="mt-3 text-sm text-gold">{msg}</p>}
      {err && <p className="mt-3 text-sm text-red-400">{err}</p>}

      {pages.length === 0 ? (
        <p className="mt-6 text-sm text-muted-foreground text-center py-8 border border-dashed border-border rounded-md">
          No pages yet. Add mobile or desktop images above — they'll be paired by row order.
        </p>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={pages.map((p) => p.id)} strategy={rectSortingStrategy}>
            <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {pages.map((p, i) => (
                <SortablePage
                  key={p.id}
                  page={p}
                  index={i}
                  onRemoveRow={() => remove(p.id)}
                  onUpload={(file, orientation) => uploadToSlot(p.id, file, orientation)}
                  onClearSlot={(orientation) => clearSlot(p.id, orientation)}
                  selected={selected[p.id] || { portrait: false, landscape: false }}
                  onToggleSelection={(orientation) => toggleSelection(p.id, orientation)}
                  disabled={busy || deleteSelectedBusy}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}
    </section>
  );
}

function BulkUploadButton({
  label,
  icon,
  onFiles,
  uploading,
  disabled,
}: {
  label: string;
  icon: React.ReactNode;
  onFiles: (files: File[]) => void;
  uploading: { done: number; total: number } | null;
  disabled?: boolean;
}) {
  return (
    <label
      className={`inline-flex items-center gap-2 rounded-md bg-gold px-4 py-2 text-sm font-semibold text-primary-foreground ${
        disabled ? "opacity-60 cursor-not-allowed" : "cursor-pointer"
      }`}
    >
      {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : icon}
      {uploading ? `Uploading ${uploading.done}/${uploading.total}` : label}
      <input
        type="file"
        accept="image/*"
        multiple
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          onFiles(files);
          e.target.value = "";
        }}
        disabled={disabled}
        className="hidden"
      />
    </label>
  );
}

function SortablePage({
  page,
  index,
  onRemoveRow,
  onUpload,
  onClearSlot,
  selected,
  onToggleSelection,
  disabled,
}: {
  page: PageRow;
  index: number;
  onRemoveRow: () => void;
  onUpload: (file: File, orientation: Orientation) => void;
  onClearSlot: (orientation: Orientation) => void;
  selected: { portrait: boolean; landscape: boolean };
  onToggleSelection: (orientation: Orientation) => void;
  disabled: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: page.id,
  });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };
  return (
    <div
      ref={setNodeRef}
      style={style}
      className="rounded-lg border border-border bg-background/40 p-3"
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <button
            {...attributes}
            {...listeners}
            disabled={disabled}
            className="rounded bg-black/40 p-1 text-white/70 hover:text-white cursor-grab active:cursor-grabbing"
            aria-label="Drag to reorder"
          >
            <GripVertical className="h-3.5 w-3.5" />
          </button>
          <span className="text-xs font-semibold text-foreground">Page {index + 1}</span>
        </div>
        <button
          onClick={onRemoveRow}
          disabled={disabled}
          className="text-red-400/80 hover:text-red-400"
          aria-label="Remove page"
          title="Remove entire page"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <SlotCell
          label="Mobile (portrait)"
          icon={<Smartphone className="h-3 w-3" />}
          url={page.urlPortrait}
          aspect="aspect-[2/3]"
          onFile={(f) => onUpload(f, "portrait")}
          onClear={() => onClearSlot("portrait")}
          filled={!!page.image_path}
          disabled={disabled}
          selected={selected.portrait}
          onToggleSelection={() => onToggleSelection("portrait")}
        />
        <SlotCell
          label="Desktop (landscape)"
          icon={<Monitor className="h-3 w-3" />}
          url={page.urlLandscape}
          aspect="aspect-[16/10]"
          onFile={(f) => onUpload(f, "landscape")}
          onClear={() => onClearSlot("landscape")}
          filled={!!page.image_path_landscape}
          disabled={disabled}
          selected={selected.landscape}
          onToggleSelection={() => onToggleSelection("landscape")}
        />
      </div>
    </div>
  );
}

function SlotCell({
  label,
  icon,
  url,
  aspect,
  filled,
  onFile,
  onClear,
  disabled,
  selected,
  onToggleSelection,
}: {
  label: string;
  icon: React.ReactNode;
  url: string;
  aspect: string;
  filled: boolean;
  onFile: (file: File) => void;
  onClear: () => void;
  disabled: boolean;
  selected: boolean;
  onToggleSelection: () => void;
}) {
  return (
    <div className="group relative">
      <div className="relative">
        <label
          className={`block relative w-full ${aspect} rounded-md overflow-hidden border ${
            filled ? "border-border" : "border-dashed border-white/15"
          } bg-black/30 ${disabled ? "cursor-not-allowed" : "cursor-pointer hover:border-gold/40"}`}
        >
          {url ? (
            <img src={url} alt={label} className="h-full w-full object-cover" />
          ) : (
            <div className="h-full w-full grid place-items-center text-[10px] text-white/40 gap-1">
              <Upload className="h-4 w-4" />
              <span>{label}</span>
            </div>
          )}
          <input
            type="file"
            accept="image/*"
            className="hidden"
            disabled={disabled}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onFile(f);
              e.target.value = "";
            }}
          />
        </label>
        <div className="absolute top-1 left-1 flex items-center gap-1 rounded bg-black/70 px-1.5 py-0.5 text-[9px] text-white">
          {icon}
          <span>{label.split(" ")[0]}</span>
        </div>
        {filled && (
          <button
            onClick={onClear}
            disabled={disabled}
            className="absolute top-1 right-1 rounded bg-red-500/80 p-1 text-white opacity-0 group-hover:opacity-100 transition"
            aria-label={`Remove ${label}`}
          >
            <X className="h-3 w-3" />
          </button>
        )}
      </div>
      {/* Checkbox for bulk selection */}
      <label className="mt-1 flex items-center justify-center gap-1 text-[10px] text-muted-foreground cursor-pointer hover:text-white">
        <input
          type="checkbox"
          checked={selected}
          onChange={onToggleSelection}
          disabled={disabled || !filled}
          className="h-3 w-3 rounded border-border"
        />
        Select
      </label>
    </div>
  );
}