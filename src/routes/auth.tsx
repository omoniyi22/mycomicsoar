import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SiteHeader, SiteFooter } from "@/components/site-chrome";
import { Mail, Lock, Sparkles, Loader2, KeyRound } from "lucide-react";
import logoUrl from "@/assets/comicsoar-logo.png";
const redirectTo = `http://localhost:8080/auth`
  // window.location.hostname === "localhost"
  //   ? `${window.location.origin}/auth`
  //   : "https://comicsoar.com/auth";


export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — ComicSoar" },
      { name: "description", content: "Sign in or create an account on ComicSoar to start your digital comic library." },
    ],
  }),
  component: AuthPage,
});

type Mode = "signin" | "signup" | "otp";

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  // On mount, check if user already logged in, and handle OAuth callback
  useEffect(() => {
    // Check existing session
    supabase.auth.getSession().then(({ data, error }) => {
      if (data.session) {
        navigate({ to: "/account", replace: true });
      }
    });

    // Listen for auth changes (e.g., after OAuth redirect)
    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session) {
        navigate({ to: "/account", replace: true });
      }
    });

    return () => {
      listener?.subscription.unsubscribe();
    };
  }, [navigate]);

  function resetMsgs() {
    setError(null);
    setInfo(null);
  }

  // ---- Email/Password ----
  async function handleEmail(e: React.FormEvent) {
    e.preventDefault();
    resetMsgs();
    setLoading(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: { display_name: displayName || email.split("@")[0] },
          },
        });
        if (error) throw error;
        setInfo("Check your email to confirm your account, then sign in.");
        setMode("signin");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate({ to: "/account", replace: true });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  // ---- OTP (Magic Link) ----
  async function sendOtp(e: React.FormEvent) {
    e.preventDefault();
    resetMsgs();
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          shouldCreateUser: true,
          data: {
            display_name: displayName || email.split("@")[0],
          },
        },
      });
      if (error) throw error;
      setOtpSent(true);
      setInfo("We sent a 6-digit code to your inbox.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send code");
    } finally {
      setLoading(false);
    }
  }

  async function verifyOtp(e: React.FormEvent) {
    e.preventDefault();
    resetMsgs();
    setLoading(true);
    try {
      const { error } = await supabase.auth.verifyOtp({
        email,
        token: otp.trim(),
        type: "email",
      });
      if (error) throw error;
      navigate({ to: "/account", replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid code");
    } finally {
      setLoading(false);
    }
  }

  // ---- Google OAuth (replaces Lovable) ----
  async function handleGoogle() {
    resetMsgs();
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo
        },
      });
      if (error) throw error;
      // The OAuth flow will redirect the user to Google, then back here.
      // After redirect, the onAuthStateChange listener will catch the session.
    } catch (err) {
      setError(err instanceof Error ? err.message : "Google sign-in failed");
      setLoading(false);
    }
  }

  // ---- Render ----
  const heading =
    mode === "signin" ? "Welcome back, collector."
      : mode === "signup" ? "Start your collection."
        : "Sign in without a password.";
  const subhead =
    mode === "signin" ? "Sign in to access your library and pull list."
      : mode === "signup" ? "Create an account to buy digital issues and build your library."
        : "We'll email you a one-time code. No password needed — perfect for guest purchases.";

  return (
    <div className="min-h-screen bg-vignette flex flex-col">
      <SiteHeader />
      <main className="flex-1 grid place-items-center px-6 py-16">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <img src={logoUrl} alt="ComicSoar" className="mx-auto h-24 w-24 object-contain drop-shadow-[0_0_30px_rgba(212,175,55,0.25)]" />
            <div className="mt-3 text-xs uppercase tracking-[0.25em] text-gold">ComicSoar Members</div>
            <h1 className="mt-2 font-display text-4xl text-foreground">{heading}</h1>
            <p className="mt-2 text-sm text-muted-foreground">{subhead}</p>
          </div>

          <div className="rounded-xl border border-border bg-card p-6 shadow-elegant">
            <button
              onClick={handleGoogle}
              disabled={loading}
              className="w-full inline-flex items-center justify-center gap-3 rounded-md border border-gold-soft bg-background/40 px-4 py-2.5 text-sm font-medium text-foreground hover:border-gold transition-colors disabled:opacity-50"
            >
              <GoogleIcon /> Continue with Google
            </button>

            <div className="relative my-5 text-center">
              <div className="absolute inset-x-0 top-1/2 h-px bg-border" />
              <span className="relative bg-card px-3 text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                or with email
              </span>
            </div>

            {/* Mode tabs */}

            <div className="mb-4 grid grid-cols-3 gap-1 rounded-md border border-border p-1 text-xs">
              {([
                ["signin", "Sign in"],
                ["signup", "Sign up"],
                ["otp", "Email code"],
              ] as const).map(([m, label]) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => { setMode(m); resetMsgs(); setOtpSent(false); }}
                  className={`rounded px-2 py-1.5 transition-colors ${mode === m ? "bg-gold text-primary-foreground font-semibold" : "text-muted-foreground hover:text-foreground"
                    }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {mode === "otp" ? (
              <form onSubmit={otpSent ? verifyOtp : sendOtp} className="space-y-3">
                <Field icon={<Mail className="h-4 w-4 text-gold" />}>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={otpSent}
                    placeholder="you@inbox.com"
                    className="w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none disabled:opacity-70"
                  />
                </Field>
                {otpSent && (
                  <Field icon={<KeyRound className="h-4 w-4 text-gold" />}>
                    <input
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={6}
                      required
                      value={otp}
                      onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                      placeholder="6-digit code"
                      className="w-full bg-transparent text-sm text-foreground tracking-[0.5em] font-mono placeholder:text-muted-foreground focus:outline-none"
                    />
                  </Field>
                )}

                {error && <p className="text-xs text-red-400">{error}</p>}
                {info && <p className="text-xs text-gold">{info}</p>}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-md bg-gold px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-glow hover:scale-[1.01] transition-transform disabled:opacity-60"
                >
                  {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                  {otpSent ? "Verify & continue" : "Email me a code"}
                </button>
                {otpSent && (
                  <button
                    type="button"
                    onClick={() => { setOtpSent(false); setOtp(""); resetMsgs(); }}
                    className="w-full text-center text-xs text-muted-foreground hover:text-gold"
                  >
                    Use a different email
                  </button>
                )}
              </form>
            ) : (
              <form onSubmit={handleEmail} className="space-y-3">
                {mode === "signup" && (
                  <Field icon={<Sparkles className="h-4 w-4 text-gold" />}>
                    <input
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      placeholder="Display name"
                      className="w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
                    />
                  </Field>
                )}
                <Field icon={<Mail className="h-4 w-4 text-gold" />}>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@inbox.com"
                    className="w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
                  />
                </Field>
                <Field icon={<Lock className="h-4 w-4 text-gold" />}>
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Password"
                    className="w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
                  />
                </Field>

                {error && <p className="text-xs text-red-400">{error}</p>}
                {info && <p className="text-xs text-gold">{info}</p>}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-md bg-gold px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-glow hover:scale-[1.01] transition-transform disabled:opacity-60"
                >
                  {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                  {mode === "signin" ? "Sign in" : "Create account"}
                </button>
              </form>
            )}

            <p className="mt-5 text-center text-xs text-muted-foreground">
              Buying as a guest? Use <button onClick={() => { setMode("otp"); resetMsgs(); }} className="text-gold hover:underline">Email code</button> — no password needed.
            </p>
          </div>

          <p className="mt-6 text-center text-[11px] text-muted-foreground">
            By continuing you agree to our terms. <Link to="/" className="hover:text-gold">Back to home</Link>
          </p>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}

// ----- Helpers -----
function Field({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <label className="flex items-center gap-2 rounded-md border border-border bg-background/40 px-3 py-2 focus-within:border-gold-soft">
      {icon}
      {children}
    </label>
  );
}

function GoogleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#EA4335" d="M12 11v3.2h5.4c-.2 1.4-1.6 4.2-5.4 4.2-3.3 0-6-2.7-6-6s2.7-6 6-6c1.9 0 3.1.8 3.8 1.5L17.9 5C16.4 3.6 14.4 2.8 12 2.8 6.9 2.8 2.8 6.9 2.8 12S6.9 21.2 12 21.2c6.9 0 9.2-4.9 9.2-7.4 0-.5 0-.9-.1-1.3H12z" />
    </svg>
  );
}
