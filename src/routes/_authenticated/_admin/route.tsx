import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { Outlet } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { SiteHeader, SiteFooter } from "@/components/site-chrome";

export const Route = createFileRoute("/_authenticated/_admin")({
  beforeLoad: async () => {
    const { data, error } = await supabase.rpc("is_admin");
    if (error || !data) {
      throw redirect({ to: "/account" });
    }
  },
  component: AdminLayout,
});

function AdminLayout() {
  return (
    <div className="min-h-screen bg-vignette">
      <SiteHeader />
      <div className="border-b border-border/60 bg-background/40">
        <div className="container-tight py-4 flex items-center gap-6 text-sm">
          <span className="text-xs uppercase tracking-[0.25em] text-gold">Admin</span>
          <Link to="/admin" className="text-muted-foreground hover:text-foreground" activeProps={{ className: "text-foreground" }} activeOptions={{ exact: true }}>
            Comics
          </Link>
          <Link to="/admin/new" className="text-muted-foreground hover:text-foreground">
            + New comic
          </Link>
        </div>
      </div>
      <Outlet />
      <SiteFooter />
    </div>
  );
}
