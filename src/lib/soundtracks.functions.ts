import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { r2Put, r2Delete, r2PublicUrl } from "./r2.server";

async function assertAdmin(supabase: any) {
  const { data, error } = await supabase.rpc("is_admin");
  if (error || !data) throw new Error("Forbidden");
}

// ─── List all available tracks: admin library + user uploads ─────────
export const listSoundtracks = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const [{ data: admin }, { data: mine }] = await Promise.all([
      supabaseAdmin
        .from("soundtracks")
        .select("id,title,artist,audio_path,duration_seconds")
        .order("created_at", { ascending: false }),
      supabaseAdmin
        .from("user_soundtracks")
        .select("id,title,audio_path,duration_seconds")
        .eq("user_id", context.userId)
        .order("created_at", { ascending: false }),
    ]);

    // R2 public URLs – no signing required (bucket is public)
    const library = (admin ?? []).map((t) => ({
      id: t.id,
      title: t.title,
      artist: t.artist,
      url: r2PublicUrl(t.audio_path),
      source: "library" as const,
      duration: t.duration_seconds,
    }));

    const personal = (mine ?? []).map((t) => ({
      id: t.id,
      title: t.title,
      artist: null as string | null,
      url: r2PublicUrl(t.audio_path),
      source: "personal" as const,
      duration: t.duration_seconds,
    }));

    return { library, personal };
  });

// ─── Admin: list raw tracks ─────────────────────────────────────────
export const adminListSoundtracks = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("soundtracks")
      .select("id,title,artist,audio_path,duration_seconds,created_at")
      .order("created_at", { ascending: false });
    return { tracks: data ?? [] };
  });

// ─── Admin: upload track to R2 ──────────────────────────────────────
export const adminUploadSoundtrack = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: {
    title: string;
    artist?: string;
    filename: string;
    contentType: string;
    base64: string;
    duration?: number;
  }) => input)
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const buffer = Buffer.from(data.base64, "base64");
    const safe = data.filename.replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = `soundtracks/admin/${Date.now()}-${safe}`;

    // Upload to R2
    await r2Put(path, buffer, data.contentType || "audio/mpeg");

    // Save metadata in Supabase
    const { data: row, error } = await supabaseAdmin
      .from("soundtracks")
      .insert({
        title: data.title,
        artist: data.artist ?? null,
        audio_path: path,
        duration_seconds: data.duration ? Math.round(data.duration) : null,
      })
      .select("id")
      .single();
    if (error) throw error;
    return { id: row.id };
  });

// ─── Admin: delete track from R2 and DB ─────────────────────────────
export const adminDeleteSoundtrack = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: row } = await supabaseAdmin
      .from("soundtracks")
      .select("audio_path")
      .eq("id", data.id)
      .maybeSingle();

    if (row?.audio_path) {
      await r2Delete(row.audio_path);
    }
    await supabaseAdmin.from("soundtracks").delete().eq("id", data.id);
    return { ok: true };
  });

// ─── User: upload personal track to R2 ─────────────────────────────
export const uploadUserSoundtrack = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: {
    title: string;
    filename: string;
    contentType: string;
    base64: string;
    duration?: number;
  }) => input)
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const buffer = Buffer.from(data.base64, "base64");
    const safe = data.filename.replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = `soundtracks/users/${context.userId}/${Date.now()}-${safe}`;

    // Upload to R2
    await r2Put(path, buffer, data.contentType || "audio/mpeg");

    // Save metadata in user_soundtracks
    const { data: row, error } = await supabaseAdmin
      .from("user_soundtracks")
      .insert({
        user_id: context.userId,
        title: data.title,
        audio_path: path,
        duration_seconds: data.duration ? Math.round(data.duration) : null,
      })
      .select("id")
      .single();
    if (error) throw error;
    return { id: row.id };
  });

// ─── User: delete own track ─────────────────────────────────────────
export const deleteUserSoundtrack = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: row } = await supabaseAdmin
      .from("user_soundtracks")
      .select("audio_path,user_id")
      .eq("id", data.id)
      .maybeSingle();

    if (!row || row.user_id !== context.userId) throw new Error("Not found");

    if (row.audio_path) {
      await r2Delete(row.audio_path);
    }
    await supabaseAdmin.from("user_soundtracks").delete().eq("id", data.id);
    return { ok: true };
  });