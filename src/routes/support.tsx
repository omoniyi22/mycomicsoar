// app/routes/support.tsx

import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  Mail,
  MessageSquare,
  HelpCircle,
  BookOpen,
  Settings,
  Smartphone,
  Monitor,
  Music,
  ZoomIn,
  Maximize,
  Download,
  RotateCcw,
  PanelLeft,
  ArrowLeft,
  ArrowRight,
  LayoutTemplate,
  Loader2,
  PointerIcon,
} from "lucide-react";
import { SiteHeader, SiteFooter } from "@/components/site-chrome";
// routes/support.tsx – updated ContactSection

import { useServerFn } from "@tanstack/react-start";
import { sendContactMessage } from "@/lib/contact.functions";

// Define the search params schema
type SupportSearch = {
  tab?: "faq" | "reader" | "contact";
};

export const Route = createFileRoute("/support")({
  validateSearch: (search: Record<string, unknown>): SupportSearch => {
    const tab = search.tab;
    if (tab === "faq" || tab === "reader" || tab === "contact") {
      return { tab };
    }
    return { tab: "faq" }; // default
  },
  head: () => ({
    meta: [
      { title: "Support — Comicsoar" },
      {
        name: "description",
        content: "Help, FAQs, and support for your Comicsoar reading experience.",
      },
    ],
  }),
  component: SupportPage,
});

type Tab = "faq" | "reader" | "contact";

function SupportPage() {
  const search = useSearch({ from: Route.id });
  const navigate = useNavigate();

  // Derive active tab from search, fallback to "faq"
  const activeTab = search.tab ?? "faq";

  const handleTabClick = (tab: Tab) => {
    navigate({
      to: "/support",
      search: { tab },
      replace: true, // optional: replace history entry
    });
  };

  return (
    <div className="min-h-screen bg-vignette">
      <SiteHeader />

      <main className="container-tight mx-auto px-4 py-16 md:py-24">
        <div className="text-center max-w-3xl mx-auto mb-12">
          <h1 className="font-display text-4xl md:text-5xl text-foreground">
            How can we help?
          </h1>
          <p className="mt-3 text-muted-foreground text-lg">
            Find answers to common questions, learn about the reader, or get in touch.
          </p>
        </div>

        {/* Tabs */}
        <div className="flex justify-center gap-2 border-b border-border/60 pb-4 mb-10 max-w-2xl mx-auto">
          {[
            { id: "faq", label: "FAQ", icon: HelpCircle },
            { id: "reader", label: "Reader Guide", icon: BookOpen },
            { id: "contact", label: "Contact", icon: Mail },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => handleTabClick(tab.id as Tab)}
              className={`inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium rounded-md transition-all ${
                activeTab === tab.id
                  ? "bg-gold text-primary-foreground shadow-glow"
                  : "text-muted-foreground hover:text-foreground hover:bg-gold/10"
              }`}
            >
              <tab.icon className="h-4 w-4" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="max-w-3xl mx-auto">
          {activeTab === "faq" && <FaqSection />}
          {activeTab === "reader" && <ReaderGuide />}
          {activeTab === "contact" && <ContactSection />}
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}

// ─── FAQ ────────────────────────────────────────────────
function FaqSection() {
  const faqs = [
    {
      q: "What is Comicsoar?",
      a: "Comicsoar is a 100% digital comic e‑book store. You can buy single issues, hardcovers, manga, and indie originals and read them instantly in your browser or download the PDF to keep forever.",
    },
    {
      q: "How do I read a comic I purchased?",
      a: "Go to your library, click on any issue, and it will open in our full‑screen reader. You can navigate with arrow keys, tap the screen, or use on‑screen buttons. See the Reader Guide tab for all the features.",
    },
    {
      q: "What file formats are available?",
      a: "We provide high‑quality images for reading online, and you can download the full issue as a PDF (portrait and landscape versions are often available).",
    },
    {
      q: "Can I read offline?",
      a: "Yes! Once you download the PDF, you can read it anywhere, even without an internet connection.",
    },
    {
      q: "How do subscriptions work?",
      a: "You can subscribe to ongoing series and we’ll automatically add new issues to your library as they release. You can also join the Pull List Club for curated monthly drops.",
    },
    {
      q: "Is there a mobile app?",
      a: "We don’t have a native app yet, but our website is fully responsive and works great on phones and tablets. You can also install it as a PWA for an app‑like experience.",
    },
    {
      q: "What payment methods do you accept?",
      a: "We accept all major credit cards, PayPal, and Apple Pay. All transactions are secure.",
    },
    {
      q: "Can I get a refund?",
      a: "If you haven’t downloaded the PDF, you can request a refund within 7 days of purchase. Contact us via the Contact tab.",
    },
  ];

  const [open, setOpen] = useState<number | null>(null);

  return (
    <div className="space-y-2">
      {faqs.map((faq, i) => {
        const isOpen = open === i;
        return (
          <div
            key={i}
            className="rounded-lg border border-border bg-card/50 overflow-hidden transition-all"
          >
            <button
              onClick={() => setOpen(isOpen ? null : i)}
              className="flex items-center justify-between w-full px-6 py-4 text-left hover:bg-gold/5 transition-colors"
            >
              <span className="font-medium text-foreground">{faq.q}</span>
              {isOpen ? (
                <ChevronUp className="h-5 w-5 text-gold flex-shrink-0" />
              ) : (
                <ChevronDown className="h-5 w-5 text-muted-foreground flex-shrink-0" />
              )}
            </button>
            {isOpen && (
              <div className="px-6 pb-5 text-muted-foreground text-sm leading-relaxed border-t border-border/40 pt-3">
                {faq.a}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── READER GUIDE ──────────────────────────────────────
function ReaderGuide() {
  const features = [
      {
          icon: <ZoomIn className="h-5 w-5" />,
          title: "Zoom & View",
          desc: "Use the zoom buttons in the top bar or your keyboard. The page remains centered and pans with touch/mouse. Zoom resets to fit the screen.",
        },
    {
      icon: <Maximize className="h-5 w-5" />,
      title: "Fullscreen & Auto‑Hide",
      desc: "Click the fullscreen icon or press F. In fullscreen, the chrome (top/bottom bars) auto‑hides after 2.2 seconds; move your mouse or tap to reveal it again.",
    },
    {
        icon: <PanelLeft className="h-5 w-5" />,
      title: "Thumbnail Navigator",
      desc: "On desktop, click the pages icon (left sidebar) to open a thumbnail strip. On mobile, the same icon opens a drawer. Click any thumbnail to jump to that page.",
    },
    {
      icon: <Download className="h-5 w-5" />,
      title: "Download PDF",
      desc: "Click the download button in the top bar to get a PDF of the issue. If both portrait and landscape versions are available, you can choose which one to download.",
    },
    {
        icon: <Settings className="h-5 w-5" />,
        title: "Settings Panel",
        desc: "The gear icon opens a panel where you can change transitions, tap mode, and manage your soundtrack. Click outside the panel or the X to close it.",
    },
    {
        icon: <Music className="h-5 w-5" />,
        title: "Soundtrack & Personal Audio",
        desc: "You can upload your own MP3 files to play while reading. The reader remembers your volume and mute state. Tracks are saved to your account and appear in the Settings panel.",
    },
    {
      icon: <LayoutTemplate className="h-5 w-5" />,
      title: "Page Transitions",
      desc: "Choose from five animations when turning pages: Slide, Page Flip, Jitter, Light (flash), or Shake. Go to Settings (gear icon) to pick your favorite.",
    },
    {
      icon: <PointerIcon className="h-5 w-5" />,
      title: "Tap Controls",
      desc: 'In Settings, you can set tap behavior to "Halves" (tap left = previous, right = next) or "Anywhere" (tap = next). Works only when zoom is at 100%.',
    },
    {
      icon: <ArrowLeft className="h-5 w-5" />,
      title: "Keyboard & Navigation",
      desc: "Use Arrow Left/Right or Space to turn pages. Plus (+) and Minus (-) zoom in/out, 0 resets zoom, and F toggles fullscreen. Esc exits fullscreen or goes back to your library.",
    },
    {
      icon: <Smartphone className="h-5 w-5" />,
      title: "Responsive & Orientation",
      desc: "The reader automatically selects the best image version for your screen: portrait for mobile/tablet, landscape for desktop. If a variant is missing, it falls back to the other.",
    },
  ];

  return (
    <div className="space-y-8">
      <div className="prose prose-invert max-w-none">
        <h2 className="font-display text-2xl text-foreground">Using the Reader</h2>
        <p className="text-muted-foreground text-sm">
          The Comicsoar reader is designed to give you the best digital reading experience.
          Here’s a quick tour of all its features.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {features.map((f, i) => (
          <div
            key={i}
            className="flex gap-3 rounded-lg border border-border bg-card/40 p-4 hover:border-gold/30 transition-colors"
          >
            <div className="text-gold flex-shrink-0 mt-0.5">{f.icon}</div>
            <div>
              <h3 className="font-semibold text-foreground text-sm">{f.title}</h3>
              <p className="text-muted-foreground text-xs leading-relaxed mt-0.5">{f.desc}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 rounded-lg border border-gold/20 bg-gold/5 p-6 text-center">
        <p className="text-sm text-muted-foreground">
          <span className="text-gold">💡 Tip:</span> You can open the reader settings
          at any time by clicking the gear icon. Experiment with different transitions
          and tap modes to find what feels best for you.
        </p>
      </div>
    </div>
  );
}

function ContactSection() {
  const sendFn = useServerFn(sendContactMessage);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    subject: "",
    message: "",
  });
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData((prev) => ({ ...prev, [e.target.id]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("loading");
    setErrorMsg("");

    try {
      await sendFn({ data: formData });
      setStatus("success");
      setFormData({ name: "", email: "", subject: "", message: "" });
    } catch (err) {
      setStatus("error");
      setErrorMsg(err instanceof Error ? err.message : "Failed to send");
    }
  };

  if (status === "success") {
    return (
      <div className="space-y-6">
        <div className="rounded-lg border border-gold/30 bg-gold/10 p-6 text-center">
          <MessageSquare className="h-8 w-8 text-gold mx-auto" />
          <h3 className="mt-3 font-display text-xl text-foreground">Message sent!</h3>
          <p className="text-muted-foreground text-sm mt-1">
            Thanks for reaching out. We’ll respond as soon as possible.
          </p>
          <button
            onClick={() => setStatus("idle")}
            className="mt-4 text-gold text-sm hover:underline"
          >
            Send another message
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="prose prose-invert max-w-none">
        <h2 className="font-display text-2xl text-foreground">Get in touch</h2>
        <p className="text-muted-foreground text-sm">
          Have a question, feedback, or need help with an order? Fill out the form below
          and we’ll get back to you within 24 hours.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-foreground/80">
            Your name
          </label>
          <input
            type="text"
            id="name"
            required
            value={formData.name}
            onChange={handleChange}
            className="mt-1 w-full rounded-md border border-border bg-card px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-gold-soft focus:outline-none focus:ring-2 ring-gold"
            placeholder="Jane Doe"
            disabled={status === "loading"}
          />
        </div>
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-foreground/80">
            Email address
          </label>
          <input
            type="email"
            id="email"
            required
            value={formData.email}
            onChange={handleChange}
            className="mt-1 w-full rounded-md border border-border bg-card px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-gold-soft focus:outline-none focus:ring-2 ring-gold"
            placeholder="you@example.com"
            disabled={status === "loading"}
          />
        </div>
        <div>
          <label htmlFor="subject" className="block text-sm font-medium text-foreground/80">
            Subject
          </label>
          <input
            type="text"
            id="subject"
            required
            value={formData.subject}
            onChange={handleChange}
            className="mt-1 w-full rounded-md border border-border bg-card px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-gold-soft focus:outline-none focus:ring-2 ring-gold"
            placeholder="Issue with my order"
            disabled={status === "loading"}
          />
        </div>
        <div>
          <label htmlFor="message" className="block text-sm font-medium text-foreground/80">
            Message
          </label>
          <textarea
            id="message"
            rows={5}
            required
            value={formData.message}
            onChange={handleChange}
            className="mt-1 w-full rounded-md border border-border bg-card px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-gold-soft focus:outline-none focus:ring-2 ring-gold resize-none"
            placeholder="Describe your issue or question in detail..."
            disabled={status === "loading"}
          />
        </div>
        <button
          type="submit"
          disabled={status === "loading"}
          className="inline-flex items-center gap-2 rounded-md bg-gold px-6 py-3 text-sm font-semibold text-primary-foreground shadow-glow hover:scale-[1.02] transition-transform disabled:opacity-60"
        >
          {status === "loading" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
          {status === "loading" ? "Sending..." : "Send message"}
        </button>
        {status === "error" && (
          <p className="text-sm text-red-400 mt-2">{errorMsg}</p>
        )}
      </form>
    </div>
  );
}
