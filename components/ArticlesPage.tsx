import { useI18n } from "../lib/i18n";
import React from "react";
import { Link } from "react-router-dom";
import { ArrowRight, CalendarDays, QrCode, Sparkles } from "lucide-react";
import { articles } from "../data/articles";
import { useAuth } from "./AuthProvider";
import { PublicFooter } from "./PublicFooter";
import { Button } from "./ui/button";

const ArticleCover: React.FC<{
  title: string;
  coverClassName: string;
  coverAccentClassName: string;
}> = ({ title, coverClassName, coverAccentClassName }) => {
  const { t } = useI18n();
  return (
  <div className={`relative aspect-[1.06/1] overflow-hidden rounded-[2rem] ${coverClassName}`}>
    <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.12),transparent_30%),radial-gradient(circle_at_bottom_left,rgba(255,255,255,0.1),transparent_28%)]" />
    <div className="absolute left-[15%] top-[12%] h-[74%] w-[41%] rounded-[2rem] shadow-[0_28px_48px_-24px_rgba(0,0,0,0.35)]">
      <div className={`absolute inset-0 rounded-[2rem] ${coverAccentClassName}`} />
      <div className="absolute inset-x-[14%] top-[10%] flex justify-center">
        <div className="h-16 w-16 rounded-full bg-[radial-gradient(circle_at_35%_28%,#f0d2c6_0_20%,#3d2f28_21%_22%,#241911_23%_26%,#1f1813_27%_32%,#be7860_33%_100%)] shadow-[0_10px_25px_-16px_rgba(0,0,0,0.65)]" />
      </div>
      <div className="absolute inset-x-[12%] top-[34%] text-center">
        <p className="text-[1.05rem] font-semibold tracking-tight text-[#3a2a18]">{t("Launch")}</p>
        <p className="mt-2 text-[0.78rem] leading-5 text-[#4e3b23]/75">
          {t("Build a digital loyalty flow that is easy to issue and easy to stamp.")}
        </p>
      </div>
      <div className="absolute inset-x-[12%] bottom-[10%] rounded-[1.2rem] bg-white/55 px-4 py-3 backdrop-blur-sm">
        <p className="text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-[#5d482d]">Stampee</p>
        <p className="mt-1 text-[0.76rem] leading-5 text-[#4b3c26]">
          {t("Owner setup guide for first launch.")}
        </p>
      </div>
    </div>

    <div className="absolute right-[19%] top-[18%] w-[30%] rounded-[1.35rem] bg-[#f6f0de] p-3 shadow-[0_28px_60px_-28px_rgba(0,0,0,0.42)]">
      <div className="mb-3 flex items-center justify-between text-[9px] font-semibold text-[#5d533d]">
        <span>{t("Read this guide")}</span>
        <span>x</span>
      </div>
      <div className="rounded-[1rem] bg-[linear-gradient(135deg,#1d1d1f_0%,#53412d_55%,#d3eb22_100%)] p-4 text-white">
        <QrCode className="h-5 w-5 opacity-85" />
        <p className="mt-5 text-[0.76rem] font-semibold leading-5">{title}</p>
      </div>
      <div className="mt-3 rounded-full bg-[#1d1d1f] px-3 py-2 text-center text-[10px] font-semibold text-white">
        {t("Open article")}
      </div>
    </div>

    <div className="absolute bottom-[22%] right-[38%] h-16 w-16 rounded-full border-[4px] border-[#d3eb22] border-t-transparent border-l-transparent rotate-[28deg] opacity-90" />
    <div className="absolute bottom-[17%] right-[34%] text-[#d3eb22]">
      <ArrowRight className="h-7 w-7" />
    </div>
  </div>
  );
};

export const ArticlesPage: React.FC = () => {
  const { t, locale } = useI18n();
  const { currentUser, isStaff } = useAuth();
  const primaryPath = currentUser ? (isStaff ? "/issued-cards" : "/dashboard") : "/signup";
  const primaryLabel = currentUser ? "Open dashboard" : "Create account";

  return (
    <div className="min-h-screen bg-[#f3f2ef] text-[#1d1d1f]">
      <style>{`
        @keyframes blog-card-float { 0%,100%{transform:translate3d(0,0,0)} 50%{transform:translate3d(0,-6px,0)} }
        .blog-card {
          transition: transform 260ms cubic-bezier(0.16,1,0.3,1);
        }
        .blog-card:hover {
          transform: translateY(-6px);
        }
        .blog-card:hover .blog-card-cover {
          animation: blog-card-float 4.8s ease-in-out infinite;
        }
        @media (prefers-reduced-motion: reduce) {
          .blog-card { transition: none !important; }
          .blog-card:hover { transform: none !important; }
          .blog-card:hover .blog-card-cover { animation: none !important; }
        }
      `}</style>

      <header className="fixed top-0 z-30 w-full border-b border-black/[0.06] bg-white/78 backdrop-blur-2xl">
        <div className="mx-auto flex max-w-[112rem] items-center justify-between px-4 py-4 sm:px-6 lg:px-10">
          <Link to="/" className="inline-flex items-center">
            <img src="/stampee.svg" alt={"Stampee"} className="h-8 w-auto" />
          </Link>
          <nav className="flex items-center gap-2">
            <Button asChild variant="ghost" className="hidden rounded-full text-sm font-medium text-[#1d1d1f] hover:bg-black/[0.05] sm:inline-flex">
              <Link to="/">{t("Home")}</Link>
            </Button>
            <Button asChild variant="ghost" className="hidden rounded-full text-sm font-medium text-[#1d1d1f] hover:bg-black/[0.05] sm:inline-flex">
              <Link to="/showcase">{t("Demos")}</Link>
            </Button>
            <Button asChild className="rounded-full bg-[#1d1d1f] px-5 text-sm font-medium text-white hover:bg-black/80">
              <Link to={primaryPath}>{t(primaryLabel)}</Link>
            </Button>
          </nav>
        </div>
      </header>

      <main className="pb-20 pt-20">
        <section className="bg-[#ff6a00] px-4 py-16 sm:px-6 lg:px-10 lg:py-20">
          <div className="mx-auto max-w-[112rem]">
            <div className="max-w-[48rem]">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/12 px-4 py-2 text-[0.72rem] font-semibold uppercase tracking-[0.22em] text-white/88">
                <Sparkles className="h-3.5 w-3.5" />
                {t("Articles")}
              </div>
              <h1 className="mt-6 text-[clamp(2.8rem,5.4vw,5.4rem)] font-black leading-[0.92] tracking-[-0.05em] text-white">
                {t("Insights, launch guides, and practical loyalty reads.")}
              </h1>
            </div>
          </div>
        </section>

        <section className="px-4 pt-14 sm:px-6 lg:px-10 lg:pt-16">
          <div className="mx-auto grid max-w-[112rem] gap-x-10 gap-y-14 md:grid-cols-2 xl:grid-cols-3">
            {articles.map((article) => (
              <Link key={article.slug} to={article.href} className="blog-card block">
                <article>
                  <div className="blog-card-cover">
                    <ArticleCover
                      title={t(article.title)}
                      coverClassName={article.coverClassName}
                      coverAccentClassName={article.coverAccentClassName}
                    />
                  </div>

                  <div className="mt-8 flex items-center gap-4 text-[0.82rem] font-semibold text-[#747a81] sm:text-[0.92rem]">
                    <span>{t(article.publishedDate)}</span>
                    <span className="text-[#a2a7ad]">|</span>
                    <span className="inline-flex items-center gap-2">
                      <CalendarDays className="h-4 w-4" />
                      {t(article.readTime)}
                    </span>
                  </div>

                  <h2 className="mt-5 w-full text-[clamp(2rem,2.5vw,3.1rem)] font-black leading-[0.94] tracking-[-0.045em] text-black">
                    {t(article.title)}
                  </h2>

                  <p className="mt-6 w-full text-[clamp(1rem,1.2vw,1.15rem)] leading-[1.55] text-[#2f3338]">
                    {t(article.excerpt)}
                  </p>
                </article>
              </Link>
            ))}
          </div>
        </section>
      </main>
      <PublicFooter />
    </div>
  );
};

export default ArticlesPage;
