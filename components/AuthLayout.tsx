import React from "react";
import { Link } from "react-router-dom";
import { useI18n } from "../lib/i18n";

interface AuthLayoutProps {
  title: string;
  subtitle: string;
  badge?: string;
  theme?: "login" | "signup" | "staff";
  children: React.ReactNode;
}

const THEME_CONFIG = {
  login: {
    blobA: "bg-amber-200/50",
    blobB: "bg-orange-100/60",
    blobC: "bg-rose-100/30",
    metrics: [
      { label: "Cards issued", value: "12k+" },
      { label: "Repeat visits", value: "+24%" },
    ],
    quote: "Built for coffee shops, bakeries, and local brands that want loyalty without the paperwork.",
    features: [] as string[],
    navLinkLabel: "Create account",
    navLinkTo: "/signup",
  },
  signup: {
    blobA: "bg-sky-200/40",
    blobB: "bg-teal-100/50",
    blobC: "bg-indigo-100/30",
    metrics: [
      { label: "Setup time", value: "3 min" },
      { label: "Staff onboarded", value: "5k+" },
    ],
    quote: "Brand profile, loyalty cards, and analytics — everything in one place, ready in minutes.",
    features: ["Brand profile", "Loyalty cards", "Analytics"],
    navLinkLabel: "Log in",
    navLinkTo: "/login",
  },
  staff: {
    blobA: "bg-cyan-200/40",
    blobB: "bg-lime-100/50",
    blobC: "bg-sky-100/30",
    metrics: [
      { label: "Scans today", value: "30k+" },
      { label: "Avg issue time", value: "12 sec" },
    ],
    quote: "Stamp cards fast and accurately — no paper, no hassle, just seamless service.",
    features: [] as string[],
    navLinkLabel: "Owner login",
    navLinkTo: "/login",
  },
};

export const AuthLayout: React.FC<AuthLayoutProps> = ({
  title,
  subtitle,
  badge,
  theme = "login",
  children,
}) => {
  const { t: translate } = useI18n();
  const t = THEME_CONFIG[theme];

  return (
    <div className="min-h-screen bg-[#fafafa] text-[#1d1d1f] antialiased">
      <style>{`
        @keyframes auth-a { 0%,100%{transform:translateY(0px)} 55%{transform:translateY(-26px)} }
        @keyframes auth-b { 0%,100%{transform:translateY(0px)} 50%{transform:translateY(22px)} }
        .auth-a { animation: auth-a 11s ease-in-out infinite; }
        .auth-b { animation: auth-b 14s ease-in-out infinite 2s; }
        .auth-c { animation: auth-a 9s ease-in-out infinite 4.5s; }
      `}</style>

      {/* Ambient blobs — fixed so they don't scroll */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className={`auth-a absolute -left-40 -top-40 h-[650px] w-[650px] rounded-full blur-[130px] ${t.blobA}`} />
        <div className={`auth-b absolute -bottom-40 -right-20 h-[550px] w-[550px] rounded-full blur-[110px] ${t.blobB}`} />
        <div className={`auth-c absolute left-1/2 top-[30%] h-[400px] w-[400px] -translate-x-1/2 rounded-full blur-[100px] ${t.blobC}`} />
      </div>

      {/* Nav */}
      <header className="fixed top-0 z-50 w-full border-b border-black/[0.06] bg-white/75 backdrop-blur-2xl">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <Link to="/">
            <img src="/stampee.svg" alt="Stampee" className="h-8 w-auto" />
          </Link>
          <Link
            to={t.navLinkTo}
            className="rounded-full border border-black/[0.1] bg-white px-5 py-2 text-sm font-medium text-[#1d1d1f] shadow-sm transition-colors hover:bg-[#f5f5f7]"
          >
            {translate(t.navLinkLabel)}
          </Link>
        </div>
      </header>

      {/* Page grid */}
      <div className="relative z-10 mx-auto grid min-h-screen max-w-5xl grid-cols-1 items-center gap-10 px-6 pb-12 pt-24 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16 lg:pb-12 lg:pt-24">

        {/* ── Left: marketing panel (desktop only) ── */}
        <section className="hidden flex-col justify-center space-y-8 lg:flex">
          {badge && (
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#6e6e73]">{translate(badge)}</p>
          )}
          <h1 className="text-[clamp(2.5rem,5.5vw,4.2rem)] font-semibold leading-[1.06] tracking-tight text-[#1d1d1f]">
            {translate(title)}
          </h1>
          <p className="max-w-md text-lg leading-relaxed text-[#6e6e73]">{translate(subtitle)}</p>

          {/* Stat cards */}
          <div className="grid max-w-sm grid-cols-2 gap-4">
            {t.metrics.map((m) => (
              <div
                key={translate(m.label)}
                className="rounded-2xl border border-black/[0.07] bg-white/80 px-5 py-5 shadow-sm"
              >
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#6e6e73]">
                  {translate(m.label)}
                </p>
                <p className="mt-2 text-3xl font-semibold tracking-tight text-[#1d1d1f]">{m.value}</p>
              </div>
            ))}
          </div>

          {/* Quote */}
          <p className="max-w-sm border-l-2 border-black/[0.1] pl-4 text-sm leading-relaxed text-[#6e6e73]">
            {translate(t.quote)}
          </p>

          {/* Feature pills (signup only) */}
          {t.features.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {t.features.map((f) => (
                <div key={f} className="flex items-center gap-1.5 rounded-full border border-black/[0.07] bg-white/80 px-3 py-1.5 shadow-sm">
                  <div className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  <span className="text-[11px] font-medium text-[#6e6e73]">{translate(f)}</span>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* ── Right: form card ── */}
        <section className="w-full">
          <div className="mx-auto max-w-[440px] rounded-3xl border border-black/[0.07] bg-white p-5 shadow-[0_8px_48px_rgba(0,0,0,0.07)] sm:p-8 lg:mx-0 lg:max-w-none lg:p-8">
            {children}
          </div>
        </section>

      </div>
    </div>
  );
};
