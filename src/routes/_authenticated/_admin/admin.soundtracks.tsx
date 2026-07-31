import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, useRef } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  adminListSoundtracks,
  adminUploadSoundtrack,
  adminDeleteSoundtrack,
} from "@/lib/soundtracks.functions";
import { fileToBase64 } from "@/lib/file-utils";
import { Loader2, Music, Trash2, Upload, Play, Pause } from "lucide-react";

export const Route = createFileRoute("/_authenticated/_admin/admin/soundtracks")({
  head: () => ({ meta: [{ title: "Admin — Soundtracks" }] }),
  component: AdminSoundtracks,
});

type Track = {
  id: string;
  title: string;
  artist: string | null;
  audio_path: string;
  duration_seconds: number | null;
};

function AdminSoundtracks() {
  const listFn = useServerFn(adminListSoundtracks);
  const uploadFn = useServerFn(adminUploadSoundtrack);
  const delFn = useServerFn(adminDeleteSoundtrack);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [title, setTitle] = useState("");
  const [artist, setArtist] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Audio player state
  const [playingId, setPlayingId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  async function refresh() {
    const { tracks } = await listFn();
    setTracks(tracks as Track[]);
  }
  useEffect(() => {
    refresh().catch((e) => setErr(e instanceof Error ? e.message : "Failed"));
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!file || !title.trim()) return;
    setBusy(true);
    setErr(null);
    try {
      const base64 = await fileToBase64(file);
      let duration: number | undefined;
      try {
        duration = await readDuration(file);
      } catch {}
      await uploadFn({
        data: {
          title: title.trim(),
          artist: artist.trim() || undefined,
          filename: file.name,
          contentType: file.type || "audio/mpeg",
          base64,
          duration,
        },
      });
      setTitle("");
      setArtist("");
      setFile(null);
      (document.getElementById("st-file") as HTMLInputElement).value = "";
      await refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    if (!confirm("Delete this track?")) return;
    await delFn({ data: { id } });
    await refresh();
    // If the deleted track was playing, stop it
    if (playingId === id) {
      audioRef.current?.pause();
      setPlayingId(null);
    }
  }

  const togglePlay = (track: Track) => {
    const url = track.audio_path; // r2PublicUrl will be returned by the server
    if (playingId === track.id) {
      audioRef.current?.pause();
      setPlayingId(null);
      return;
    }
    // If another track is playing, stop it first
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = url;
      audioRef.current.load();
      audioRef.current.play().catch(() => {});
    } else {
      audioRef.current = new Audio(url);
      audioRef.current.play().catch(() => {});
      audioRef.current.onended = () => setPlayingId(null);
    }
    setPlayingId(track.id);
  };

  return (
    <main className="container-tight py-10">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl text-foreground flex items-center gap-2">
            <Music className="h-6 w-6 text-gold" /> Reader soundtracks
          </h1>
          <p className="text-sm text-muted-foreground">
            Tracks readers can play while reading any comic.
          </p>
        </div>
        <Link to="/admin" className="text-sm text-gold hover:underline">← Back</Link>
      </header>

      <form
        onSubmit={submit}
        className="rounded-lg border border-border bg-card p-5 space-y-3 mb-8"
      >
        <div className="grid sm:grid-cols-2 gap-3">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Title"
            required
            className="rounded-md bg-background border border-border px-3 py-2 text-sm"
          />
          <input
            value={artist}
            onChange={(e) => setArtist(e.target.value)}
            placeholder="Artist (optional)"
            className="rounded-md bg-background border border-border px-3 py-2 text-sm"
          />
        </div>
        <input
          id="st-file"
          type="file"
          accept="audio/*"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          required
          className="block w-full text-sm text-muted-foreground file:mr-3 file:rounded-md file:border-0 file:bg-gold file:px-3 file:py-2 file:text-primary-foreground file:font-semibold"
        />
        {err && <p className="text-sm text-red-400">{err}</p>}
        <button
          type="submit"
          disabled={busy || !file || !title.trim()}
          className="inline-flex items-center gap-2 rounded-md bg-gold px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
          Upload track
        </button>
      </form>

      <div className="rounded-lg border border-border bg-card divide-y divide-border">
        {tracks.length === 0 ? (
          <p className="p-6 text-center text-sm text-muted-foreground">No tracks yet.</p>
        ) : (
          tracks.map((t) => (
            <div key={t.id} className="flex items-center justify-between px-4 py-3">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <button
                  onClick={() => togglePlay(t)}
                  className="text-gold hover:text-gold/80 transition-colors"
                  aria-label={playingId === t.id ? "Pause" : "Play"}
                >
                  {playingId === t.id ? (
                    <Pause className="h-5 w-5" />
                  ) : (
                    <Play className="h-5 w-5" />
                  )}
                </button>
                <div className="min-w-0">
                  <div className="font-display text-foreground truncate">{t.title}</div>
                  <div className="text-xs text-muted-foreground">
                    {t.artist ?? "—"}
                    {t.duration_seconds ? ` · ${fmt(t.duration_seconds)}` : ""}
                  </div>
                </div>
              </div>
              <button
                onClick={() => remove(t.id)}
                className="text-muted-foreground hover:text-red-400 ml-2 flex-shrink-0"
                aria-label="Delete"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))
        )}
      </div>
    </main>
  );
}

function fmt(s: number) {
  const m = Math.floor(s / 60);
  const r = Math.floor(s % 60);
  return `${m}:${r.toString().padStart(2, "0")}`;
}

function readDuration(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const audio = document.createElement("audio");
    audio.preload = "metadata";
    audio.src = url;
    audio.onloadedmetadata = () => {
      URL.revokeObjectURL(url);
      resolve(audio.duration);
    };
    audio.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not read audio"));
    };
  });
}