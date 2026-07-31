import { createServerFn } from "@tanstack/react-start";
import { sendContactConfirmation, sendAdminNotification } from "./email.server";

export const sendContactMessage = createServerFn({ method: "POST" })
  .inputValidator((input: { name: string; email: string; subject: string; message: string }) => {
    if (!input.name || input.name.length < 2) throw new Error("Name is required");
    if (!input.email || !input.email.includes("@")) throw new Error("Valid email is required");
    if (!input.subject || input.subject.length < 2) throw new Error("Subject is required");
    if (!input.message || input.message.length < 5) throw new Error("Message is required");
    return input;
  })
  .handler(async ({ data }) => {
    const { name, email, subject, message } = data;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { error } = await supabaseAdmin
      .from("contact_messages")
      .insert({ name, email, subject, message });

    if (error) {
      console.error("Contact form error:", error);
      throw new Error("Failed to send message. Please try again.");
    }

    await sendContactConfirmation(email, name);
    await sendAdminNotification(name, email, subject, message);

    return { success: true };
  });