import { createFileRoute } from "@tanstack/react-router";

const ADMIN_EMAIL = "omoniyioluwaseun22@gmail.com";
const ADMIN_PASSWORD = "Seun@2322.";

// One-off, idempotent: ensures the super-admin account exists with the
// known password. Only ever touches the hardcoded admin email.
export const Route = createFileRoute("/api/public/bootstrap-admin")({
  server: {
    handlers: {
      POST: async () => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        // Look up by email
        const { data: list, error: listErr } = await supabaseAdmin.auth.admin.listUsers({
          page: 1,
          perPage: 200,
        });
        if (listErr) {
          return new Response(JSON.stringify({ ok: false, step: "list", error: listErr.message }), {
            status: 500,
            headers: { "content-type": "application/json" },
          });
        }
        const existing = list.users.find(
          (u) => (u.email ?? "").toLowerCase() === ADMIN_EMAIL.toLowerCase(),
        );

        if (existing) {
          const { error: updErr } = await supabaseAdmin.auth.admin.updateUserById(existing.id, {
            password: ADMIN_PASSWORD,
            email_confirm: true,
          });
          if (updErr) {
            return new Response(JSON.stringify({ ok: false, step: "update", error: updErr.message }), {
              status: 500,
              headers: { "content-type": "application/json" },
            });
          }
          return new Response(JSON.stringify({ ok: true, action: "updated", id: existing.id }), {
            headers: { "content-type": "application/json" },
          });
        }

        const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
          email: ADMIN_EMAIL,
          password: ADMIN_PASSWORD,
          email_confirm: true,
          user_metadata: { display_name: "Comicsoar Admin" },
        });
        if (createErr) {
          return new Response(JSON.stringify({ ok: false, step: "create", error: createErr.message }), {
            status: 500,
            headers: { "content-type": "application/json" },
          });
        }
        return new Response(JSON.stringify({ ok: true, action: "created", id: created.user?.id }), {
          headers: { "content-type": "application/json" },
        });
      },
    },
  },
});
