import { useI18n } from "../lib/i18n";
import React from "react";
import { Link } from "react-router-dom";
import { ArrowRight, MonitorPlay } from "lucide-react";
import { PublicFooter } from "./PublicFooter";
import { Button } from "./ui/button";
import { useAuth } from "./AuthProvider";

const showcaseCardPaths = [
  "/the-daily-brew/888f22a4-247d-4b3d-a5fa-8d32d7474d6d",
  "/the-daily-brew/d60e05e6-9e10-4727-9625-58fd392956a1",
  "/the-daily-brew/fd6616fc-c7a5-4021-89f0-6a2397208cda",
  "/the-daily-brew/66f828a4-e7b3-47eb-bb4d-677fb773870e",
  "/the-daily-brew/2ec99ae1-9954-4218-a6bc-1c399551f2c8",
  "/the-daily-brew/28a46076-28a7-4f57-8f91-b66b70a3d1ce",
  "/the-daily-brew/5d975cbf-31f3-4f5f-90d6-da6cb3b4934b",
  "/the-daily-brew/6b6b61d8-ee0f-4327-b3ff-04795051a70b",
  "/the-daily-brew/7fbf6642-beaa-4642-9c38-dafdfce0a903",
] as const;

const showcaseImages = showcaseCardPaths.map((href, index) => ({
  id: `demo-${index + 1}`,
  src: `/demo_${index + 1}.png`,
  alt: `Stampee demo ${index + 1}`,
  href,
}));

const ShowcasePreviewCard: React.FC<(typeof showcaseImages)[number]> = ({ src, alt, href }) => {
  const { t } = useI18n();
  return (
  <a
    className="showcase-card group block"
    href={href}
    target="_blank"
    rel="noopener noreferrer"
  >
    <div className="relative aspect-[380/750] w-full overflow-hidden rounded-[2.4rem] border border-black/5 bg-white shadow-[0_32px_80px_-40px_rgba(0,0,0,0.26)]">
      <img src={src} alt={t(alt)} className="h-full w-full object-cover" loading="lazy" />
      <div className="absolute inset-0 bg-black/0 transition-colors duration-300 group-hover:bg-black/[0.04]" />
    </div>
  </a>
  );
};

export const ShowcasePage: React.FC = () => {
  const { t, locale } = useI18n();
  const { currentUser, isStaff } = useAuth();
  const primaryPath = currentUser ? (isStaff ? "/issued-cards" : "/dashboard") : "/signup";
  const primaryLabel = currentUser ? "Open dashboard" : "Create account";

  return (
    <div className="min-h-screen bg-[#f4f1e8] text-[#1d1d1f]">
      <style>{`
        @keyframes showcase-drift-a { 0%,100%{transform:translateY(0px) scale(1)} 55%{transform:translateY(-28px) scale(1.03)} }
        @keyframes showcase-drift-b { 0%,100%{transform:translateY(0px) scale(1)} 50%{transform:translateY(20px) scale(0.98)} }
        @keyframes showcase-chip { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-3px)} }
        @keyframes showcase-float { 0%,100%{transform:translate3d(0,0,0)} 50%{transform:translate3d(0,-8px,0)} }
        .showcase-drift-a { animation: showcase-drift-a 10s ease-in-out infinite; }
        .showcase-drift-b { animation: showcase-drift-b 12s ease-in-out infinite 1.5s; }
        .showcase-chip { animation: showcase-chip 5.4s ease-in-out infinite; }
        .showcase-panel { animation: showcase-float 8.4s ease-in-out infinite; }
        .showcase-card {
          transition: transform 280ms cubic-bezier(0.16,1,0.3,1), box-shadow 280ms cubic-bezier(0.16,1,0.3,1);
        }
        .showcase-card:hover {
          transform: translateY(-8px);
          box-shadow: 0 36px 90px -42px rgba(0,0,0,0.28);
        }
        @media (prefers-reduced-motion: reduce) {
          .showcase-drift-a, .showcase-drift-b, .showcase-chip, .showcase-panel { animation: none !important; }
          .showcase-card { transition: none !important; }
          .showcase-card:hover { transform: none !important; }
        }
      `}</style>

      <header className="fixed top-0 z-30 w-full border-b border-black/[0.06] bg-white/75 backdrop-blur-2xl">
        <div className="mx-auto flex max-w-[88rem] items-center justify-between px-4 py-4 sm:px-6">
          <Link to="/" className="inline-flex items-center">
            <img src="/stampee.svg" alt={"Stampee"} className="h-8 w-auto" />
          </Link>
          <nav className="flex items-center gap-2">
            <Button asChild variant="ghost" className="hidden rounded-full text-sm font-medium text-[#1d1d1f] hover:bg-black/[0.06] sm:inline-flex">
              <Link to="/articles">{t("Articles")}</Link>
            </Button>
            <Button asChild className="rounded-full bg-[#1d1d1f] px-5 text-sm font-medium text-white hover:bg-black/80">
              <Link to={primaryPath}>{t(primaryLabel)}</Link>
            </Button>
          </nav>
        </div>
      </header>

      <main className="pt-20">
        <section className="relative overflow-hidden bg-[#d3eb22]">
          <div className="pointer-events-none absolute inset-0">
            <div className="showcase-drift-a absolute left-[-8%] top-[10%] h-[460px] w-[460px] rounded-full bg-[#f4ff9a]/70 blur-[120px]" />
            <div className="showcase-drift-b absolute right-[-10%] bottom-[-5%] h-[520px] w-[520px] rounded-full bg-[#94b90d]/25 blur-[130px]" />
            <div className="absolute left-[46%] top-[22%] h-[280px] w-[280px] rounded-full bg-white/20 blur-[90px]" />
          </div>

          <div className="relative mx-auto flex min-h-[72svh] w-full max-w-[88rem] items-center px-4 pb-16 pt-24 sm:px-6 lg:pb-20">
            <div className="max-w-[62rem]">
              <div className="showcase-chip mb-7 inline-flex items-center gap-2 rounded-full border border-[#17351a]/10 bg-white/35 px-5 py-2 text-[0.72rem] font-semibold uppercase tracking-[0.24em] text-[#284b1f] backdrop-blur-sm">
                <MonitorPlay className="h-3.5 w-3.5" />
                {t("Demos & Templates")}
              </div>
              <h1 className="max-w-[14ch] text-[clamp(3.2rem,6.5vw,6rem)] font-black leading-[0.92] tracking-[-0.05em] text-[#17351a]">
                {t("See how loyalty looks before you launch it.")}
              </h1>
              <p className="mt-8 max-w-[50rem] text-[clamp(1.08rem,1.65vw,1.42rem)] leading-[1.45] text-[#23461d]/82">
                {t("Browse live card demos, explore ready-made templates, and find a starting point that already feels close to your brand.")}
              </p>
              <div className="mt-10 flex flex-wrap gap-4">
                <Button asChild className="h-14 rounded-[1.4rem] bg-[#17351a] px-8 text-base font-semibold text-white shadow-[0_26px_50px_-28px_rgba(23,53,26,0.85)] hover:bg-[#102712]">
                  <Link to="#templates">{t("Browse templates")}</Link>
                </Button>
                <Button asChild variant="ghost" className="h-14 rounded-[1.4rem] bg-white/55 px-8 text-base font-medium text-[#17351a] hover:bg-white/75">
                  <Link to="/articles">{t("Read articles")}</Link>
                </Button>
              </div>
            </div>
          </div>
        </section>

        <section id="templates" className="relative overflow-hidden bg-[#f4f1e8] px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
          <div className="mx-auto max-w-[96rem]">
            <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-10">
              {showcaseImages.map((image) => (
                <ShowcasePreviewCard
                  key={image.id}
                  {...image}
                />
              ))}
            </div>
          </div>
        </section>

        <section className="relative overflow-hidden bg-[#6d28d9] px-4 py-20 text-white sm:px-6 lg:px-8">
          <div className="pointer-events-none absolute inset-0">
            <div className="showcase-drift-a absolute left-[-6%] top-[12%] h-[320px] w-[320px] rounded-full bg-fuchsia-300/16 blur-[110px]" />
            <div className="showcase-drift-b absolute right-[-8%] bottom-[6%] h-[360px] w-[360px] rounded-full bg-violet-300/16 blur-[120px]" />
          </div>
          <div className="relative mx-auto max-w-[82rem] text-center">
            <p className="text-[0.72rem] font-semibold uppercase tracking-[0.26em] text-white/55">{t("Next step")}</p>
            <h2 className="mt-6 text-[clamp(3rem,6vw,5.5rem)] font-semibold leading-[0.98] tracking-tight">
              {t("Take a demo into your own brand.")}
            </h2>
            <p className="mx-auto mt-6 max-w-2xl text-[clamp(1.06rem,1.45vw,1.3rem)] leading-relaxed text-white/72">
              {t("Start with a template, adjust the reward and style, and get your first loyalty program live fast.")}
            </p>
            <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
              <Button asChild className="h-[3.6rem] rounded-full bg-white px-10 text-base font-semibold text-[#1d1d1f] hover:bg-white/92">
                <Link to={primaryPath}>{t(primaryLabel)}</Link>
              </Button>
              <Button asChild variant="ghost" className="h-[3.6rem] rounded-full border border-white/20 bg-white/10 px-10 text-base font-medium text-white hover:bg-white/16">
                <Link to="/articles/getting-started">
                  {t("Read the guide")}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>
        </section>
      </main>
      <PublicFooter />
    </div>
  );
};

export default ShowcasePage;
