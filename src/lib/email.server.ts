import { Resend } from "resend";
import { resolveUrl } from "./reader.functions";

const resend = new Resend(process.env.RESEND_API_KEY);
console.log(process.env.RESEND_API_KEY)
const from = process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev";

// ─── Logo URL ───────────────────────────────────────────
const LOGO_URL =
    "https://xtmicxcmcxxhskgrygxy.supabase.co/storage/v1/object/public/logo/ChatGPT%20Image%20Jul%206,%202026,%2001_14_33%20Pqq-removebg-preview.jpg";

// ─── Shared email layout ───────────────────────────────
function emailLayout(content: string) {
    return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>ComicSoar</title>
    </head>
    <body style="margin:0;padding:24px;background:#f5f7fa;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#111827;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        <tr><td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border:1px solid #e5e7eb;border-radius:16px;overflow:hidden;">
            <!-- Logo -->
            <tr>
              <td align="center" style="padding:28px 32px 12px;">
                <img
                  src="${LOGO_URL}"
                  alt="ComicSoar"
                  width="82"
                  style="display:block;border:0;outline:none;text-decoration:none;"
                />
              </td>
            </tr>
            <!-- Content -->
            ${content}
            <!-- Footer -->
            <tr>
              <td style="padding:24px 32px 28px;text-align:center;border-top:1px solid #f3f4f6;">
                <p style="margin:0;font-size:12px;color:#9ca3af;">
                  &copy; ${new Date().getFullYear()} ComicSoar. All rights reserved.
                </p>
              </td>
            </tr>
          </table>
        </td></tr>
      </table>
    </body>
    </html>
  `;
}

// ─── Welcome Email ──────────────────────────────────────
export async function sendWelcomeEmail(to: string, name?: string) {
    try {
        const content = `
      <tr>
        <td style="padding:8px 32px 4px;">
          <h1 style="margin:0;font-size:24px;font-weight:700;color:#111827;">Welcome to ComicSoar!</h1>
        </td>
      </tr>
      <tr>
        <td style="padding:8px 32px 20px;">
          <p style="margin:0;font-size:15px;line-height:1.6;color:#4b5563;">
            ${name ? `Hi ${name},` : "Hello!"}
          </p>
          <p style="margin:12px 0 0;font-size:15px;line-height:1.6;color:#4b5563;">
            You're now subscribed to the <strong>Dispatch from the Vault</strong> — our weekly newsletter with:
          </p>
          <ul style="margin:12px 0 0;padding-left:20px;font-size:15px;line-height:1.8;color:#4b5563;">
          <li>Weekly release previews</li>
          <li>Exclusive variant first-looks</li>
          <li>Creator interviews</li>
          </ul>
          <p style="margin:16px 0 0;font-size:15px;line-height:1.6;color:#4b5563;">
            Stay tuned for your first issue this Wednesday.
          </p>
          <p style="margin:20px 0 0;font-size:15px;line-height:1.6;color:#4b5563;">
            — The ComicSoar Team
          </p>
        </td>
      </tr>
      <tr>
        <td style="padding:0 32px 12px;">
          <p style="margin:0;font-size:12px;color:#9ca3af;">
            If you didn't sign up, you can ignore this email.
          </p>
        </td>
      </tr>
    `;

        const { data, error } = await resend.emails.send({
            from,
            to,
            subject: "Welcome to the Vault – ComicSoar Newsletter",
            html: emailLayout(content),
        });
        if (error) console.error("Welcome email error:", error);
        return data;
    } catch (err) {
        console.error("Welcome email failed:", err);
    }
}

// ─── Purchase Confirmation Email ─────────────────────────
export async function sendPurchaseConfirmation(
    to: string,
    orderId: string,
    items: Array<{ 
        title: string; 
        comicId: string; 
        unitPrice: number; 
        quantity: number;
        coverUrl: string | null;
    }>,
    total: number,
    currency: string
) {
    try {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const expiry = (Number(process.env.DOWNLOAD_LINK_EXPIRY_DAYS) || 30) * 24 * 60 * 60;

        const comicLinks = await Promise.all(
            items.map(async (item) => {
                const { data: comic } = await supabaseAdmin
                    .from("comics")
                    .select("pdf_path, pdf_path_landscape")
                    .eq("id", item.comicId)
                    .maybeSingle();

                if (!comic) return null;

                const portraitUrl = comic.pdf_path
                    ? await resolveUrl("comic-pdfs", comic.pdf_path, expiry)
                    : null;
                const landscapeUrl = comic.pdf_path_landscape
                    ? await resolveUrl("comic-pdfs", comic.pdf_path_landscape, expiry)
                    : null;

                return {
                    title: item.title,
                    portraitUrl,
                    landscapeUrl,
                    unitPrice: item.unitPrice,
                    quantity: item.quantity,
                    coverUrl: item.coverUrl,
                };
            })
        );

        const validLinks = comicLinks.filter((link) => link !== null) as Array<{
            title: string;
            portraitUrl: string | null;
            landscapeUrl: string | null;
            unitPrice: number;
            quantity: number;
            coverUrl: string | null;
        }>;

        const itemsHtml = validLinks
            .map((link) => {
                const price = currency === "NGN"
                    ? `₦${(link.unitPrice * link.quantity).toLocaleString("en-NG", { maximumFractionDigits: 0 })}`
                    : currency === "EUR"
                        ? `€${(link.unitPrice * link.quantity).toFixed(2)}`
                        : `$${(link.unitPrice * link.quantity).toFixed(2)}`;

                const downloadButtons = `
          <div style="display:flex;gap:12px;flex-wrap:wrap;margin-top:8px;">
            ${link.portraitUrl ? `<a href="${link.portraitUrl}" style="display:inline-block;background:#d4a574;color:#fff;padding:6px 16px;border-radius:6px;text-decoration:none;font-size:13px;font-weight:500;">📱 Portrait</a>` : ''}
            ${link.landscapeUrl ? `<a href="${link.landscapeUrl}" style="display:inline-block;background:#d4a574;color:#fff;padding:6px 16px;border-radius:6px;text-decoration:none;font-size:13px;font-weight:500;">💻 Landscape</a>` : ''}
          </div>
        `;

                const coverImg = link.coverUrl ? `
                    <img src="${link.coverUrl}" alt="${link.title}" style="width:60px;height:auto;border-radius:4px;object-fit:cover;margin-right:12px;" />
                ` : '';

                return `
          <div style="padding:12px 0;border-bottom:1px solid #f3f4f6;display:flex;align-items:center;">
            ${coverImg}
            <div style="flex:1;">
              <div style="display:flex;justify-content:space-between;align-items:center;">
                <span style="font-weight:600;">${link.title}</span>
                <span style="font-weight:500;color:#d4a574;">${price}</span>
              </div>
              ${downloadButtons}
            </div>
          </div>
        `;
            })
            .join("");

        const totalFormatted = currency === "NGN"
            ? `₦${total.toLocaleString("en-NG", { maximumFractionDigits: 0 })}`
            : currency === "EUR"
                ? `€${total.toFixed(2)}`
                : `$${total.toFixed(2)}`;

        const accountLink = `${process.env.NEXT_PUBLIC_APP_URL || "https://comicsoar.com"}/account?section=orders`;

        const content = `
      <tr>
        <td style="padding:8px 32px 4px;">
          <h2 style="margin:0;font-size:22px;font-weight:700;color:#111827;">Thank you for your purchase! 🎉</h2>
        </td>
      </tr>
      <tr>
        <td style="padding:8px 32px 16px;">
          <p style="margin:0;font-size:15px;line-height:1.6;color:#4b5563;">
            Your order <strong>#${orderId.slice(0, 8)}</strong> is complete. 
            Total: <strong>${totalFormatted}</strong>
          </p>
          <p style="margin:12px 0 0;font-size:15px;line-height:1.6;color:#4b5563;">
            Your comics are ready – click the buttons below to download.
          </p>
          <div style="margin:16px 0 0;">
            ${itemsHtml}
          </div>
          <p style="margin:20px 0 0;font-size:14px;color:#6b7280;">
            These links will expire in <strong>${Math.round(expiry / 86400)} days</strong>. Please save your files locally.
          </p>
          <div style="margin:20px 0 12px;text-align:center;">
            <a href="${accountLink}" style="display:inline-block;background:#1a1a2e;color:#fff;padding:10px 24px;border-radius:8px;text-decoration:none;font-size:14px;font-weight:500;">
              View your order receipt →
            </a>
          </div>
          <p style="margin:0;font-size:14px;color:#6b7280;text-align:center;">
            You can also find your order history in your account.
          </p>
          <p style="margin:16px 0 0;font-size:15px;line-height:1.6;color:#4b5563;">
            Happy reading,<br/>
            — The ComicSoar Team
          </p>
        </td>
      </tr>
    `;

        const { data, error } = await resend.emails.send({
            from,
            to,
            subject: `Your ComicSoar order #${orderId.slice(0, 8)} is ready!`,
            html: emailLayout(content),
        });

        if (error) console.error("Purchase confirmation email error:", error);
        return data;
    } catch (err) {
        console.error("Purchase confirmation email failed:", err);
    }
}

// ─── Contact Confirmation Email ────────────────────────
export async function sendContactConfirmation(to: string, name: string) {
    try {
        const content = `
      <tr>
        <td style="padding:8px 32px 4px;">
          <h2 style="margin:0;font-size:22px;font-weight:700;color:#111827;">Thanks, ${name}!</h2>
        </td>
      </tr>
      <tr>
        <td style="padding:8px 32px 20px;">
          <p style="margin:0;font-size:15px;line-height:1.6;color:#4b5563;">
            We've received your message and will get back to you within 24 hours.
          </p>
          <p style="margin:20px 0 0;font-size:15px;line-height:1.6;color:#4b5563;">
            — The ComicSoar Team
          </p>
        </td>
      </tr>
    `;

        const { data, error } = await resend.emails.send({
            from,
            to,
            subject: "We received your message – ComicSoar",
            html: emailLayout(content),
        });
        if (error) console.error("Contact confirmation error:", error);
        return data;
    } catch (err) {
        console.error("Contact confirmation failed:", err);
    }
}

// ─── Verification Code Email ───────────────────────────
export async function sendVerificationCode(to: string, code: string) {
    try {
        const content = `
      <tr>
        <td style="padding:8px 32px 4px;">
          <h2 style="margin:0;font-size:22px;font-weight:700;color:#111827;">Verification Code</h2>
        </td>
      </tr>
      <tr>
        <td style="padding:8px 32px 20px;">
          <p style="margin:0;font-size:15px;line-height:1.6;color:#4b5563;">
            Enter the code below to verify your email:
          </p>
          <div style="margin:20px 0;padding:16px 24px;background:#f3f4f6;border-radius:8px;text-align:center;">
            <span style="font-size:32px;font-weight:700;letter-spacing:6px;color:#111827;font-family:monospace;">
              ${code}
            </span>
          </div>
          <p style="margin:0;font-size:14px;color:#6b7280;">
            This code will expire in 10 minutes.
          </p>
          <p style="margin:20px 0 0;font-size:14px;color:#6b7280;">
            If you didn't request this, you can ignore this email.
          </p>
        </td>
      </tr>
    `;

        const { data, error } = await resend.emails.send({
            from,
            to,
            subject: "Your verification code – ComicSoar",
            html: emailLayout(content),
        });
        if (error) console.error("Verification email error:", error);
        return data;
    } catch (err) {
        console.error("Verification email failed:", err);
    }
}

// ─── Admin Notification ─────────────────────────────────
export async function sendAdminNotification(name: string, email: string, subject: string, message: string) {
    try {
        const adminEmail = process.env.ADMIN_EMAIL || "admin@comicsoar.com";
        const content = `
      <tr>
        <td style="padding:8px 32px 4px;">
          <h2 style="margin:0;font-size:22px;font-weight:700;color:#111827;">New Contact Message</h2>
        </td>
      </tr>
      <tr>
        <td style="padding:8px 32px 20px;">
          <p style="margin:0;font-size:15px;line-height:1.8;color:#4b5563;">
            <strong>From:</strong> ${name}<br/>
            <strong>Email:</strong> <a href="mailto:${email}" style="color:#d4a574;">${email}</a><br/>
            <strong>Subject:</strong> ${subject}
          </p>
          <div style="margin:16px 0 0;padding:16px;background:#f9fafb;border-radius:8px;">
            <p style="margin:0;font-size:15px;line-height:1.6;color:#374151;white-space:pre-wrap;">${message}</p>
          </div>
        </td>
      </tr>
    `;

        const { data, error } = await resend.emails.send({
            from,
            to: adminEmail,
            subject: `[ComicSoar] New Contact: ${subject}`,
            html: emailLayout(content),
        });
        if (error) console.error("Admin notification error:", error);
        return data;
    } catch (err) {
        console.error("Admin notification failed:", err);
    }
}