import React from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Cookie } from "lucide-react";
import { Button } from "./ui/button";
import { PublicFooter } from "./PublicFooter";
import { SUPPORT_EMAIL } from "../lib/siteConfig";
import { useI18n } from "../lib/i18n";

const sections = [
  { title: "What are cookies?", body: "Cookies are small text files saved in your browser. They help websites remember settings, keep sessions active, and understand how pages are used." },
  { title: "Essential cookies", body: "Essential cookies are required for core functionality, including authentication, security, and reliable page behavior. These cookies cannot be disabled if you want the site to work properly." },
  { title: "Analytics cookies", body: "Analytics cookies help us understand feature usage, identify friction, and improve performance. These cookies are optional and can be accepted or declined in the cookie preferences prompt." },
  { title: "How to manage cookies", body: "You can manage browser cookies from your browser settings at any time. If you block essential cookies, some parts of the service may stop working as expected." },
  { title: "Updates to this policy", body: "We may update this page when our cookie usage changes. The latest version and date are always posted here." },
];

export const CookiePolicyPage: React.FC = () => {
  const { t, locale } = useI18n();
  const updatedDate = new Intl.DateTimeFormat(locale, { year: "numeric", month: "long", day: "numeric" }).format(
    new Date("2026-03-09T00:00:00Z"),
  );

  return (
    <div className="min-h-screen bg-white text-[#1d1d1f]">
      <header className="fixed top-0 z-30 w-full border-b border-black/[0.06] bg-white/78 backdrop-blur-2xl">
        <div className="mx-auto flex max-w-[88rem] items-center justify-between px-4 py-4 sm:px-6 lg:px-10">
          <Link to="/" className="inline-flex items-center"><img src="/stampee.svg" alt="Stampee" className="h-8 w-auto" /></Link>
          <Button asChild variant="ghost" className="rounded-full text-sm text-[#1d1d1f] hover:bg-black/[0.05]"><Link to="/"><ArrowLeft className="mr-2 h-4 w-4" />{t("Home")}</Link></Button>
        </div>
      </header>

      <main className="pt-20">
        <section className="bg-[#1d1d1f] px-4 py-16 sm:px-6 lg:px-10 lg:py-20"><div className="mx-auto max-w-[88rem]"><div className="max-w-[48rem]">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-[0.72rem] font-semibold uppercase tracking-[0.22em] text-white/88"><Cookie className="h-3.5 w-3.5" />{t("Cookie Policy")}</div>
          <h1 className="mt-6 text-[clamp(2.8rem,5.4vw,5.2rem)] font-black leading-[0.92] tracking-[-0.05em] text-white">{t("How cookies are used on Stampee.")}</h1>
          <p className="mt-6 max-w-[38rem] text-[clamp(1rem,1.35vw,1.16rem)] leading-8 text-white/75">{t("Last updated {date}.", { date: updatedDate })}</p>
        </div></div></section>

        <section className="bg-white px-4 py-14 sm:px-6 lg:px-10 lg:py-16"><div className="mx-auto grid max-w-[88rem] gap-10 lg:grid-cols-[minmax(0,1fr)_320px]"><div className="space-y-6">
          <div className="bg-white px-6 py-2 sm:px-8 sm:py-2"><h2 className="text-[clamp(1.6rem,2.5vw,2.4rem)] font-semibold tracking-tight text-[#1d1d1f]">{t("Overview")}</h2><p className="mt-4 text-base leading-8 text-[#50545a]">{t("This policy explains which cookies are used, why they are used, and how you can manage cookie choices. It is designed to support clear and practical consent for essential and analytics categories.")}</p></div>
          {sections.map((section) => <article key={section.title} className="bg-white px-6 py-2 sm:px-8 sm:py-2"><h2 className="text-[clamp(1.5rem,2.3vw,2.2rem)] font-semibold leading-[1.02] tracking-tight text-[#1d1d1f]">{t(section.title)}</h2><p className="mt-4 text-base leading-8 text-[#50545a]">{t(section.body)}</p></article>)}
        </div>

        <aside className="space-y-5 lg:sticky lg:top-24 lg:self-start"><div className="bg-white px-6 py-2"><p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#1d1d1f]">{t("Cookie summary")}</p><ul className="mt-5 space-y-3 text-sm leading-6 text-[#50545a]"><li>{t("Essential cookies keep the product working.")}</li><li>{t("Analytics cookies are optional.")}</li><li>{t("You can change cookie settings in your browser.")}</li></ul></div>
          <div className="bg-white px-6 py-2"><p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#1d1d1f]">{t("Need help?")}</p><p className="mt-4 text-sm leading-7 text-[#5f4a2c]">{t("For cookie or privacy questions, contact {email}.", { email: SUPPORT_EMAIL })}</p></div></aside>
        </div></section>
      </main><PublicFooter />
    </div>
  );
};

export default CookiePolicyPage;
