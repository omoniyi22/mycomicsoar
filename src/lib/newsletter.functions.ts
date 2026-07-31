import { createServerFn } from "@tanstack/react-start";
import { sendWelcomeEmail } from "./email.server";

export const subscribeToNewsletter = createServerFn({ method: "POST" })
  .inputValidator((input: { email: string; source?: string }) => {
    if (!input.email || !input.email.includes("@")) {
      throw new Error("Valid email address is required");
    }
    return input;
  })
  .handler(async ({ data }) => {
    const { email, source = "homepage" } = data;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: existing } = await supabaseAdmin
      .from("newsletter_subscribers")
      .select("id, status")
      .eq("email", email)
      .maybeSingle();

    if (existing) {
      if (existing.status === "active") {
        return { success: true, message: "You're already subscribed!" };
      }
      await supabaseAdmin
        .from("newsletter_subscribers")
        .update({ status: "active", source })
        .eq("id", existing.id);
      await sendWelcomeEmail(email);
      return { success: true, message: "Welcome back! You're resubscribed." };
    }

    const { error } = await supabaseAdmin
      .from("newsletter_subscribers")
      .insert({ email, source });

    if (error) {
      if (error.code === "23505") {
        return { success: true, message: "You're already subscribed!" };
      }
      throw new Error("Failed to subscribe. Please try again.");
    }

    await sendWelcomeEmail(email);
    return { success: true, message: "You're subscribed! Check your inbox." };
  });