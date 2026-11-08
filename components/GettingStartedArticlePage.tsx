import { useI18n } from "../lib/i18n";
import React from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, ArrowRight, CheckCircle2, Clock3, Sparkles } from "lucide-react";
import { Button } from "./ui/button";
import { useAuth } from "./AuthProvider";
import { PublicFooter } from "./PublicFooter";

const steps = [
  {
    title: "Create your Stampee account",
    body: "Sign up with your business email, then confirm the account so you can access the dashboard and start configuring your workspace.",
    bullets: [
      "Use an email your team can access long term.",
      "Choose the owner account carefully because it controls billing and staff access.",
      "Log in once after signup to verify the dashboard loads cleanly.",
    ],
  },
  {
    title: "Set up your business profile",
    body: "Add your business name and claim a clean public slug. This becomes part of the card link your customers and staff will use.",
    bullets: [
      "Pick a short slug that matches your brand.",
      "Double-check spelling before printing QR codes or marketing material.",
      "Keep your profile details consistent with your storefront branding.",
    ],
  },
  {
    title: "Build your first loyalty campaign",
    body: "Create a campaign with the reward, stamp count, and card design your customers will immediately understand.",
    bullets: [
      "Name the reward in plain language such as 'Free coffee' or '1 cookie on us'.",
      "Use a stamp target your regular customers can realistically reach.",
      "Preview the card design on mobile before publishing it.",
    ],
  },
  {
    title: "Add customers and issue cards",
    body: "Once the campaign is ready, create customer records and issue the first batch of digital cards from the dashboard.",
    bullets: [
      "Start with staff or a few known customers to test the full flow.",
      "Verify that each issued card points to the correct campaign.",
      "Use the customer directory to keep records clean from the start.",
    ],
  },
  {
    title: "Train staff to stamp cards",
    body: "Give your staff the correct login and have them practice scanning or opening customer cards, then recording a transaction.",
    bullets: [
      "Test the staff workflow on a real phone at the counter.",
      "Confirm permissions are limited to the owner account they belong to.",
      "Run one full test from stamp issue to reward redemption.",
    ],
  },
  {
    title: "Launch and monitor activity",
    body: "After the workflow is stable, share the card links or QR codes with customers and track usage from transactions, cards, and analytics.",
    bullets: [
      "Check your first few live transactions for accuracy.",
      "Review campaign performance after the first week.",
      "Adjust the reward or stamp target if redemption is too slow or too easy.",
    ],
  },
];

const checklist = [
  "Owner account created",
  "Business profile completed",
  "Public slug confirmed",
  "First campaign published",
  "At least one test customer added",
  "Staff login tested",
];

export const GettingStartedArticlePage: React.FC = () => {
  const { t, locale } = useI18n();
  const { currentUser, isStaff } = useAuth();
  const primaryPath = currentUser ? (isStaff ? "/issued-cards" : "/dashboard") : "/signup";
  const primaryLabel = currentUser ? "Open dashboard" : "Create account";

  return (
    <div className="min-h-screen bg-[#f5f4ef] text-[#1d1d1f]">
      <style>{`
        @keyframes gs-drift-a { 0%,100%{transform:translateY(0px) scale(1)} 55%{transform:translateY(-24px) scale(1.03)} }
        @keyframes gs-drift-b { 0%,100%{transform:translateY(0px) scale(1)} 50%{transform:translateY(18px) scale(0.98)} }
        @keyframes gs-chip { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-3px)} }
        @keyframes gs-float { 0%,100%{transform:translate3d(0,0,0)} 50%{transform:translate3d(0,-8px,0)} }
        .gs-drift-a { animation: gs-drift-a 10s ease-in-out infinite; }
        .gs-drift-b { animation: gs-drift-b 12s ease-in-out infinite 1.5s; }
        .gs-chip { animation: gs-chip 5.4s ease-in-out infinite; }
        .gs-panel { animation: gs-float 8.4s ease-in-out infinite; }
        .gs-card {
          transition: transform 280ms cubic-bezier(0.16,1,0.3,1), box-shadow 280ms cubic-bezier(0.16,1,0.3,1);
        }
        .gs-card:hover {
          transform: translateY(-8px);
          box-shadow: 0 32px 70px -38px rgba(0,0,0,0.24);
        }
        @media (prefers-reduced-motion: reduce) {
          .gs-drift-a, .gs-drift-b, .gs-chip, .gs-panel { animation: none !important; }
          .gs-card { transition: none !important; }
          .gs-card:hover { transform: none !important; }
        }
      `}</style>

      <header className="fixed top-0 z-30 w-full border-b border-black/[0.06] bg-white/75 backdrop-blur-2xl">
        <div className="mx-auto flex max-w-[88rem] items-center justify-between px-4 py-4 sm:px-6">
          <Link to="/" className="inline-flex items-center gap-3">
            <img src="/stampee.svg" alt={"Stampee"} className="h-8 w-auto" />
          </Link>
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" className="rounded-full text-sm text-[#1d1d1f] hover:bg-black/[0.06]">
              <Link to="/">
                <ArrowLeft className="mr-2 h-4 w-4" />
                {t("Home")}
              </Link>
            </Button>
            <Button asChild variant="ghost" className="hidden rounded-full text-sm text-[#1d1d1f] hover:bg-black/[0.06] sm:inline-flex">
              <Link to="/articles">{t("Articles")}</Link>
            </Button>
            <Button asChild className="rounded-full bg-[#1d1d1f] px-5 text-sm font-medium text-white hover:bg-black/80">
              <Link to={primaryPath}>{t(primaryLabel)}</Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="pt-20">
        <section className="relative overflow-hidden bg-[#d3eb22]">
          <div className="pointer-events-none absolute inset-0">
            <div className="gs-drift-a absolute left-[-8%] top-[12%] h-[440px] w-[440px] rounded-full bg-[#f4ff9a]/75 blur-[120px]" />
            <div className="gs-drift-b absolute right-[-10%] bottom-[-8%] h-[520px] w-[520px] rounded-full bg-[#94b90d]/20 blur-[130px]" />
            <div className="absolute left-[48%] top-[18%] h-[260px] w-[260px] rounded-full bg-white/18 blur-[90px]" />
          </div>

          <div className="relative mx-auto grid min-h-[100svh] max-w-[96rem] grid-cols-1 items-center gap-12 px-6 pb-16 pt-24 sm:px-8 lg:grid-cols-[minmax(0,1fr)_minmax(420px,0.96fr)] lg:gap-16 lg:px-10 lg:pb-20">
            <div className="max-w-[42rem]">
              <div className="gs-chip mb-7 inline-flex items-center gap-2 rounded-full border border-[#17351a]/10 bg-white/35 px-5 py-2 text-[0.72rem] font-semibold uppercase tracking-[0.24em] text-[#284b1f] backdrop-blur-sm">
                <Sparkles className="h-3.5 w-3.5" />
                {t("Getting Started")}
              </div>
              <h1 className="max-w-[11ch] text-[clamp(3.2rem,6.5vw,6rem)] font-black leading-[0.92] tracking-[-0.05em] text-[#17351a]">
                {t("Launch your first loyalty campaign in one clean pass.")}
              </h1>
              <p className="mt-8 max-w-[38rem] text-[clamp(1.08rem,1.65vw,1.42rem)] leading-[1.45] text-[#23461d]/82">
                {t("This guide follows the same flow your business will take inside Stampee: set up the account, shape the offer, test the customer journey, and go live with confidence.")}
              </p>
              <div className="mt-8 flex flex-wrap gap-3 text-sm font-semibold text-[#23461d]/78">
                <div className="inline-flex items-center gap-2 rounded-full bg-white/55 px-4 py-2">
                  <Clock3 className="h-4 w-4" />
                  {t("10 minute setup")}
                </div>
                <div className="inline-flex items-center gap-2 rounded-full bg-white/55 px-4 py-2">
                  <CheckCircle2 className="h-4 w-4" />
                  {t("Best for first-time owners")}
                </div>
              </div>
              <div className="mt-10 flex flex-wrap gap-4">
                <Button asChild className="h-14 rounded-[1.4rem] bg-[#17351a] px-8 text-base font-semibold text-white shadow-[0_26px_50px_-28px_rgba(23,53,26,0.85)] hover:bg-[#102712]">
                  <Link to={primaryPath}>
                    {t(primaryLabel)}
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
                <Button asChild variant="ghost" className="h-14 rounded-[1.4rem] bg-white/55 px-8 text-base font-medium text-[#17351a] hover:bg-white/75">
                  <Link to="#steps">{t("View the steps")}</Link>
                </Button>
              </div>
            </div>

            <div className="gs-panel relative flex justify-center lg:justify-end">
              <div className="w-full max-w-[32rem] overflow-hidden rounded-[2.8rem] border border-black/5 bg-white/88 shadow-[0_42px_90px_-38px_rgba(23,53,26,0.36)] backdrop-blur">
                <div className="border-b border-black/[0.06] bg-[linear-gradient(180deg,rgba(255,255,255,0.55)_0%,rgba(255,255,255,0)_100%)] px-6 py-6">
                  <p className="text-[0.72rem] font-semibold uppercase tracking-[0.22em] text-[#7a812f]">{t("Quick launch")}</p>
                  <p className="mt-2 text-[2rem] font-black tracking-[-0.04em] text-[#17351a]">{t("Six steps to live.")}</p>
                </div>
                <div className="space-y-4 px-6 py-6">
                  {steps.slice(0, 4).map((step, index) => (
                    <div key={t(step.title)} className="rounded-[1.6rem] border border-black/[0.06] bg-white/80 px-4 py-4">
                      <div className="flex items-start gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#17351a] text-sm font-black text-white">
                          {index + 1}
                        </div>
                        <div>
                          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#6b7240]">{t("Step {count}", { count: index + 1 })}</p>
                          <p className="mt-1 text-base font-semibold leading-tight text-[#1d1d1f]">{t(step.title)}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                  <div className="rounded-[1.8rem] bg-[#17351a] px-5 py-5 text-white">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/45">{t("Before you begin")}</p>
                    <p className="mt-3 text-sm leading-7 text-white/82">
                      {t("You only need three things to launch: your business name, the reward you want to offer, and one phone to test the customer card flow.")}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="steps" className="relative overflow-hidden bg-[#f5f4ef] px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
          <div className="mx-auto max-w-[96rem]">
            <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
              <div className="space-y-6">
                {steps.map((step, index) => (
                  <article
                    key={t(step.title)}
                    className={`gs-card rounded-[2.4rem] border border-black/[0.06] px-6 py-6 shadow-[0_24px_70px_-42px_rgba(0,0,0,0.24)] sm:px-8 sm:py-8 ${
                      index % 3 === 0
                        ? "bg-white"
                        : index % 3 === 1
                          ? "bg-[#fff3e8]"
                          : "bg-[#eef2ff]"
                    }`}
                  >
                    <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
                      <div className="flex min-w-0 gap-4">
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#1d1d1f] text-sm font-black text-white">
                          {index + 1}
                        </div>
                        <div className="min-w-0">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#6e6e73]">{t("Step {count}", { count: index + 1 })}</p>
                          <h2 className="mt-2 text-[clamp(1.6rem,2.4vw,2.4rem)] font-semibold leading-[1.02] tracking-tight text-[#1d1d1f]">
                            {t(step.title)}
                          </h2>
                          <p className="mt-4 max-w-3xl text-[15px] leading-7 text-[#56595e] sm:text-base">
                            {t(step.body)}
                          </p>
                        </div>
                      </div>
                      <div className="rounded-full bg-black/[0.04] px-4 py-2 text-sm font-semibold text-[#1d1d1f]">
                        {t("Action {count} of {total}", { count: index + 1, total: steps.length })}
                      </div>
                    </div>
                    <ul className="mt-6 grid gap-3 sm:grid-cols-2">
                      {step.bullets.map((bullet) => (
                        <li key={t(bullet)} className="flex items-start gap-3 rounded-[1.35rem] border border-black/[0.05] bg-white/65 px-4 py-4 text-sm leading-6 text-[#41454a]">
                          <CheckCircle2 className="mt-0.5 h-4.5 w-4.5 shrink-0 text-[#d97706]" />
                          <span>{t(bullet)}</span>
                        </li>
                      ))}
                    </ul>
                  </article>
                ))}
              </div>

              <aside className="space-y-5 lg:sticky lg:top-24">
                <div className="rounded-[2rem] bg-[#1d1d1f] p-6 text-white shadow-[0_28px_70px_-32px_rgba(0,0,0,0.38)]">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/45">{t("Quick checklist")}</p>
                  <ul className="mt-5 space-y-3">
                    {checklist.map((item) => (
                      <li key={item} className="flex items-start gap-3 text-sm text-white/88">
                        <CheckCircle2 className="mt-0.5 h-4.5 w-4.5 shrink-0 text-[#d3eb22]" />
                        <span>{t(item)}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="rounded-[2rem] bg-[#ffe100] p-6 text-[#302900] shadow-[0_24px_60px_-34px_rgba(76,66,0,0.32)]">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#5a4f00]">{t("What success looks like")}</p>
                  <p className="mt-4 text-sm leading-7 text-[#4f4500]">
                    {t("By the end of setup, you should have one active campaign, one issued test card, and one completed transaction recorded in Stampee.")}
                  </p>
                </div>

                <div className="rounded-[2rem] border border-black/[0.06] bg-white p-6 shadow-[0_24px_60px_-36px_rgba(0,0,0,0.2)]">
                  <h3 className="text-xl font-semibold text-[#1d1d1f]">{t("Ready to launch?")}</h3>
                  <p className="mt-3 text-sm leading-7 text-[#5f6368]">
                    {t("Start with one campaign, validate the workflow on your own phone, then roll it out to customers.")}
                  </p>
                  <Button asChild className="mt-5 w-full rounded-full bg-[#1d1d1f] text-white hover:bg-black/80">
                    <Link to={primaryPath}>
                      {t(primaryLabel)}
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                  </Button>
                </div>
              </aside>
            </div>
          </div>
        </section>
      </main>
      <PublicFooter />
    </div>
  );
};

export default GettingStartedArticlePage;
