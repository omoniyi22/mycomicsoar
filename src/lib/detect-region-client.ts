export type Currency = "NGN" | "USD" | "EUR";

export async function detectRegionClient() {
    console.log("[detectRegionClient] Starting client-side detection");

    try {
        const res = await fetch("https://ipapi.co/json/");
        console.log(`[detectRegionClient] IP API response status: ${res.status}`);

        if (!res.ok) {
            console.warn("[detectRegionClient] IP API failed, status:", res.status);
            return { country: null, currency: "USD" as Currency };
        }

        const data = await res.json();
        const country = data.country_code as string | null;

        const EUR = new Set([
            "AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR", "DE", "GR",
            "HU", "IE", "IT", "LV", "LT", "GB", "LU", "MT", "NL", "PL", "PT", "RO", "SK",
            "SI", "ES", "SE", "IS", "LI", "NO"
        ]);

        let currency: Currency = localStorage.getItem("vq:currency") as Currency || "USD";
        if (country === "NG") currency = "NGN";
        else if (country && EUR.has(country)) currency = "EUR";

        console.log("[detectRegionClient] Detected:", { country, currency });
        return { country, currency };
    } catch (err) {
        console.error("[detectRegionClient] Error:", err);
        return { country: null, currency: "USD" as Currency };
    }
}