import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useServerFn } from "@tanstack/react-start";
import { detectRegion } from "./region.functions";
import { detectRegionClient, type Currency } from "./detect-region-client";

// ---------- Fallback rates ----------
const FALLBACK_RATE_NGN_PER_USD = 1500;
const FALLBACK_RATE_EUR_PER_USD = 0.92;

// ---------- Types ----------
type ComicPrices = { price_ngn?: number | null; price_eur?: number | null };

type CurrencyCtx = {
  currency: Currency;
  setCurrency: (c: Currency) => void;
  country: string | null;
  format: (usd: number, prices?: ComicPrices | null) => string;
  resolveAmount: (usd: number, prices?: ComicPrices | null) => number;
  symbol: string;
};

// ---------- Context ----------
const Ctx = createContext<CurrencyCtx | null>(null);

// ---------- Constants ----------
const LS_KEY = "vq:currency";
const COUNTRY_LS_KEY = "vq:country";
const COOKIE_MAX_AGE = 31536000; // 1 year

// ---------- Provider ----------
export function CurrencyProvider({ children }: { children: ReactNode }) {
  const [currency, setCurrencyState] = useState<Currency>("USD");
  const [country, setCountry] = useState<string | null>(null);
  const [initialized, setInitialized] = useState(false);
  const fetchRegion = useServerFn(detectRegion);

  // Helper to set cookies (client only)
  const setCookie = (name: string, value: string) => {
    if (typeof document === "undefined") return;
    document.cookie = `${name}=${value}; Path=/; Max-Age=${COOKIE_MAX_AGE}`;
  };

  // ----- Effect: detect region on mount -----
  useEffect(() => {
    let mounted = true;

    // 1. Try to get fresh region from the server
    fetchRegion()
      .then((serverRegion) => {
        if (!mounted) return;

        // If server gave a country, use it (production)
        if (serverRegion.country) {
          setCountry(serverRegion.country);
          setCurrencyState(serverRegion.currency);
          // Store in localStorage and cookies for future fallback
          localStorage.setItem(LS_KEY, serverRegion.currency);
          localStorage.setItem(COUNTRY_LS_KEY, serverRegion.country);
          setCookie("country", serverRegion.country);
          setCookie("currency", serverRegion.currency);
          setInitialized(true);
          console.log("[CurrencyProvider] Region from server:", serverRegion);
          return;
        }

        // 2. Server returned no country → run client-side detection
        console.log("[CurrencyProvider] Server returned no country, running client detection");
        detectRegionClient()
          .then((clientRegion) => {
            if (!mounted) return;
            const { country: c, currency: cur } = clientRegion;
            if (c) {
              setCountry(c);
              setCurrencyState(cur);
              localStorage.setItem(LS_KEY, cur);
              localStorage.setItem(COUNTRY_LS_KEY, c);
              setCookie("country", c);
              setCookie("currency", cur);
              console.log("[CurrencyProvider] Region from client:", clientRegion);
            } else {
              // 3. Client detection failed → fallback to localStorage
              const savedCurrency = localStorage.getItem(LS_KEY) as Currency | null;
              const savedCountry = localStorage.getItem(COUNTRY_LS_KEY) || null;
              if (savedCurrency === "NGN" || savedCurrency === "USD" || savedCurrency === "EUR") {
                setCurrencyState(savedCurrency);
                setCountry(savedCountry);
                console.log("[CurrencyProvider] Using fallback from localStorage:", { country: savedCountry, currency: savedCurrency });
              } else {
                // Last resort: USD
                setCurrencyState("USD");
                setCountry(null);
                console.warn("[CurrencyProvider] No fallback found, defaulting to USD");
              }
            }
            setInitialized(true);
          })
          .catch((err) => {
            console.error("[CurrencyProvider] Client detection failed:", err);
            // Fallback to localStorage
            const savedCurrency = localStorage.getItem(LS_KEY) as Currency | null;
            const savedCountry = localStorage.getItem(COUNTRY_LS_KEY) || null;
            if (savedCurrency === "NGN" || savedCurrency === "USD" || savedCurrency === "EUR") {
              setCurrencyState(savedCurrency);
              setCountry(savedCountry);
              console.log("[CurrencyProvider] Using fallback from localStorage after error:", { country: savedCountry, currency: savedCurrency });
            } else {
              setCurrencyState("USD");
              setCountry(null);
            }
            setInitialized(true);
          });
      })
      .catch((err) => {
        console.error("[CurrencyProvider] Server detection failed:", err);
        // Fallback to localStorage
        const savedCurrency = localStorage.getItem(LS_KEY) as Currency | null;
        const savedCountry = localStorage.getItem(COUNTRY_LS_KEY) || null;
        if (savedCurrency === "NGN" || savedCurrency === "USD" || savedCurrency === "EUR") {
          setCurrencyState(savedCurrency);
          setCountry(savedCountry);
          console.log("[CurrencyProvider] Using fallback from localStorage after server error:", { country: savedCountry, currency: savedCurrency });
        } else {
          setCurrencyState("USD");
          setCountry(null);
        }
        setInitialized(true);
      });

    return () => {
      mounted = false;
    };
  }, [fetchRegion]);

  // ----- setCurrency (also persists) -----
  function setCurrency(c: Currency) {
    setCurrencyState(c);
    localStorage.setItem(LS_KEY, c);
    if (country) {
      localStorage.setItem(COUNTRY_LS_KEY, country);
      setCookie("country", country);
    }
    setCookie("currency", c);
  }

  // ----- resolveAmount -----
  // This is where the logic picks price_eur/price_ngn if available.
  function resolveAmount(usd: number, prices?: ComicPrices | null) {
    if (currency === "NGN") {
      const ngn = prices?.price_ngn;
      if (ngn != null && ngn > 0) return Number(ngn);
      return Math.round(usd * FALLBACK_RATE_NGN_PER_USD);
    }
    if (currency === "EUR") {
      const eur = prices?.price_eur;
      if (eur != null && eur > 0) return Number(eur);
      return Number((usd * FALLBACK_RATE_EUR_PER_USD).toFixed(2));
    }
    return Number(usd);
  }

  // ----- format -----
  function format(usd: number, prices?: ComicPrices | null) {
    console.log({ usd, prices })
    const amount = resolveAmount(usd, prices);
    if (currency === "NGN") return `₦${amount.toLocaleString("en-NG", { maximumFractionDigits: 0 })}`;
    if (currency === "EUR") return `€${amount.toFixed(2)}`;
    return `$${amount.toFixed(2)}`;
  }

  const symbol = currency === "NGN" ? "₦" : currency === "EUR" ? "€" : "$";

  // ----- Provider value -----
  const value: CurrencyCtx = {
    currency,
    setCurrency,
    country,
    format,
    resolveAmount,
    symbol,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

// ---------- useCurrency hook ----------
export function useCurrency() {
  const v = useContext(Ctx);
  if (!v) {
    // fallback (safe default)
    return {
      currency: "USD" as Currency,
      setCurrency: () => { },
      country: null,
      format: (usd: number) => `$${usd.toFixed(2)}`,
      resolveAmount: (usd: number) => usd,
      symbol: "$",
    } satisfies CurrencyCtx;
  }
  return v;
}