import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getReaderUrl } from "@/lib/reader.functions";
import {
  listSoundtracks,
  uploadUserSoundtrack,
  deleteUserSoundtrack,
} from "@/lib/soundtracks.functions";
import { fileToBase64 } from "@/lib/file-utils";
import {
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Download,
  Loader2,
  Maximize,
  Minimize,
  Music,
  Pause,
  Play,
  SettingsIcon,
  SkipForward,
  Trash2,
  Upload,
  Volume2,
  VolumeX,
  X,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  PanelLeftClose,
  PanelLeftOpen,
  Smartphone,
  Monitor,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/reader/$slug")({
  head: () => ({ meta: [{ title: "Reader — Comicsoar" }] }),
  component: ReaderPage,
});

type Transition = "slide" | "flip" | "jitter" | "light" | "shake";
type TapMode = "anywhere" | "halves";
type Track = {
  id: string;
  title: string;
  artist: string | null;
  url: string;
  source: "library" | "personal";
};

const TRANSITIONS: { id: Transition; label: string; hint: string }[] = [
  { id: "slide", label: "Slide", hint: "Swipe across" },
  { id: "flip", label: "Page flip", hint: "3D turn" },
  { id: "jitter", label: "Jitter", hint: "Quick twitch" },
  { id: "light", label: "Light", hint: "Flash burst" },
  { id: "shake", label: "Shake", hint: "Camera shake" },
];

function loadPref<T extends string>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  return ((window.localStorage.getItem(key) as T) || fallback) as T;
}

// ─── Helper: open in new tab + download ──────────────────────────────
async function downloadAndOpen(url: string, filename: string) {
  try {
    // 1. Open the PDF in a new tab (for viewing)
    window.open(url, '_blank');

    // 2. Also trigger a download via fetch + blob (for saving)
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = objectUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(objectUrl);
  } catch (err) {
    console.error('Download error:', err);
    // If fetch fails, fallback to just opening the URL (user can save manually)
    window.open(url, '_blank');
  }
}

function ReaderPage() {
  const { slug } = Route.useParams();
  const navigate = useNavigate();
  const fetcher = useServerFn(getReaderUrl);
  const listTracksFn = useServerFn(listSoundtracks);
  const uploadTrackFn = useServerFn(uploadUserSoundtrack);
  const deleteTrackFn = useServerFn(deleteUserSoundtrack);

  const [state, setState] = useState<
    | { kind: "loading" }
    | { kind: "error"; msg: string }
    | {
      kind: "ready";
      title: string;
      pages: { index: number; urlPortrait: string; urlLandscape: string }[];
      pdfUrlPortrait: string | null;
      pdfUrlLandscape: string | null;
    }
  >({ kind: "loading" });
  const [showDownload, setShowDownload] = useState(false);
  const [isPortrait, setIsPortrait] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    return window.matchMedia("(max-width: 767px), (orientation: portrait)").matches;
  });

  const [index, setIndex] = useState(0);
  const [direction, setDirection] = useState<1 | -1>(1);
  const [transition, setTransition] = useState<Transition>(() => loadPref("cs.reader.tx", "slide"));
  const [tapMode, setTapMode] = useState<TapMode>(() => loadPref("cs.reader.tap", "halves"));
  const [showSettings, setShowSettings] = useState(false);
  const [showThumbs, setShowThumbs] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [chromeVisible, setChromeVisible] = useState(true);

  // Music
  const [tracks, setTracks] = useState<{ library: Track[]; personal: Track[] }>({
    library: [],
    personal: [],
  });
  const [activeTrack, setActiveTrack] = useState<Track | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(0.6);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Helper to reveal chrome and auto‑hide after 2.2s
  const revealChrome = useRef(() => {
    if (!isFullscreen) return; // only auto‑hide in fullscreen
    setChromeVisible(true);
    clearTimeout(window.__chromeTimer);
    window.__chromeTimer = setTimeout(() => setChromeVisible(false), 2200);
  });

  useEffect(() => {
    window.localStorage.setItem("cs.reader.tx", transition);
  }, [transition]);
  useEffect(() => {
    window.localStorage.setItem("cs.reader.tap", tapMode);
  }, [tapMode]);

  useEffect(() => {
    fetcher({ data: { slug } })
      .then((d) =>
        setState({
          kind: "ready",
          title: d.title,
          pages: d.pages,
          pdfUrlPortrait: d.pdfUrlPortrait,
          pdfUrlLandscape: d.pdfUrlLandscape,
        }),
      )
      .catch((e) => setState({ kind: "error", msg: e instanceof Error ? e.message : "Failed" }));
  }, [fetcher, slug]);

  // Track viewport orientation to pick the right image variant.
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px), (orientation: portrait)");
    const onChange = () => setIsPortrait(mq.matches);
    onChange();
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    listTracksFn()
      .then((r) => setTracks({ library: r.library as Track[], personal: r.personal as Track[] }))
      .catch(() => { });
  }, [listTracksFn]);

  const pages = state.kind === "ready" ? state.pages : [];
  const total = pages.length;

  // Pick the URL for the currently active orientation, falling back to the other variant when one hasn't been uploaded.
  const pickUrl = (p: { urlPortrait: string; urlLandscape: string }) => {
    const primary = isPortrait ? p.urlPortrait : p.urlLandscape;
    const fallback = isPortrait ? p.urlLandscape : p.urlPortrait;
    return primary || fallback;
  };

  useEffect(() => {
    if (total === 0) return;
    const window_ = [-2, -1, 1, 2, 3];
    window_.forEach((d) => {
      const i = index + d;
      if (i >= 0 && i < total) {
        const img = new Image();
        img.src = pickUrl(pages[i]);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, total, pages, isPortrait]);

  const go = (delta: number) => {
    setDirection(delta > 0 ? 1 : -1);
    setIndex((i) => Math.max(0, Math.min(total - 1, i + delta)));
  };

  // Keyboard
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Reveal chrome on any key press (to satisfy request #5)
      if (isFullscreen) revealChrome.current?.();

      if (e.key === "ArrowRight" || e.key === " ") go(1);
      else if (e.key === "ArrowLeft") go(-1);
      else if (e.key === "Escape") {
        if (document.fullscreenElement) document.exitFullscreen();
        else navigate({ to: "/account" });
      } else if (e.key === "+" || e.key === "=") setZoom((z) => Math.min(3, z + 0.25));
      else if (e.key === "-") setZoom((z) => Math.max(0.5, z - 0.25));
      else if (e.key === "0") setZoom(1);
      else if (e.key.toLowerCase() === "f") toggleFullscreen();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [total, isFullscreen]);

  // Fullscreen state sync
  useEffect(() => {
    const onChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  // Auto-hide chrome in fullscreen; always visible otherwise
  useEffect(() => {
    if (!isFullscreen) {
      setChromeVisible(true);
      clearTimeout(window.__chromeTimer);
      return;
    }
    const reveal = () => {
      setChromeVisible(true);
      clearTimeout(window.__chromeTimer);
      window.__chromeTimer = setTimeout(() => setChromeVisible(false), 2200);
    };
    reveal();
    window.addEventListener("mousemove", reveal);
    window.addEventListener("touchstart", reveal, { passive: true });
    window.addEventListener("keydown", reveal);
    return () => {
      clearTimeout(window.__chromeTimer);
      window.removeEventListener("mousemove", reveal);
      window.removeEventListener("touchstart", reveal);
      window.removeEventListener("keydown", reveal);
    };
  }, [isFullscreen]);

  // Audio volume/mute sync
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
      audioRef.current.muted = muted;
    }
  }, [volume, muted]);

  // Swipe
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const onTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0];
    touchStart.current = { x: t.clientX, y: t.clientY };
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    const s = touchStart.current;
    if (!s) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - s.x;
    if (Math.abs(dx) > 50) go(dx < 0 ? 1 : -1);
    touchStart.current = null;
  };

  const onTap = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest("[data-no-tap]")) return;
    if (zoom !== 1) return; // don't paginate while zoomed
    if (tapMode === "anywhere") {
      go(1);
    } else {
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      const x = e.clientX - rect.left;
      go(x < rect.width / 2 ? -1 : 1);
    }
  };

  // Click outside to close settings (request #1)
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (!showSettings) return;
      const target = e.target as HTMLElement;
      const settingsPanel = document.getElementById("settings-panel");
      const settingsButton = document.getElementById("settings-button");
      if (settingsPanel && !settingsPanel.contains(target) && settingsButton && !settingsButton.contains(target)) {
        setShowSettings(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showSettings]);

  const toggleFullscreen = async () => {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await document.documentElement.requestFullscreen().catch(() => { });
  };

  const playTrack = async (t: Track) => {
    setActiveTrack(t);
    setTimeout(async () => {
      if (audioRef.current) {
        try {
          await audioRef.current.play();
          setIsPlaying(true);
        } catch { }
      }
    }, 50);
  };

  const togglePlay = async () => {
    if (!audioRef.current || !activeTrack) return;
    if (audioRef.current.paused) {
      await audioRef.current.play();
      setIsPlaying(true);
    } else {
      audioRef.current.pause();
      setIsPlaying(false);
    }
  };

  const nextTrack = () => {
    const all = [...tracks.library, ...tracks.personal];
    if (all.length === 0 || !activeTrack) return;
    const i = all.findIndex((x) => x.id === activeTrack.id);
    const next = all[(i + 1) % all.length];
    playTrack(next);
  };

  async function handleUploadTrack(file: File) {
    const title = file.name.replace(/\.[^.]+$/, "");
    const base64 = await fileToBase64(file);
    await uploadTrackFn({
      data: {
        title,
        filename: file.name,
        contentType: file.type || "audio/mpeg",
        base64,
      },
    });
    const r = await listTracksFn();
    setTracks({ library: r.library as Track[], personal: r.personal as Track[] });
  }

  async function removePersonal(id: string) {
    await deleteTrackFn({ data: { id } });
    if (activeTrack?.id === id) {
      audioRef.current?.pause();
      setActiveTrack(null);
      setIsPlaying(false);
    }
    const r = await listTracksFn();
    setTracks({ library: r.library as Track[], personal: r.personal as Track[] });
  }

  if (state.kind === "loading") {
    return (
      <main className="min-h-screen grid place-items-center bg-background text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin text-gold" />
      </main>
    );
  }
  if (state.kind === "error") {
    return (
      <main className="min-h-screen grid place-items-center bg-background text-center px-6">
        <div>
          <p className="text-red-400 mb-4">{state.msg}</p>
          <Link to="/account" className="text-gold underline">Back to library</Link>
        </div>
      </main>
    );
  }

  const anyPdfUrl = state.pdfUrlPortrait ?? state.pdfUrlLandscape;

  if (total === 0) {
    return (
      <main className="min-h-screen grid place-items-center bg-background text-center px-6">
        <div>
          <p className="text-muted-foreground mb-4">No pages uploaded yet for this issue.</p>
          {anyPdfUrl && (
            <button
              onClick={() => downloadAndOpen(anyPdfUrl, `${state.title}.pdf`)}
              className="text-gold underline"
            >
              Download PDF instead
            </button>
          )}
        </div>
      </main>
    );
  }

  const current = pages[index];
  const currentUrl = pickUrl(current);

  return (
    <main className="min-h-screen bg-black text-foreground select-none overflow-hidden">
      {/* Hidden audio element */}
      {activeTrack && (
        <audio
          ref={audioRef}
          src={activeTrack.url}
          onEnded={nextTrack}
          onPause={() => setIsPlaying(false)}
          onPlay={() => setIsPlaying(true)}
          loop={false}
        />
      )}

      {/* Layout: desktop thumbs (collapsible left strip) + stage */}
      <div className="flex h-screen">
        {/* Desktop thumbs */}
        <aside
          data-no-tap
          className={`hidden md:flex flex-col bg-zinc-950/80 border-r border-white/5 transition-all duration-300 ${showThumbs ? "w-32" : "w-14"
            } ${isFullscreen && !chromeVisible ? "-translate-x-full w-0 border-0" : "translate-x-0"}`}
        >
          <div className="flex items-center justify-between gap-1 px-2 py-2 border-b border-white/5">
            <Link
              to="/library"
              className="inline-flex h-8 w-8 items-center justify-center rounded-md text-white/70 hover:text-gold"
              aria-label="Back to library"
              title="Library"
            >
              <BookOpen className="h-4 w-4" />
            </Link>
            <button
              onClick={() => setShowThumbs((v) => !v)}
              className="inline-flex h-8 w-8 items-center justify-center rounded-md text-white/60 hover:text-gold"
              aria-label="Toggle thumbnails"
              title="Pages"
            >
              {showThumbs ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeftOpen className="h-4 w-4" />}
            </button>
          </div>
          <div className={`flex-1 overflow-y-auto ${showThumbs ? "px-2 py-2 space-y-2" : "px-1.5 py-2 space-y-1.5"}`}>
            {pages.map((p, i) => (
              <button
                key={p.index}
                onClick={() => {
                  setDirection(i > index ? 1 : -1);
                  setIndex(i);
                }}
                className={`relative w-full overflow-hidden rounded border ${i === index ? "border-gold ring-1 ring-gold" : "border-white/10 hover:border-white/30"
                  }`}
                title={`Page ${i + 1}`}
              >
                <img src={pickUrl(p)} alt="" className="w-full aspect-[2/3] object-cover" loading="lazy" />
                <span className={`absolute bottom-0.5 right-0.5 rounded bg-black/70 px-1 text-white ${showThumbs ? "text-[9px]" : "text-[8px]"}`}>
                  {i + 1}
                </span>
              </button>
            ))}
          </div>
        </aside>

        {/* Stage */}
        <div
          className="relative flex-1 grid place-items-center overflow-hidden cursor-pointer"
          onClick={onTap}
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
        >
          {/* Top bar — scoped to stage width */}
          <div
            data-no-tap
            className={`absolute top-0 inset-x-0 z-30 flex items-center justify-between gap-2 px-4 py-3 transition-opacity duration-300 ${isFullscreen ? "bg-transparent" : "bg-gradient-to-b from-black/70 to-transparent"
              } ${chromeVisible ? "opacity-100" : "opacity-0 pointer-events-none"}`}
          >
            <div className="text-xs uppercase tracking-[0.25em] text-white/60 truncate">
              <div className="hidden sm:block">
                {state.title}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button onClick={(e) => { e.stopPropagation(); setZoom((z) => Math.max(0.5, z - 0.25)); }} className="text-white/80 hover:text-gold" aria-label="Zoom out"><ZoomOut className="h-4 w-4" /></button>
              <span className="text-[10px] tabular-nums text-white/60 w-8 text-center">{Math.round(zoom * 100)}%</span>
              <button onClick={(e) => { e.stopPropagation(); setZoom((z) => Math.min(3, z + 0.25)); }} className="text-white/80 hover:text-gold" aria-label="Zoom in"><ZoomIn className="h-4 w-4" /></button>
              <button onClick={(e) => { e.stopPropagation(); setZoom(1); }} className="text-white/80 hover:text-gold" aria-label="Reset zoom"><RotateCcw className="h-4 w-4" /></button>
              <button onClick={(e) => { e.stopPropagation(); toggleFullscreen(); }} className="text-white/80 hover:text-gold" aria-label="Fullscreen">
                {isFullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
              </button>
              {(state.pdfUrlPortrait || state.pdfUrlLandscape) && (
                <div className="relative" data-no-tap>
                  <button
                    onClick={(e) => { e.stopPropagation(); setShowDownload((v) => !v); }}
                    className="inline-flex items-center gap-1.5 text-xs text-white/80 hover:text-gold"
                    aria-label="Download"
                    aria-expanded={showDownload}
                  >
                    <Download className="h-4 w-4" />
                  </button>
                  {showDownload && (
                    <div
                      className="absolute right-0 top-full mt-2 w-52 rounded-md border border-white/10 bg-zinc-900/95 backdrop-blur p-1 shadow-2xl z-50"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {state.pdfUrlPortrait && (
                        <button
                          onClick={() => {
                            setShowDownload(false);
                            downloadAndOpen(state.pdfUrlPortrait!, `${state.title}.pdf`);
                          }}
                          className="flex items-center gap-2 px-3 py-2 text-xs text-white/80 rounded hover:bg-white/5 hover:text-gold w-full text-left"
                        >
                          <Smartphone className="h-3.5 w-3.5" />
                          <span className="flex-1">Mobile (portrait)</span>
                        </button>
                      )}
                      {state.pdfUrlLandscape && (
                        <button
                          onClick={() => {
                            setShowDownload(false);
                            downloadAndOpen(state.pdfUrlLandscape!, `${state.title}.pdf`);
                          }}
                          className="flex items-center gap-2 px-3 py-2 text-xs text-white/80 rounded hover:bg-white/5 hover:text-gold w-full text-left"
                        >
                          <Monitor className="h-3.5 w-3.5" />
                          <span className="flex-1">Desktop (landscape)</span>
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}
              <button
                id="settings-button"
                onClick={(e) => { e.stopPropagation(); setShowSettings((v) => !v); }}
                className="text-white/80 hover:text-gold"
                aria-label="Settings"
              >
                <SettingsIcon className="h-4 w-4 cursor-pointer" />
              </button>
            </div>
          </div>

          <PageStage
            key={current.index} // force re‑mount on page change to reset animation
            src={currentUrl}
            transition={transition}
            direction={direction}
            zoom={zoom}
          />

          <button
            data-no-tap
            onClick={(e) => { e.stopPropagation(); go(-1); }}
            disabled={index === 0}
            className="hidden md:flex absolute left-4 top-1/2 -translate-y-1/2 h-12 w-12 rounded-full bg-white/5 hover:bg-white/10 backdrop-blur items-center justify-center text-white disabled:opacity-30"
            aria-label="Previous"
          ><ChevronLeft className="h-6 w-6" /></button>
          <button
            data-no-tap
            onClick={(e) => { e.stopPropagation(); go(1); }}
            disabled={index >= total - 1}
            className="hidden md:flex absolute right-4 top-1/2 -translate-y-1/2 h-12 w-12 rounded-full bg-white/5 hover:bg-white/10 backdrop-blur items-center justify-center text-white disabled:opacity-30"
            aria-label="Next"
          ><ChevronRight className="h-6 w-6" /></button>

          {/* Bottom progress — scoped to stage width */}
          <div
            data-no-tap
            className={`absolute bottom-0 inset-x-0 z-30 px-4 pb-4 pt-8 transition-opacity duration-300 ${isFullscreen ? "bg-transparent" : "bg-gradient-to-t from-black/70 to-transparent"
              } ${chromeVisible ? "opacity-100" : "opacity-0 pointer-events-none"}`}
          >
            <div className="flex items-center gap-3 text-xs text-white/70">
              <span className="tabular-nums">{index + 1} / {total}</span>
              <div className="flex-1 h-1 rounded bg-white/10 overflow-hidden">
                <div className="h-full bg-gold transition-all" style={{ width: `${((index + 1) / total) * 100}%` }} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile top-left controls (book + pages toggle) */}
      <div
        data-no-tap
        className={`md:hidden absolute top-3 left-3 z-40 flex items-center gap-1 rounded-md bg-black/40 backdrop-blur px-1 py-1 transition-opacity duration-300 ${chromeVisible ? "opacity-100" : "opacity-0 pointer-events-none"
          }`}
      >
        <Link to="/library" className="inline-flex h-8 w-8 items-center justify-center text-white/80 hover:text-gold" aria-label="Library">
          <BookOpen className="h-4 w-4" />
        </Link>
        <button onClick={() => setShowThumbs((v) => !v)} className="inline-flex h-8 w-8 items-center justify-center text-white/80 hover:text-gold" aria-label="Toggle pages">
          {showThumbs ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeftOpen className="h-4 w-4" />}
        </button>
      </div>

      {/* Mobile thumb drawer */}
      {showThumbs && (
        <div
          data-no-tap
          className="md:hidden fixed inset-y-0 left-0 z-40 w-40 bg-zinc-950/95 border-r border-white/10 overflow-y-auto p-2 space-y-2"
        >
          <div className="flex items-center justify-between mb-1 px-1">
            <div className="flex items-center gap-1">
              <Link to="/library" className="text-white/70 hover:text-gold" aria-label="Library"><BookOpen className="h-4 w-4" /></Link>
              <span className="text-[10px] uppercase tracking-[0.2em] text-white/50 ml-1">Pages</span>
            </div>
            <button onClick={() => setShowThumbs(false)} className="text-white/60"><X className="h-4 w-4" /></button>
          </div>
          {pages.map((p, i) => (
            <button
              key={p.index}
              onClick={() => {
                setDirection(i > index ? 1 : -1);
                setIndex(i);
                setShowThumbs(false);
              }}
              className={`relative w-full overflow-hidden rounded border ${i === index ? "border-gold ring-1 ring-gold" : "border-white/10"
                }`}
            >
              <img src={pickUrl(p)} alt="" className="w-full aspect-[2/3] object-cover" loading="lazy" />
              <span className="absolute bottom-0.5 right-0.5 rounded bg-black/70 px-1 text-[9px] text-white">{i + 1}</span>
            </button>
          ))}
        </div>
      )}

      {/* Settings panel */}
      {showSettings && (
        <div
          id="settings-panel"
          data-no-tap
          className="absolute top-14 right-4 z-40 w-80 max-h-[80vh] overflow-y-auto rounded-xl border border-white/10 bg-zinc-900/95 backdrop-blur p-4 shadow-2xl"
        >
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-white">Reader settings</h3>
            <button onClick={() => setShowSettings(false)} className="text-white/60 hover:text-white"><X className="h-4 w-4" /></button>
          </div>

          <div className="space-y-4">
            <div>
              <div className="text-[10px] uppercase tracking-[0.2em] text-white/50 mb-1.5">Transition</div>
              <div className="grid grid-cols-2 gap-1.5">
                {TRANSITIONS.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setTransition(t.id)}
                    className={`rounded-md border px-2 py-1.5 text-xs text-left ${transition === t.id ? "border-gold bg-gold/10 text-gold" : "border-white/10 text-white/80 hover:border-white/30"
                      }`}
                  >
                    <div className="font-semibold">{t.label}</div>
                    <div className="text-[10px] opacity-70">{t.hint}</div>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="text-[10px] uppercase tracking-[0.2em] text-white/50 mb-1.5">Tap behavior</div>
              <div className="grid grid-cols-2 gap-1.5">
                {(["halves", "anywhere"] as TapMode[]).map((m) => (
                  <button
                    key={m}
                    onClick={() => setTapMode(m)}
                    className={`rounded-md border px-2 py-1.5 text-xs ${tapMode === m ? "border-gold bg-gold/10 text-gold" : "border-white/10 text-white/80 hover:border-white/30"
                      }`}
                  >
                    {m === "halves" ? "Left back, Right next" : "Tap anywhere = next"}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <div className="text-[10px] uppercase tracking-[0.2em] text-white/50 flex items-center gap-1.5">
                  <Music className="h-3 w-3" /> Soundtrack
                </div>
                <label className="text-[10px] text-gold cursor-pointer hover:underline inline-flex items-center gap-1">
                  <Upload className="h-3 w-3" /> Upload
                  <input
                    type="file"
                    accept="audio/*"
                    className="hidden"
                    onChange={async (e) => {
                      const f = e.target.files?.[0];
                      if (f) await handleUploadTrack(f);
                      e.target.value = "";
                    }}
                  />
                </label>
              </div>

              {activeTrack && (
                <div className="mb-3 flex items-center gap-2 rounded-md border border-gold/30 bg-gold/5 px-2 py-1.5">
                  <button onClick={togglePlay} className="h-7 w-7 grid place-items-center rounded-full bg-gold text-primary-foreground" aria-label={isPlaying ? "Pause" : "Play"}>
                    {isPlaying ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                  </button>
                  <button onClick={nextTrack} className="text-white/70 hover:text-gold" aria-label="Next track">
                    <SkipForward className="h-4 w-4" />
                  </button>
                  <button onClick={() => setMuted((m) => !m)} className="text-white/70 hover:text-gold" aria-label="Mute">
                    {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                  </button>
                  <span className="truncate text-[11px] text-white/70 flex-1">♪ {activeTrack.title}</span>
                </div>
              )}

              <div className="flex items-center gap-2 mb-2">
                <span className="text-[10px] text-white/50 w-12">Volume</span>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={volume}
                  onChange={(e) => setVolume(Number(e.target.value))}
                  className="flex-1"
                />
              </div>

              {tracks.library.length > 0 && (
                <div className="mb-2">
                  <div className="text-[9px] uppercase text-white/40 mb-1">Comicsoar library</div>
                  <div className="space-y-1">
                    {tracks.library.map((t) => (
                      <TrackRow key={t.id} track={t} active={activeTrack?.id === t.id} onPlay={() => playTrack(t)} />
                    ))}
                  </div>
                </div>
              )}

              {tracks.personal.length > 0 && (
                <div>
                  <div className="text-[9px] uppercase text-white/40 mb-1">My tracks</div>
                  <div className="space-y-1">
                    {tracks.personal.map((t) => (
                      <TrackRow
                        key={t.id}
                        track={t}
                        active={activeTrack?.id === t.id}
                        onPlay={() => playTrack(t)}
                        onDelete={() => removePersonal(t.id)}
                      />
                    ))}
                  </div>
                </div>
              )}

              {tracks.library.length === 0 && tracks.personal.length === 0 && (
                <p className="text-[11px] text-white/40">No tracks yet. Upload one above.</p>
              )}

              {activeTrack && (
                <button
                  onClick={() => {
                    audioRef.current?.pause();
                    setActiveTrack(null);
                    setIsPlaying(false);
                  }}
                  className="mt-2 text-[10px] text-white/60 hover:text-red-400"
                >
                  Stop playback
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Global keyframe animations */}
      <style>{`
        @keyframes csJitter {
          0% { transform: translateX(0) scale(var(--zoom, 1)); opacity: 0; }
          20% { transform: translateX(-8px) scale(var(--zoom, 1)); opacity: 1; }
          40% { transform: translateX(8px) scale(var(--zoom, 1)); }
          60% { transform: translateX(-4px) scale(var(--zoom, 1)); }
          80% { transform: translateX(4px) scale(var(--zoom, 1)); }
          100% { transform: translateX(0) scale(var(--zoom, 1)); opacity: 1; }
        }
        .cs-jitter {
          animation: csJitter 0.5s ease-out forwards;
        }

        @keyframes csShake {
          0% { transform: translate(0, 0) scale(var(--zoom, 1)); opacity: 0; }
          10% { transform: translate(-10px, -6px) scale(var(--zoom, 1)); opacity: 1; }
          20% { transform: translate(10px, 6px) scale(var(--zoom, 1)); }
          30% { transform: translate(-6px, 4px) scale(var(--zoom, 1)); }
          40% { transform: translate(6px, -4px) scale(var(--zoom, 1)); }
          50% { transform: translate(-4px, 2px) scale(var(--zoom, 1)); }
          60% { transform: translate(4px, -2px) scale(var(--zoom, 1)); }
          70% { transform: translate(-2px, 1px) scale(var(--zoom, 1)); }
          80% { transform: translate(2px, -1px) scale(var(--zoom, 1)); }
          90% { transform: translate(-1px, 0) scale(var(--zoom, 1)); }
          100% { transform: translate(0, 0) scale(var(--zoom, 1)); opacity: 1; }
        }
        .cs-shake {
          animation: csShake 0.6s ease-out forwards;
        }

        @keyframes csFlash {
          0% { opacity: 0.8; }
          100% { opacity: 0; }
        }
        .cs-flash-overlay {
          animation: csFlash 0.4s ease-out forwards;
        }
      `}</style>
    </main>
  );
}

function TrackRow({
  track,
  active,
  onPlay,
  onDelete,
}: {
  track: Track;
  active: boolean;
  onPlay: () => void;
  onDelete?: () => void;
}) {
  return (
    <div className={`flex items-center gap-2 rounded border px-2 py-1.5 text-xs ${active ? "border-gold bg-gold/10" : "border-white/10"}`}>
      <button onClick={onPlay} className="text-gold" aria-label="Play">
        <Play className="h-3.5 w-3.5" />
      </button>
      <div className="flex-1 min-w-0">
        <div className="truncate text-white">{track.title}</div>
        {track.artist && <div className="truncate text-[10px] text-white/50">{track.artist}</div>}
      </div>
      {onDelete && (
        <button onClick={onDelete} className="text-white/40 hover:text-red-400" aria-label="Delete">
          <Trash2 className="h-3 w-3" />
        </button>
      )}
    </div>
  );
}

function PageStage({
  src,
  transition,
  direction,
  zoom,
}: {
  src: string;
  transition: Transition;
  direction: 1 | -1;
  zoom: number;
}) {
  const [entered, setEntered] = useState(false);
  useEffect(() => {
    setEntered(false);
    const id = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(id);
  }, [src]); // re‑trigger on src change

  // Base styles
  const baseStyle: React.CSSProperties = {
    position: "absolute",
    inset: 0,
    margin: "auto",
    maxHeight: "100%",
    maxWidth: "100%",
    objectFit: "contain",
    willChange: "transform, opacity",
  };

  // Determine if we use an animation (jitter/shake) or a CSS transition (slide/flip/light)
  const isAnimated = transition === "jitter" || transition === "shake";

  let className = "";
  let style: React.CSSProperties = { ...baseStyle };

  if (isAnimated) {
    style.transition = "none";
    const animClass = transition === "jitter" ? "cs-jitter" : "cs-shake";
    className = entered ? animClass : "";
    style.opacity = entered ? 1 : 0;
    style.transform = `scale(${zoom})`;
    style['zoom'] = String(zoom);
  } else {
    // slide, flip, light: use CSS transition with faster duration (0.3s)
    style.transition = "transform 0.32s ease-out, opacity 0.32s ease-out, filter 0.32s ease-out";
    style.transform = `scale(${zoom})`;
    style.opacity = 1;

    if (!entered) {
      switch (transition) {
        case "slide":
          style.transform = `translateX(${direction * 100}%) scale(${zoom})`;
          style.opacity = 1;
          break;
        case "flip":
          style.transform = `perspective(1400px) rotateY(${direction * 90}deg) scale(${zoom})`;
          style.transformOrigin = direction > 0 ? "left center" : "right center";
          style.opacity = 0;
          break;
        case "light":
          style.opacity = 0;
          style.filter = "brightness(3)";
          break;
        default:
          break;
      }
    }
  }

  return (
    <div className="relative h-full w-full">
      <img
        src={src}
        alt=""
        className={className}
        style={style}
        draggable={false}
      />
      {transition === "light" && entered && (
        <div className="pointer-events-none absolute inset-0 bg-white cs-flash-overlay" />
      )}
    </div>
  );
}