import { useI18n } from "../lib/i18n";
import React, { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ChartNoAxesCombined, ChevronDown, Leaf, QrCode } from "lucide-react";
import { Button } from "./ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "./ui/accordion";
import { useAuth } from "./AuthProvider";
import { trackEvent } from "../lib/analytics";
import { CookiePreferencesBanner } from "./CookiePreferencesBanner";

// ── Hooks ─────────────────────────────────────────────────────────────────────

const useScrollY = () => {
  const [y, setY] = useState(0);
  useEffect(() => {
    let raf = 0;
    const h = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => setY(window.scrollY));
    };
    window.addEventListener("scroll", h, { passive: true });
    return () => { window.removeEventListener("scroll", h); cancelAnimationFrame(raf); };
  }, []);
  return y;
};

function useInView(threshold = 0.12) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) setVisible(true); },
      { threshold }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);
  return { ref, visible };
}

// Smooth spring-eased fade + slide animation helper
const rise = (on: boolean, delay = 0) => ({
  opacity: on ? 1 : 0,
  transform: on ? "translateY(0px)" : "translateY(40px)",
  transition: `opacity 1s cubic-bezier(0.16,1,0.3,1) ${delay}ms, transform 1s cubic-bezier(0.16,1,0.3,1) ${delay}ms`,
});

// ── Mockup: iPhone with loyalty card ─────────────────────────────────────────
const PhoneMockup: React.FC = () => {
  const { t } = useI18n();
  return (
  <div className="relative mx-auto w-full max-w-[320px] select-none drop-shadow-[0_40px_80px_rgba(0,0,0,0.22)]">
    <div className="relative rounded-[3rem] border-[8px] border-[#1d1d1f] bg-[#1d1d1f]">
      <div className="absolute left-1/2 top-3 z-10 h-[22px] w-[100px] -translate-x-1/2 rounded-full bg-[#1d1d1f]" />
      <div className="overflow-hidden rounded-[2.4rem] bg-[#f5f5f7]">
        <div className="flex items-center justify-between px-6 pt-4 pb-1">
          <span className="text-[11px] font-semibold text-[#1d1d1f]">{"9:41"}</span>
          <div className="flex items-center gap-1.5">
            <svg width="15" height="11" viewBox="0 0 15 11" fill="none">
              <rect x="0" y="7" width="3" height="4" rx="0.6" fill="#1d1d1f" fillOpacity="0.5"/>
              <rect x="4.5" y="4.5" width="3" height="6.5" rx="0.6" fill="#1d1d1f" fillOpacity="0.5"/>
              <rect x="9" y="2" width="3" height="9" rx="0.6" fill="#1d1d1f" fillOpacity="0.85"/>
              <rect x="13.5" y="0" width="1.5" height="11" rx="0.4" fill="#1d1d1f" fillOpacity="0.2"/>
            </svg>
            <div className="flex h-3 w-6 items-center rounded-[3px] border border-[#1d1d1f]/50 p-[2px]">
              <div className="h-full w-[70%] rounded-[1px] bg-[#1d1d1f]/80" />
              <div className="ml-[1px] h-[5px] w-[2px] rounded-r-[1px] bg-[#1d1d1f]/30" />
            </div>
          </div>
        </div>
        <div className="mx-3 mt-2 overflow-hidden rounded-2xl shadow-lg">
          <div className="bg-gradient-to-br from-amber-400 via-orange-400 to-rose-500 p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[8px] font-bold uppercase tracking-[0.18em] text-white/60">{t("LOYALTY CARD")}</p>
                <p className="mt-0.5 text-[15px] font-bold leading-tight text-white">{"The Daily Brew"}</p>
              </div>
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/25">
                <div className="h-5 w-5 rounded-full bg-white/70" />
              </div>
            </div>
            <div className="mt-5 grid grid-cols-5 gap-2">
              {Array.from({ length: 10 }).map((_, i) => (
                <div key={i} className={`aspect-square rounded-full border-[1.5px] flex items-center justify-center ${i < 7 ? "border-white bg-white" : "border-white/40 bg-white/10"}`}>
                  {i < 7 && <div className="h-2 w-2 rounded-full bg-orange-400/80" />}
                </div>
              ))}
            </div>
            <div className="mt-4 flex items-center justify-between">
              <p className="text-[9px] font-semibold text-white/80">{t("7 / 10 stamps")}</p>
              <p className="text-[9px] font-semibold text-white/80">{t("3 to go ✦")}</p>
            </div>
          </div>
        </div>
        <div className="mx-3 mt-2 flex items-center justify-between rounded-xl bg-white px-4 py-3 shadow-sm">
          <div>
            <p className="text-[10px] font-semibold text-[#1d1d1f]">{t("Scan to stamp")}</p>
            <p className="text-[8px] text-[#6e6e73]">{t("Show this to staff")}</p>
          </div>
          <div className="h-8 w-8 rounded-lg bg-[#f5f5f7] flex items-center justify-center">
            <div className="grid grid-cols-3 gap-[2px]">
              {Array.from({ length: 9 }).map((_, i) => (
                <div key={i} className={`h-[3.5px] w-[3.5px] rounded-[0.5px] bg-[#1d1d1f] ${i === 4 ? "opacity-0" : ""}`} />
              ))}
            </div>
          </div>
        </div>
        <div className="mx-3 mt-2 mb-5 rounded-xl border border-black/[0.06] bg-white px-4 py-3">
          <p className="text-[8px] font-bold uppercase tracking-widest text-[#6e6e73]">{t("Recent Stamps")}</p>
          <div className="mt-2 space-y-1.5">
            {[{ l: "+1 stamp", t: "Today, 10:24 AM" }, { l: "+1 stamp", t: "Yesterday, 3:15 PM" }, { l: "+1 stamp", t: "Feb 22, 9:00 AM" }].map(item => (
              <div key={item.t} className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <div className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                  <p className="text-[8px] font-medium text-[#1d1d1f]">{t(item.l)}</p>
                </div>
                <p className="text-[7px] text-[#6e6e73]">{t(item.t)}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  </div>
  );
};

// ── Mockup: Analytics dashboard ───────────────────────────────────────────────
const AnalyticsMockup: React.FC = () => {
  const { t } = useI18n();
  return (
  <div className="select-none overflow-hidden rounded-2xl border border-black/[0.08] shadow-[0_24px_72px_-12px_rgba(0,0,0,0.14)]">
    <div className="flex items-center gap-1.5 border-b border-black/[0.06] bg-[#e4e4e4] px-4 py-2.5">
      <div className="h-3 w-3 rounded-full bg-[#ff5f57]" />
      <div className="h-3 w-3 rounded-full bg-[#febc2e]" />
      <div className="h-3 w-3 rounded-full bg-[#28c840]" />
      <div className="ml-3 flex-1 rounded-md bg-white/80 px-3 py-1">
        <p className="text-[9px] text-[#6e6e73]">{"app.stampee.co/analytics"}</p>
      </div>
    </div>
    <div className="flex bg-[#f8f8f8]">
      <div className="flex w-10 flex-col items-center gap-3 border-r border-black/[0.06] bg-white py-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className={`h-5 w-5 rounded-lg ${i === 2 ? "bg-[#1d1d1f]" : "bg-[#1d1d1f]/10"}`} />
        ))}
      </div>
      <div className="flex-1 p-4">
        <p className="text-sm font-semibold text-[#1d1d1f]">{t("Analytics")}</p>
        <p className="text-[9px] text-[#6e6e73]">{t("Feb 12 – Feb 25 · 14 days")}</p>
        <div className="mt-3 grid grid-cols-3 gap-2">
          {[{ l: "Customers", v: "142" }, { l: "Active Cards", v: "89" }, { l: "Redemption", v: "68%" }].map(s => (
            <div key={s.l} className="rounded-xl border border-black/[0.06] bg-white px-3 py-2.5 shadow-sm">
              <p className="text-[8px] text-[#6e6e73]">{t(s.l)}</p>
              <p className="mt-0.5 text-base font-semibold text-[#1d1d1f]">{s.v}</p>
            </div>
          ))}
        </div>
        <div className="mt-3 overflow-hidden rounded-xl border border-black/[0.06] bg-white p-3 shadow-sm">
          <p className="text-[9px] font-semibold text-[#1d1d1f]">{t("Activity Over Time")}</p>
          <div className="mt-2 flex h-20 items-end gap-[3px]">
            {[28,45,22,60,38,75,52,65,42,80,58,90,70,85].map((h, i) => (
              <div key={i} className="flex-1 rounded-t-[2px]" style={{ height: `${h}%`, background: i === 13 ? "#1d1d1f" : `rgba(29,29,31,${0.07 + (h/100)*0.18})` }} />
            ))}
          </div>
          <div className="mt-1.5 flex justify-between text-[8px] text-[#6e6e73]">
            <span>{t("Feb 12")}</span><span>{t("Feb 25")}</span>
          </div>
        </div>
        <div className="mt-2 overflow-hidden rounded-xl border border-black/[0.06] bg-white p-3 shadow-sm">
          <p className="text-[9px] font-semibold text-[#1d1d1f]">{t("Campaign Performance")}</p>
          <div className="mt-2 space-y-2.5">
            {[{ n: "Summer Treats", p: 68 }, { n: "Morning Rush", p: 42 }].map(c => (
              <div key={c.n}>
                <div className="flex justify-between text-[9px]">
                  <span className="text-[#1d1d1f]/70">{c.n}</span>
                  <span className="font-semibold text-[#1d1d1f]">{c.p}%</span>
                </div>
                <div className="mt-1 h-[5px] overflow-hidden rounded-full bg-[#1d1d1f]/[0.07]">
                  <div className="h-full rounded-full bg-[#1d1d1f]/60" style={{ width: `${c.p}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  </div>
  );
};

// ── Mockup: Customers directory ───────────────────────────────────────────────
const CustomersMockup: React.FC = () => {
  const { t } = useI18n();
  const rows = [
    { i: "ES", n: "Emma S.", e: "emma@example.com", c: 3, col: "bg-blue-100 text-blue-600" },
    { i: "LW", n: "Liam W.", e: "liam@example.com", c: 1, col: "bg-emerald-100 text-emerald-600" },
    { i: "AM", n: "Ava M.", e: "ava@example.com", c: 2, col: "bg-violet-100 text-violet-600" },
    { i: "NT", n: "Noah T.", e: "noah@example.com", c: 1, col: "bg-amber-100 text-amber-600" },
    { i: "SL", n: "Sophia L.", e: "sophia@example.com", c: 2, col: "bg-rose-100 text-rose-600" },
  ];
  return (
    <div className="select-none overflow-hidden rounded-2xl border border-black/[0.08] shadow-[0_24px_72px_-12px_rgba(0,0,0,0.14)]">
      <div className="flex items-center gap-1.5 border-b border-black/[0.06] bg-[#e4e4e4] px-4 py-2.5">
        <div className="h-3 w-3 rounded-full bg-[#ff5f57]" />
        <div className="h-3 w-3 rounded-full bg-[#febc2e]" />
        <div className="h-3 w-3 rounded-full bg-[#28c840]" />
        <div className="ml-3 flex-1 rounded-md bg-white/80 px-3 py-1">
          <p className="text-[9px] text-[#6e6e73]">{"app.stampee.co/customers"}</p>
        </div>
      </div>
      <div className="flex bg-[#f8f8f8]">
        <div className="flex w-10 flex-col items-center gap-3 border-r border-black/[0.06] bg-white py-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className={`h-5 w-5 rounded-lg ${i === 3 ? "bg-[#1d1d1f]" : "bg-[#1d1d1f]/10"}`} />
          ))}
        </div>
        <div className="flex-1 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-[#1d1d1f]">{t("Customers")}</p>
              <p className="text-[9px] text-[#6e6e73]">{t("142 contacts")}</p>
            </div>
            <div className="rounded-full bg-[#1d1d1f] px-3 py-1">
              <p className="text-[9px] font-semibold text-white">{t("+ Add")}</p>
            </div>
          </div>
          <div className="mt-2.5 flex items-center gap-2 rounded-lg border border-black/[0.06] bg-white px-2.5 py-2 shadow-sm">
            <div className="h-3 w-3 rounded-full border-[1.5px] border-[#6e6e73]/40" />
            <p className="text-[9px] text-[#6e6e73]/60">{t("Search customers...")}</p>
          </div>
          <div className="mt-2.5 overflow-hidden rounded-xl border border-black/[0.06] bg-white shadow-sm">
            <div className="grid grid-cols-[1fr_1.8fr_0.4fr] border-b border-black/[0.05] bg-[#f5f5f7] px-3 py-2 text-[8px] font-semibold uppercase tracking-widest text-[#6e6e73]">
              <span>{t("Name")}</span><span>{t("Contact")}</span><span className="text-right">{t("Cards")}</span>
            </div>
            {rows.map((row, i) => (
              <div key={row.n} className={`grid grid-cols-[1fr_1.8fr_0.4fr] items-center px-3 py-2 ${i < rows.length - 1 ? "border-b border-black/[0.04]" : ""}`}>
                <div className="flex items-center gap-1.5">
                  <div className={`flex h-6 w-6 items-center justify-center rounded-full text-[7px] font-bold ${row.col}`}>{row.i}</div>
                  <span className="text-[9px] font-medium text-[#1d1d1f]">{row.n}</span>
                </div>
                <span className="text-[8px] text-[#6e6e73]">{row.e}</span>
                <span className="text-right text-[9px] font-semibold text-[#1d1d1f]">{row.c}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

// ── Label badge ───────────────────────────────────────────────────────────────
const SectionLabel: React.FC<{ children: React.ReactNode; light?: boolean }> = ({ children, light }) => (
  <p className={`text-[0.72rem] font-semibold uppercase tracking-[0.26em] ${light ? "text-white/40" : "text-[#6e6e73]"}`}>
    {children}
  </p>
);

// ── Landing Page ──────────────────────────────────────────────────────────────
export const LandingPage: React.FC = () => {
  const { t, locale } = useI18n();
  const { currentUser, isStaff } = useAuth();
  const scrollY = useScrollY();
  const dashboardPath = isStaff ? "/issued-cards" : "/dashboard";

  const hero       = useInView(0.05);
  const simplicity = useInView(0.18);
  const design     = useInView(0.15);
  const intel      = useInView(0.15);
  const value      = useInView(0.15);
  const faq        = useInView(0.15);
  const cta        = useInView(0.18);

  useEffect(() => {
    trackEvent("Landing Viewed");
  }, []);

  return (
    <div className="text-[#1d1d1f] antialiased">

      {/* Keyframe animations */}
      <style>{`
        @keyframes blob-drift-a { 0%,100%{transform:translateY(0px) scale(1)} 55%{transform:translateY(-28px) scale(1.03)} }
        @keyframes blob-drift-b { 0%,100%{transform:translateY(0px) scale(1)} 50%{transform:translateY(22px) scale(0.97)} }
        @keyframes blob-drift-c { 0%,100%{transform:translateY(0px)} 60%{transform:translateY(-18px)} }
        @keyframes scroll-pulse { 0%,100%{opacity:0.6;transform:translateY(0)} 50%{opacity:1;transform:translateY(6px)} }
        @keyframes frame-float { 0%,100%{transform:translate3d(0,0,0)} 50%{transform:translate3d(0,-10px,0)} }
        @keyframes glow-breathe { 0%,100%{box-shadow:0 22px 46px -28px rgba(0,0,0,0.28)} 50%{box-shadow:0 28px 64px -24px rgba(0,0,0,0.38)} }
        @keyframes sheen-pass { 0%,100%{transform:translateX(-160%) skewX(-18deg);opacity:0} 12%,30%{opacity:0.42} 45%{transform:translateX(240%) skewX(-18deg);opacity:0} }
        @keyframes chip-bob { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-3px)} }
        @keyframes spotlight-pulse { 0%,100%{opacity:0.26;transform:scale(0.96)} 50%{opacity:0.46;transform:scale(1.04)} }
        .drift-a { animation: blob-drift-a 10s ease-in-out infinite; }
        .drift-b { animation: blob-drift-b 13s ease-in-out infinite 2s; }
        .drift-c { animation: blob-drift-c 9s ease-in-out infinite 4s; }
        .scroll-cue { animation: scroll-pulse 2.2s ease-in-out infinite; }
        .section-chip { animation: chip-bob 5.4s ease-in-out infinite; transform-origin: center; }
        .glow-button { animation: glow-breathe 4.8s ease-in-out infinite; will-change: box-shadow; }
        .panel-float { animation: frame-float 7.8s ease-in-out infinite; will-change: transform; }
        .panel-float-slow { animation-duration: 10.8s; }
        .media-shell { position: relative; isolation: isolate; }
        .media-shell::before {
          content: "";
          position: absolute;
          inset: auto 10% -8% 10%;
          height: 24%;
          border-radius: 999px;
          background: radial-gradient(circle, rgba(255,255,255,0.34) 0%, rgba(255,255,255,0) 72%);
          filter: blur(26px);
          z-index: -1;
          animation: spotlight-pulse 7s ease-in-out infinite;
        }
        .media-shell::after {
          content: "";
          position: absolute;
          top: -20%;
          bottom: -20%;
          left: -32%;
          width: 24%;
          background: linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.08) 35%, rgba(255,255,255,0.58) 50%, rgba(255,255,255,0.08) 65%, transparent 100%);
          transform: translateX(-160%) skewX(-18deg);
          pointer-events: none;
          mix-blend-mode: screen;
          animation: sheen-pass 8.8s ease-in-out infinite;
        }
        .hover-card {
          transition: transform 320ms cubic-bezier(0.16,1,0.3,1), box-shadow 320ms cubic-bezier(0.16,1,0.3,1);
        }
        .hover-card:hover {
          transform: translateY(-8px);
          box-shadow: 0 30px 60px -34px rgba(0,0,0,0.28);
        }
        .faq-card {
          transition: transform 260ms cubic-bezier(0.16,1,0.3,1), background-color 260ms cubic-bezier(0.16,1,0.3,1);
        }
        .faq-card:hover { transform: translateX(6px); }
        @media (prefers-reduced-motion: reduce) {
          .drift-a, .drift-b, .drift-c, .scroll-cue, .section-chip, .glow-button, .panel-float, .panel-float-slow, .media-shell::before, .media-shell::after {
            animation: none !important;
          }
          .hover-card, .faq-card { transition: none !important; }
          .hover-card:hover, .faq-card:hover { transform: none !important; }
        }
      `}</style>

      {/* ── Sticky Nav ── */}
      <header className="fixed top-0 z-50 w-full border-b border-black/[0.06] bg-white/75 backdrop-blur-2xl">
        <div className="mx-auto flex max-w-[88rem] items-center justify-between px-4 py-4 sm:px-6">
          <Link to="/" className="inline-flex items-center">
            <img src="/stampee.svg" alt={"Stampee"} className="h-8 w-auto" />
          </Link>
          <nav className="flex items-center gap-1.5 sm:gap-2">
            <Button asChild variant="ghost" className="hidden rounded-full text-sm font-medium text-[#1d1d1f] hover:bg-black/[0.06] sm:inline-flex">
              <Link to="/showcase">{t("Demos")}</Link>
            </Button>
            <Button asChild variant="ghost" className="hidden rounded-full text-sm font-medium text-[#1d1d1f] hover:bg-black/[0.06] sm:inline-flex">
              <Link to="/articles">{t("Articles")}</Link>
            </Button>
            {currentUser ? (
              <Button asChild className="rounded-full bg-[#1d1d1f] px-4 text-sm font-medium text-white hover:bg-black/80 sm:px-5">
                <Link to={dashboardPath}>{t("Go to Dashboard")}</Link>
              </Button>
            ) : (
              <>
                <Button asChild variant="ghost" className="hidden rounded-full text-sm font-medium text-[#1d1d1f] hover:bg-black/[0.06] sm:inline-flex">
                  <Link to="/login">{t("Log in")}</Link>
                </Button>
                <Button asChild className="rounded-full bg-[#1d1d1f] px-4 text-sm font-medium text-white hover:bg-black/80 sm:px-5">
                  <Link to="/signup" onClick={() => trackEvent("Landing CTA Clicked", { placement: "header" })}>{t("Get started")}</Link>
                </Button>
              </>
            )}
          </nav>
        </div>
      </header>

      {/* ─────────────────────────────────────────────────────────────────────── */}
      {/* SECTION 1 · HERO                                                       */}
      {/* ─────────────────────────────────────────────────────────────────────── */}
      <section className="relative min-h-[100svh] overflow-hidden bg-[#d3eb22]">
        <div className="pointer-events-none absolute inset-0">
          <div
            className="drift-a absolute left-[-8%] top-[10%] h-[460px] w-[460px] rounded-full bg-[#f4ff9a]/70 blur-[120px]"
            style={{ transform: `translateY(${scrollY * 0.14}px)` }}
          />
          <div
            className="drift-b absolute right-[-10%] bottom-[-5%] h-[520px] w-[520px] rounded-full bg-[#94b90d]/25 blur-[130px]"
            style={{ transform: `translateY(${scrollY * -0.08}px)` }}
          />
          <div className="drift-c absolute left-[46%] top-[22%] h-[280px] w-[280px] rounded-full bg-white/20 blur-[90px]" />
        </div>

        <div ref={hero.ref} className="relative mx-auto grid min-h-[100svh] max-w-[96rem] grid-cols-1 items-center gap-14 px-6 pb-16 pt-28 sm:px-8 lg:grid-cols-[minmax(0,1fr)_minmax(390px,0.94fr)] lg:gap-16 lg:px-10 lg:pb-20 xl:gap-20">
          <div className="max-w-[42rem]">
            <div style={rise(hero.visible, 0)}>
              <span className="section-chip mb-7 inline-flex items-center rounded-full border border-[#17351a]/10 bg-white/35 px-5 py-2 text-[0.72rem] font-semibold uppercase tracking-[0.24em] text-[#284b1f] backdrop-blur-sm">
                {t("Digital Loyalty Platform")}
              </span>
            </div>
            <h1
              style={rise(hero.visible, 70)}
              className="max-w-[11ch] text-[clamp(3rem,6.2vw,5.8rem)] font-black leading-[0.92] tracking-[-0.05em] text-[#17351a]"
            >
              {t("Loyalty beautifully built for repeat visits.")}
            </h1>
            <div style={rise(hero.visible, 170)} className="mt-8 max-w-[38rem] space-y-4">
              <p className="text-[clamp(1.08rem,1.65vw,1.48rem)] leading-[1.45] text-[#23461d]/82">
                {t("Stampee is the modern, no-app loyalty system that turns one-time visitors into loyal customers — simple, smart, and instantly rewarding.")}
              </p>
              <p className="text-sm leading-7 text-[#23461d]/78 sm:text-base">
                {t("Launch a digital loyalty card with Stampee and run a loyalty program for cafes, loyalty program for spa, loyalty program for laundry, loyalty program for carwash, and loyalty program for salons.")}
              </p>
            </div>
            <div style={rise(hero.visible, 260)} className="mt-10 flex flex-col gap-4 sm:flex-row sm:flex-wrap">
              <Button asChild className="glow-button h-16 rounded-[1.55rem] bg-[#17351a] px-10 text-lg font-semibold text-white shadow-[0_26px_50px_-28px_rgba(23,53,26,0.85)] hover:bg-[#102712] sm:min-w-[17rem]">
                <Link to="/signup" onClick={() => trackEvent("Landing CTA Clicked", { placement: "hero" })}>{t("Get Started for free")}</Link>
              </Button>
              <Button asChild variant="outline" className="h-16 rounded-[1.55rem] border-[#17351a]/16 bg-white/75 px-10 text-lg font-semibold text-[#17351a] shadow-[0_20px_40px_-32px_rgba(23,53,26,0.8)] hover:bg-white hover:text-[#102712] sm:min-w-[14rem]">
                <Link to="/showcase" onClick={() => trackEvent("Landing Demo CTA Clicked", { placement: "hero" })}>{t("View Demo")}</Link>
              </Button>
            </div>
          </div>

          <div
            style={{ ...rise(hero.visible, 100), transform: `translateY(${-scrollY * 0.05}px)` }}
            className="relative flex justify-center lg:justify-end"
          >
            <div className="media-shell panel-float relative w-full max-w-[46rem] overflow-hidden rounded-[2.8rem] shadow-[0_40px_90px_-38px_rgba(23,53,26,0.48)]">
              <div className="relative overflow-hidden rounded-[2.8rem] border border-black/5">
                <img
                  src="/image_3.jpg"
                  alt={t("Cafe owner presenting a digital loyalty card sign")}
                  width={1536}
                  height={1024}
                  loading="eager"
                  decoding="async"
                  fetchPriority="high"
                  sizes="(min-width: 1280px) 736px, (min-width: 1024px) 42vw, 100vw"
                  className="block min-h-[520px] w-full object-cover object-center sm:min-h-[620px]"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/10 via-transparent to-white/10" />
                <p className="absolute bottom-4 left-1/2 z-10 w-full max-w-[26rem] -translate-x-1/2 px-6 text-center font-mono text-xs text-[#0d235f]/75">
                  {t("Built for cafes, salons, and neighborhood brands.")}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div
          className="scroll-cue absolute bottom-8 left-1/2 -translate-x-1/2"
          style={{ opacity: Math.max(0, 1 - scrollY / 120) }}
        >
          <ChevronDown className="h-5 w-5 text-[#17351a]/55" />
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────────────── */}
      {/* SECTION 2 · SIMPLICITY                                                 */}
      {/* ─────────────────────────────────────────────────────────────────────── */}
      <section id="simplicity" className="relative min-h-[100svh] overflow-hidden bg-[#e55d00]">
        <div className="pointer-events-none absolute inset-0">
          <div
            className="drift-a absolute left-[-10%] top-[8%] h-[420px] w-[420px] rounded-full bg-[#ffbb7d]/30 blur-[120px]"
            style={{ transform: `translateY(${scrollY * 0.12}px)` }}
          />
          <div
            className="drift-b absolute right-[-8%] bottom-[2%] h-[520px] w-[520px] rounded-full bg-[#7c2500]/24 blur-[135px]"
            style={{ transform: `translateY(${scrollY * -0.08}px)` }}
          />
          <div className="drift-c absolute left-[50%] top-[26%] h-[260px] w-[260px] rounded-full bg-white/10 blur-[80px]" />
        </div>
        <div ref={simplicity.ref} className="relative mx-auto grid min-h-[100svh] max-w-[92rem] grid-cols-1 items-center gap-14 px-6 py-24 sm:px-8 lg:grid-cols-[minmax(0,0.9fr)_minmax(420px,0.96fr)] lg:gap-14 lg:px-10 xl:gap-16">
          <div className="order-2 max-w-[36rem] lg:order-2 lg:justify-self-center">
            <div style={rise(simplicity.visible, 0)}>
              <span className="section-chip mb-7 inline-flex items-center rounded-full border border-white/20 bg-white/12 px-5 py-2 text-[0.72rem] font-semibold uppercase tracking-[0.24em] text-white/80 backdrop-blur-sm">
                {t("Getting Started")}
              </span>
            </div>
            <h2 style={rise(simplicity.visible, 70)} className="max-w-[9ch] text-[clamp(3rem,6vw,5.9rem)] font-black leading-[0.92] tracking-[-0.05em] text-[#fff3e8]">
              {t("Getting started takes four quick steps.")}
            </h2>
            <p style={rise(simplicity.visible, 160)} className="mt-8 max-w-[35rem] text-[clamp(1.05rem,1.55vw,1.38rem)] leading-[1.5] text-white/82">
              {t("Create your account, build a campaign, share the card, and start stamping. No paper cards and no customer app download.")}
            </p>
            <div style={rise(simplicity.visible, 260)} className="mt-10 flex flex-wrap items-center gap-x-6 gap-y-3 text-sm font-semibold text-white/72">
              <span>{t("Four-step setup")}</span>
              <span>{t("Share by link or QR")}</span>
              <span>{t("Live stamp tracking")}</span>
            </div>
            <p style={rise(simplicity.visible, 340)} className="mt-10 text-lg font-medium text-[#fff3e8]">
              {t("Minimal setup. No paper cards. No customer downloads.")}
            </p>
          </div>

          <div style={rise(simplicity.visible, 100)} className="order-1 relative flex justify-center lg:order-1 lg:justify-self-center">
            <div className="panel-float panel-float-slow relative w-full max-w-[48rem] overflow-hidden rounded-[2.8rem] border border-white/15 bg-[#fff4ea] p-5 shadow-[0_40px_90px_-38px_rgba(84,22,0,0.7)] sm:p-8">
              <div className="absolute inset-0 opacity-60" style={{ backgroundImage: "linear-gradient(180deg, rgba(255,255,255,0.45) 0%, rgba(255,255,255,0) 32%)" }} />
              <div className="relative">
                <div className="mb-6 flex items-center justify-between gap-4">
                  <div>
                    <p className="text-[0.72rem] font-semibold uppercase tracking-[0.22em] text-[#b24a00]">{t("Quick launch")}</p>
                    <p className="mt-2 text-[2rem] font-black tracking-[-0.04em] text-[#301204]">{t("Four simple steps.")}</p>
                  </div>
                  <div className="rounded-full bg-[#e55d00] px-4 py-2 text-sm font-semibold text-white shadow-[0_16px_30px_-18px_rgba(132,38,0,0.65)]">
                    {t("Ready in minutes")}
                  </div>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  {[
                    {
                      step: "Step 1",
                      title: "Create your account",
                      body: "Sign up and add your business details.",
                    },
                    {
                      step: "Step 2",
                      title: "Create campaign",
                      body: "Set the reward, stamp goal, and card design.",
                    },
                    {
                      step: "Step 3",
                      title: "Issue a digital card",
                      body: "Share it by browser link or QR. No app download needed.",
                    },
                    {
                      step: "Step 4",
                      title: "Stamp",
                      body: "Staff stamp visits and progress updates instantly.",
                    },
                  ].map((item, i) => (
                    <div
                      key={item.step}
                      style={rise(simplicity.visible, 200 + i * 90)}
                      className="hover-card rounded-[2rem] border border-[#6d2a00]/8 bg-white/88 p-6 shadow-[0_24px_50px_-36px_rgba(84,22,0,0.45)] backdrop-blur-sm lg:p-7"
                    >
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#ffe1cc] text-sm font-black text-[#9c3f00]">
                        {i + 1}
                      </div>
                      <p className="mt-5 text-[11px] font-semibold uppercase tracking-[0.22em] text-[#c25a12]">{t(item.step)}</p>
                      <h3 className="mt-3 text-[1.65rem] font-semibold leading-[1.05] tracking-tight text-[#301204]">{t(item.title)}</h3>
                      <p className="mt-4 text-[15px] leading-7 text-[#724224]">{t(item.body)}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────────────── */}
      {/* SECTION 3 · DESIGN — Customers mockup                                  */}
      {/* ─────────────────────────────────────────────────────────────────────── */}
      <section className="relative min-h-[100svh] overflow-hidden bg-[#1b46d2]">
        <div className="pointer-events-none absolute inset-0">
          <div
            className="drift-a absolute left-[-8%] top-[12%] h-[440px] w-[440px] rounded-full bg-[#6d90ff]/35 blur-[120px]"
            style={{ transform: `translateY(${scrollY * 0.12}px)` }}
          />
          <div
            className="drift-b absolute right-[-10%] bottom-[4%] h-[520px] w-[520px] rounded-full bg-[#07164f]/34 blur-[140px]"
            style={{ transform: `translateY(${scrollY * -0.08}px)` }}
          />
          <div className="drift-c absolute left-[52%] top-[20%] h-[280px] w-[280px] rounded-full bg-white/10 blur-[90px]" />
        </div>
        <div ref={design.ref} className="relative mx-auto grid min-h-[100svh] max-w-[96rem] grid-cols-1 items-center gap-14 px-6 py-24 sm:px-8 lg:grid-cols-[minmax(0,0.92fr)_minmax(390px,1.08fr)] lg:gap-16 lg:px-10 xl:gap-20">
          <div className="max-w-[38rem]">
            <div style={rise(design.visible, 0)}>
              <span className="section-chip mb-7 inline-flex items-center rounded-full border border-white/20 bg-white/10 px-5 py-2 text-[0.72rem] font-semibold uppercase tracking-[0.24em] text-white/82 backdrop-blur-sm">
                {t("Design")}
              </span>
            </div>
            <h2 style={rise(design.visible, 70)} className="max-w-[9ch] text-[clamp(3rem,6vw,5.9rem)] font-black leading-[0.92] tracking-[-0.05em] text-white">
              {t("Make loyalty feel like part of your brand.")}
            </h2>
            <p style={rise(design.visible, 160)} className="mt-8 max-w-[35rem] text-[clamp(1.05rem,1.55vw,1.38rem)] leading-[1.5] text-white/80">
              {t("Bring your logo, colors, and reward experience into one clean digital card customers instantly recognize.")}
            </p>
            <p style={rise(design.visible, 340)} className="mt-10 text-lg font-medium text-white">
              {t("Simple to launch. Distinctive to customers.")}
            </p>
          </div>
          <div style={rise(design.visible, 100)} className="relative flex justify-center lg:justify-end">
            <div className="media-shell panel-float panel-float-slow w-full max-w-[46rem]">
              <div className="relative overflow-hidden rounded-[2.8rem] shadow-[0_40px_90px_-38px_rgba(7,22,79,0.82)] ring-1 ring-black/8">
                <img
                  src="/image_1.jpg"
                  alt={t("Customer-facing loyalty experience")}
                  width={1536}
                  height={1024}
                  loading="lazy"
                  decoding="async"
                  sizes="(min-width: 1280px) 736px, (min-width: 1024px) 42vw, 100vw"
                  className="block min-h-[520px] w-full object-cover object-center sm:min-h-[620px]"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/12 via-transparent to-white/10" />
                <p className="absolute bottom-6 left-6 rounded-[1.5rem] border border-white/22 bg-[#07164f]/45 px-5 py-4 text-base font-medium leading-[1.35] text-white shadow-[0_18px_45px_-28px_rgba(7,22,79,0.85)] backdrop-blur-md sm:bottom-8 sm:left-8 sm:text-lg">
                  {t("Your logo.")}<br />{t("Your colors.")}<br />{t("Your brand - elevated.")}
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────────────── */}
      {/* SECTION 4 · EXPERIENCE                                                 */}
      {/* ─────────────────────────────────────────────────────────────────────── */}
      {/* ─────────────────────────────────────────────────────────────────────── */}
      {/* SECTION 5 · INTELLIGENCE — Analytics mockup                            */}
      {/* ─────────────────────────────────────────────────────────────────────── */}
      <section className="relative min-h-[100svh] overflow-hidden bg-[#ffe100]">
        <div className="pointer-events-none absolute inset-0">
          <div
            className="drift-a absolute left-[-10%] top-[8%] h-[520px] w-[520px] rounded-full bg-[#fff799]/75 blur-[130px]"
            style={{ transform: `translateY(${scrollY * 0.12}px)` }}
          />
          <div
            className="drift-b absolute right-[-8%] bottom-[-4%] h-[540px] w-[540px] rounded-full bg-[#c4ae00]/20 blur-[140px]"
            style={{ transform: `translateY(${scrollY * -0.08}px)` }}
          />
          <div className="drift-c absolute left-[54%] top-[18%] h-[280px] w-[280px] rounded-full bg-white/20 blur-[90px]" />
        </div>
        <div ref={intel.ref} className="relative mx-auto grid min-h-[100svh] max-w-[98rem] grid-cols-1 items-center gap-14 px-6 pb-16 pt-24 sm:px-8 lg:min-h-0 lg:grid-cols-[minmax(520px,1.12fr)_minmax(0,0.78fr)] lg:gap-16 lg:px-10 lg:pb-20 xl:gap-20">
          <div className="order-2 max-w-[38rem] lg:order-2">
            <div style={rise(intel.visible, 0)}>
              <span className="section-chip mb-7 inline-flex items-center rounded-full border border-[#4d4300]/10 bg-white/35 px-5 py-2 text-[0.72rem] font-semibold uppercase tracking-[0.24em] text-[#5a4f00] backdrop-blur-sm">
                {t("Intelligence")}
              </span>
            </div>
            <h2 style={rise(intel.visible, 70)} className="max-w-[10ch] text-[clamp(3rem,6vw,5.8rem)] font-black leading-[0.92] tracking-[-0.05em] text-[#302900]">
              {t("See what drives repeat visits.")}
            </h2>
            <div style={rise(intel.visible, 170)} className="mt-8 space-y-5">
              {["Real-time trend views.", "Detailed campaign analysis.", "Seamless redemption tracking."].map(l => (
                <p key={l} className="text-[1.18rem] text-[#302900]">{t(l)}</p>
              ))}
              <p className="mt-6 text-lg font-medium text-[#4f4500]">
                {t("The visibility your loyalty program has been waiting for.")}
              </p>
            </div>
          </div>
          <div
            style={rise(intel.visible, 100)}
            className="order-1 relative flex justify-center lg:order-1 lg:justify-center"
          >
            <div className="media-shell panel-float relative w-full max-w-[58rem] overflow-hidden rounded-[2.8rem] shadow-[0_42px_96px_-40px_rgba(76,66,0,0.42)]">
              <div className="relative overflow-hidden rounded-[2.8rem] border border-black/5 bg-white/85">
                <img
                  src="/image_4.jpg"
                  alt={t("Analytics dashboard screenshot with sample loyalty data")}
                  width={1536}
                  height={1024}
                  loading="lazy"
                  decoding="async"
                  sizes="(min-width: 1280px) 928px, (min-width: 1024px) 52vw, 100vw"
                  className="block w-full"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/8 via-transparent to-white/10" />
                <p className="absolute bottom-6 left-6 rounded-[1.5rem] border border-black/10 bg-white/72 px-5 py-4 text-base font-medium leading-[1.35] text-[#473d00] shadow-[0_18px_40px_-28px_rgba(76,66,0,0.3)] backdrop-blur-md sm:bottom-8 sm:left-8 sm:text-lg">
                  {t("Sample data.")}<br />{t("Real analytics view.")}<br />{t("Built for quick decisions.")}
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────────────── */}
      {/* SECTION 6 · TRUST                                                      */}
      {/* ─────────────────────────────────────────────────────────────────────── */}
      {/* ─────────────────────────────────────────────────────────────────────── */}
      {/* SECTION 7 · VALUE                                                      */}
      {/* ─────────────────────────────────────────────────────────────────────── */}
      <section className="relative min-h-[100svh] overflow-hidden bg-[#d9dcc8]">
        <div className="pointer-events-none absolute inset-0">
          <div className="drift-a absolute left-[-6%] top-[14%] h-[320px] w-[320px] rounded-full bg-white/18 blur-[100px]" />
          <div className="drift-b absolute right-[-8%] bottom-[8%] h-[360px] w-[360px] rounded-full bg-[#b9c0a1]/40 blur-[120px]" />
        </div>
        <div ref={value.ref} className="relative mx-auto grid min-h-[100svh] max-w-[92rem] grid-cols-1 items-center gap-16 px-6 py-24 sm:px-8 lg:grid-cols-[1.08fr_0.92fr] lg:gap-20 lg:px-10 xl:gap-24">
          <div style={rise(value.visible, 0)} className="grid gap-6 sm:grid-cols-[1.75fr_1fr]">
            <div className="hover-card rounded-[2.6rem] bg-[#7e8355] p-8 text-[#d8ef24] shadow-[0_28px_80px_-34px_rgba(55,59,34,0.5)] sm:min-h-[290px] lg:p-9">
              <div className="flex h-full flex-col justify-between gap-8">
                <div className="flex w-full items-start justify-between gap-4">
                  <div className="flex h-[4.5rem] w-[4.5rem] items-center justify-center rounded-3xl border-2 border-current/35 bg-white/10">
                    <Leaf className="h-9 w-9" strokeWidth={2.25} />
                  </div>
                  <div className="w-full">
                  <p className="text-right text-6xl font-semibold tracking-tight">100%</p>
                  <p className="mt-3 text-right text-xl font-medium text-[#d8ef24]/80">{t("Paperless loyalty")}</p>
                  </div>
                </div>
                <div className="max-w-[20rem] space-y-1 text-[0.98rem] leading-7 text-[#eef7a5]/80">
                  <p>{t("No more lost cards.")}</p>
                  <p>{t("No more faded ink.")}</p>
                  <p>{t("No more printing.")}</p>
                </div>
              </div>
            </div>

            <div className="hover-card rounded-[2.6rem] bg-[#d6b3d9] p-8 text-[#142692] shadow-[0_24px_64px_-32px_rgba(71,38,77,0.45)] sm:min-h-[290px] lg:p-9">
              <div className="flex h-full flex-col items-start justify-between">
                <div className="flex h-[4.5rem] w-[4.5rem] items-center justify-center rounded-3xl border-2 border-current/55">
                  <QrCode className="h-9 w-9" strokeWidth={2.25} />
                </div>
                <div>
                  <p className="text-[2.5rem] font-semibold tracking-tight leading-[1.02]">{t("No App Required")}</p>
                  <p className="mt-4 max-w-[16rem] text-xl font-semibold leading-snug">{t("Scan QR and start collecting.")}</p>
                </div>
              </div>
            </div>

            <div className="hover-card rounded-[2.6rem] bg-[linear-gradient(180deg,#f116ff_0%,#c918d9_100%)] p-8 text-white shadow-[0_24px_64px_-32px_rgba(167,15,187,0.55)] sm:min-h-[250px] lg:p-9">
              <div className="flex h-full flex-col justify-between">
                <div className="flex h-[4.5rem] w-[4.5rem] items-center justify-center rounded-full border-4 border-white/40 text-[2.6rem]">$</div>
                <div>
                  <p className="text-[2.6rem] font-semibold tracking-tight">{t("Lower")}</p>
                  <p className="mt-3 text-xl font-semibold text-white/90">{t("Printing costs")}</p>
                </div>
              </div>
            </div>

            <div className="hover-card rounded-[2.6rem] bg-[#101aa7] p-8 text-white shadow-[0_28px_80px_-34px_rgba(16,26,167,0.58)] sm:min-h-[250px] lg:p-9">
              <div className="flex h-full flex-col justify-between">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex h-[4.5rem] w-[4.5rem] items-center justify-center rounded-3xl border-2 border-white/30 bg-white/10">
                    <ChartNoAxesCombined className="h-9 w-9" strokeWidth={2.25} />
                  </div>
                  <div className="text-right text-[0.95rem] text-white/75">{t("Every visit tracked")}</div>
                </div>
                <div>
                  <p className="text-6xl font-semibold tracking-tight">{t("Live")}</p>
                  <p className="mt-3 text-xl font-semibold text-white/90">{t("Customer progress")}</p>
                </div>
              </div>
            </div>
          </div>
          <div className="max-w-[39rem] lg:justify-self-end">
            <div style={rise(value.visible, 80)}><SectionLabel>{t("Value")}</SectionLabel></div>
            <h2 style={rise(value.visible, 150)} className="mt-6 text-[clamp(3.2rem,5.8vw,5.9rem)] font-semibold leading-[0.96] tracking-tight text-[#1a1f33]">
              {t("Stop paying")}
              <br />
              {t("for paper.")}
            </h2>
            <p style={rise(value.visible, 240)} className="hidden">
              {t("A smarter loyalty system — built to last.")}
            </p>
            <p style={rise(value.visible, 240)} className="mt-9 max-w-xl text-[clamp(1.12rem,1.55vw,1.35rem)] leading-relaxed text-[#22273a]">
              {t("Move your loyalty program into the browser with digital cards that are easier to issue, easier to stamp, and easier to track.")}
            </p>
            <div style={rise(value.visible, 320)} className="mt-12">
              <Button asChild className="glow-button h-[3.75rem] rounded-full bg-[#dcb7df] px-12 text-lg font-semibold text-black shadow-none hover:bg-[#d2a6d6]">
                <Link to="/signup" onClick={() => trackEvent("Landing CTA Clicked", { placement: "value" })}>{t("Get started for free")}</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────────────── */}
      {/* SECTION 8 · CTA                                                        */}
      {/* ─────────────────────────────────────────────────────────────────────── */}
      <section className="relative min-h-[100svh] overflow-hidden bg-[#a5001e]">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,#c20a2a_0%,transparent_38%),radial-gradient(circle_at_bottom,#7f0018_0%,transparent_34%)] opacity-70" />
        </div>
        <div ref={faq.ref} className="relative mx-auto flex min-h-[100svh] max-w-[92rem] flex-col px-6 py-24 sm:px-8 lg:px-10">
          <div style={rise(faq.visible, 0)} className="flex items-center justify-center pb-14 pt-2 sm:pb-16">
            <h2 className="text-center text-[clamp(3rem,8vw,6rem)] font-semibold leading-[0.98] tracking-tight text-[#f4d7e8]">
              {t("Questions? Answered")}
            </h2>
          </div>

          <div style={rise(faq.visible, 120)} className="mx-auto w-full max-w-[78rem]">
            <Accordion type="single" collapsible className="flex w-full flex-col gap-5">
              <AccordionItem value="item-1" className="faq-card overflow-hidden rounded-[2.3rem] border-none bg-[#7f0018] px-7 sm:px-10 lg:px-12">
                <AccordionTrigger className="min-h-[128px] text-left text-[1.6rem] font-semibold text-[#f5d7e7] hover:no-underline sm:text-[2rem]">
                  {t("Do customers need to download an app?")}
                </AccordionTrigger>
                <AccordionContent className="pb-10 text-lg leading-8 text-[#f0b8cf] sm:text-xl">
                  {t("No. Customers open their digital card in a normal browser from a link you send them, so there is nothing to download.")}
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="item-2" className="faq-card overflow-hidden rounded-[2.3rem] border-none bg-[#7f0018] px-7 sm:px-10 lg:px-12">
                <AccordionTrigger className="min-h-[128px] text-left text-[1.6rem] font-semibold text-[#f5d7e7] hover:no-underline sm:text-[2rem]">
                  {t("How simple is setup?")}
                </AccordionTrigger>
                <AccordionContent className="pb-10 text-lg leading-8 text-[#f0b8cf] sm:text-xl">
                  {t("Setup is a short four-step flow: create your account, create a campaign, issue a digital card to your customer, then start stamping.")}
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="item-3" className="faq-card overflow-hidden rounded-[2.3rem] border-none bg-[#7f0018] px-7 sm:px-10 lg:px-12">
                <AccordionTrigger className="min-h-[128px] text-left text-[1.6rem] font-semibold text-[#f5d7e7] hover:no-underline sm:text-[2rem]">
                  {t("Can I design the card to match my brand?")}
                </AccordionTrigger>
                <AccordionContent className="pb-10 text-lg leading-8 text-[#f0b8cf] sm:text-xl">
                  {t("Yes. Your campaign is where you design the card, choose the reward, and set the stamp goal so the experience fits your business.")}
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="item-4" className="faq-card overflow-hidden rounded-[2.3rem] border-none bg-[#7f0018] px-7 sm:px-10 lg:px-12">
                <AccordionTrigger className="min-h-[128px] text-left text-[1.6rem] font-semibold text-[#f5d7e7] hover:no-underline sm:text-[2rem]">
                  {t("How do customers receive their card?")}
                </AccordionTrigger>
                <AccordionContent className="pb-10 text-lg leading-8 text-[#f0b8cf] sm:text-xl">
                  {t("You issue a digital card and share it as a link. Customers open it on their phone in the browser and can use it right away.")}
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="item-5" className="faq-card overflow-hidden rounded-[2.3rem] border-none bg-[#7f0018] px-7 sm:px-10 lg:px-12">
                <AccordionTrigger className="min-h-[128px] text-left text-[1.6rem] font-semibold text-[#f5d7e7] hover:no-underline sm:text-[2rem]">
                  {t("How do staff add stamps?")}
                </AccordionTrigger>
                <AccordionContent className="pb-10 text-lg leading-8 text-[#f0b8cf] sm:text-xl">
                  {t("Staff log in to Stampee, open the customer card, and record the visit. The stamp progress updates immediately.")}
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>
        </div>
      </section>

      <section className="relative min-h-[100svh] overflow-hidden bg-[#6d28d9]">
        <div className="pointer-events-none absolute inset-0">
          <div className="drift-c absolute left-1/2 top-1/2 h-[800px] w-[800px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-fuchsia-300/14 blur-[140px]" />
          <div className="drift-a absolute right-[-5%] bottom-[-5%] h-[400px] w-[400px] rounded-full bg-violet-300/14 blur-[100px]" />
        </div>
        <div ref={cta.ref} className="relative mx-auto flex min-h-[100svh] max-w-[82rem] flex-col items-center justify-center px-6 py-24 text-center sm:px-8 lg:px-10">
          <div style={rise(cta.visible, 0)}><SectionLabel light>{t("Get started")}</SectionLabel></div>
          <h2 style={rise(cta.visible, 80)} className="mt-6 text-[clamp(3rem,6vw,5.6rem)] font-semibold leading-[0.98] tracking-tight text-white">
            {t("Turn first-time customers")}<br />{t("into repeat regulars.")}
          </h2>
          <p style={rise(cta.visible, 180)} className="mx-auto mt-7 max-w-xl text-[clamp(1.08rem,1.45vw,1.32rem)] leading-relaxed text-white/50">
            {t("Create your digital stamp card today.")}
          </p>
          <div style={rise(cta.visible, 280)}>
            <Button asChild className="glow-button mt-12 h-[3.75rem] rounded-full bg-white px-14 text-base font-semibold text-[#1d1d1f] shadow-xl shadow-white/10 hover:bg-white/90">
              <Link to="/signup" onClick={() => trackEvent("Landing CTA Clicked", { placement: "footer" })}>{t("Start Free")}</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-white/[0.07] bg-[#1d1d1f] px-6 py-8">
        <div className="mx-auto flex max-w-[88rem] flex-col items-center gap-3 sm:flex-row sm:justify-between">
          <Link to="/" className="inline-flex items-center">
            <img src="/stampee.svg" alt={"Stampee"} className="h-7 w-auto opacity-35 invert" />
          </Link>
          <div className="flex flex-col items-center gap-3 sm:flex-row sm:gap-6">
            <Link
              to="/showcase"
              className="text-xs font-medium text-white/55 transition-colors hover:text-white"
            >
              {t("Demos & Templates")}
            </Link>
            <Link
              to="/articles"
              className="text-xs font-medium text-white/55 transition-colors hover:text-white"
            >
              {t("Articles")}
            </Link>
            <Link
              to="/privacy-policy"
              className="text-xs font-medium text-white/55 transition-colors hover:text-white"
            >
              {t("Privacy Policy")}
            </Link>
            <Link
              to="/cookie"
              className="text-xs font-medium text-white/55 transition-colors hover:text-white"
            >
              {t("Cookie Policy")}
            </Link>
            <Link
              to="/terms"
              className="text-xs font-medium text-white/55 transition-colors hover:text-white"
            >
              {t("Terms")}
            </Link>
            <p className="text-xs text-white/25">© {new Date().getFullYear()} Stampee. {t("All rights reserved.")}</p>
          </div>
        </div>
      </footer>

      <CookiePreferencesBanner />
    </div>
  );
};

