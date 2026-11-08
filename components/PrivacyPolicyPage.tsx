import React from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { Button } from "./ui/button";
import { PublicFooter } from "./PublicFooter";
import { SUPPORT_EMAIL } from "../lib/siteConfig";
import { useI18n } from "../lib/i18n";

const sections = [
  {
    title: "Information we collect",
    body:
      "We collect the information needed to run Stampee, including account details, business profile information, loyalty campaign data, customer records you add to the platform, transaction history, and basic technical logs used to keep the service secure and working properly.",
  },
  {
    title: "How we use information",
    body:
      "We use this information to provide the product, authenticate users, issue and manage loyalty cards, process customer activity, support account administration, improve reliability, and prevent abuse or unauthorized access.",
  },
  {
    title: "Sharing and service providers",
    body:
      "We do not sell personal information. We may share data with infrastructure, analytics, authentication, or storage providers that help us operate Stampee, but only to the extent needed to deliver the service.",
  },
  {
    title: "Cookies and local storage",
    body:
      "Stampee may use cookies, browser storage, and similar technologies to keep users signed in, remember preferences, and support normal application behavior.",
  },
  {
    title: "Data retention",
    body:
      "We keep information for as long as it is needed to operate active accounts, meet legal obligations, resolve disputes, and maintain security or audit records. Retention periods may vary depending on the type of data involved.",
  },
  {
    title: "Security",
    body:
      "We use reasonable technical and organizational safeguards to protect the information processed through Stampee. No online system is completely risk free, so users should also protect account credentials and access to their devices.",
  },
  {
    title: "Your choices",
    body:
      "Business owners can review and update core account and campaign information inside the product. If you need help with privacy-related requests, email {email}.",
  },
];

export const PrivacyPolicyPage: React.FC = () => {
  const { t, locale } = useI18n();
  const updatedDate = new Intl.DateTimeFormat(locale, { year: "numeric", month: "long", day: "numeric" }).format(
    new Date("2026-03-03T00:00:00Z"),
  );

  return (
    <div className="min-h-screen bg-white text-[#1d1d1f]">
      <header className="fixed top-0 z-30 w-full border-b border-black/[0.06] bg-white/78 backdrop-blur-2xl">
        <div className="mx-auto flex max-w-[88rem] items-center justify-between px-4 py-4 sm:px-6 lg:px-10">
          <Link to="/" className="inline-flex items-center">
            <img src="/stampee.svg" alt="Stampee" className="h-8 w-auto" />
          </Link>
          <Button asChild variant="ghost" className="rounded-full text-sm text-[#1d1d1f] hover:bg-black/[0.05]">
            <Link to="/">
              <ArrowLeft className="mr-2 h-4 w-4" />
              {t("Home")}
            </Link>
          </Button>
        </div>
      </header>

      <main className="pt-20">
        <section className="bg-[#ff6a00] px-4 py-16 sm:px-6 lg:px-10 lg:py-20">
          <div className="mx-auto max-w-[88rem]">
            <div className="max-w-[48rem]">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/12 px-4 py-2 text-[0.72rem] font-semibold uppercase tracking-[0.22em] text-white/88">
                <ShieldCheck className="h-3.5 w-3.5" />
                {t("Privacy Policy")}
              </div>
              <h1 className="mt-6 text-[clamp(2.8rem,5.4vw,5.2rem)] font-black leading-[0.92] tracking-[-0.05em] text-white">
                {t("How Stampee handles account, loyalty, and customer data.")}
              </h1>
              <p className="mt-6 max-w-[38rem] text-[clamp(1rem,1.35vw,1.16rem)] leading-8 text-white/82">
                {t("Last updated {date}.", { date: updatedDate })}
              </p>
            </div>
          </div>
        </section>

        <section className="bg-white px-4 py-14 sm:px-6 lg:px-10 lg:py-16">
          <div className="mx-auto grid max-w-[88rem] gap-10 lg:grid-cols-[minmax(0,1fr)_320px]">
            <div className="space-y-6">
              <div className="bg-white px-6 py-2 sm:px-8 sm:py-2">
                <h2 className="text-[clamp(1.6rem,2.5vw,2.4rem)] font-semibold tracking-tight text-[#1d1d1f]">
                  {t("Overview")}
                </h2>
                <p className="mt-4 text-base leading-8 text-[#50545a]">
                  {t("This page explains the categories of information Stampee processes, why that information is used, and the general safeguards applied when operating the platform. It is intended as a clear public summary for business owners and visitors using Stampee.")}
                </p>
              </div>

              {sections.map((section) => (
                <article key={section.title} className="bg-white px-6 py-2 sm:px-8 sm:py-2">
                  <h2 className="text-[clamp(1.5rem,2.3vw,2.2rem)] font-semibold leading-[1.02] tracking-tight text-[#1d1d1f]">
                    {t(section.title)}
                  </h2>
                  <p className="mt-4 text-base leading-8 text-[#50545a]">
                    {t(section.body, section.title === "Your choices" ? { email: SUPPORT_EMAIL } : undefined)}
                  </p>
                </article>
              ))}
            </div>

            <aside className="space-y-5 lg:sticky lg:top-24 lg:self-start">
              <div className="bg-white px-6 py-2 text-[#1d1d1f]">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#1d1d1f]">{t("Policy summary")}</p>
                <ul className="mt-5 space-y-3 text-sm leading-6 text-[#50545a]">
                  <li>{t("Used to run accounts, cards, campaigns, and customer activity.")}</li>
                  <li>{t("Not sold as personal information.")}</li>
                  <li>{t("Shared only with service providers needed to operate Stampee.")}</li>
                  <li>{t("Protected with reasonable operational and technical safeguards.")}</li>
                </ul>
              </div>

              <div className="bg-white px-6 py-2">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#1d1d1f]">{t("Need help?")}</p>
                <p className="mt-4 text-sm leading-7 text-[#5f4a2c]">
                  {t("If you need privacy-related help, email {email}.", { email: SUPPORT_EMAIL })}
                </p>
              </div>
            </aside>
          </div>
        </section>
      </main>
      <PublicFooter />
    </div>
  );
};

export default PrivacyPolicyPage;
