import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";

export const detectRegion = createServerFn({ method: "GET" }).handler(
  async () => {
    console.log("[detectRegion] Starting");

    const req = getRequest();
    const headers = req.headers;

    // 1. Try hosting headers (fresh for this request)
    let country =
      headers.get("cf-ipcountry") ||
      headers.get("x-vercel-ip-country") ||
      headers.get("x-country-code") ||
      headers.get("x-country") ||
      headers.get("x-geo-country") ||
      headers.get("cloudfront-viewer-country") ||
      null;

    console.log(`[detectRegion] From headers: ${country || "not found"}`);

    // 2. If not found, fallback to environment variable
    if (!country) {
      country = process.env.COUNTRY ?? null;
      console.log(`[detectRegion] From env: ${country || "not set"}`);
    }

    // 3. Determine currency
    let currency: "USD" | "EUR" | "NGN" = "USD";

    if (country) {
      const EUR = new Set([
        "AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR", "DE", "GR",
        "HU", "IE", "IT", "LV", "LT", "LU", "MT", "NL", "PL", "PT", "RO", "SK",
        "SI", "ES", "SE", "IS", "LI", "NO", "GB"
      ]);

      if (country === "NG") currency = "NGN";
      else if (EUR.has(country)) currency = "EUR";
    }

    const result = { country, currency };
    console.log("[detectRegion] Final result:", result);
    return ({ country, currency });
  }
);