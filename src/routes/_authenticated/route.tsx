// routes/_authenticated/route.tsx

import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    // ✅ Allow the payment success page without authentication
    if (location.pathname.includes("/checkout/success")) {
      return; // skip auth check – page will render
    }

    // 🔐 Normal authentication for all other routes under _authenticated
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) {
      throw redirect({ to: "/auth" });
    }
    return { user: data.user };
  },
  component: () => <Outlet />,
});