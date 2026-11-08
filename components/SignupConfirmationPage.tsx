import React from "react";
import { Link, Navigate, useLocation } from "react-router-dom";
import { CheckCircle2, MailCheck } from "lucide-react";
import { useAuth } from "./AuthProvider";
import { Button } from "./ui/button";
import PublicFooter from "./PublicFooter";
import { useI18n } from "../lib/i18n";

type LocationState = {
  email?: string;
};

export const SignupConfirmationPage: React.FC = () => {
  const { t } = useI18n();
  const { currentUser, loading } = useAuth();
  const location = useLocation();
  const state = location.state as LocationState | null;
  const email = state?.email?.trim();

  if (!loading && currentUser) {
    return <Navigate to={currentUser.role === "staff" ? "/issued-cards" : "/dashboard"} replace />;
  }

  return (
    <div className="min-h-screen bg-[#f2efe8] text-[#1d1d1f]">
      <style>{`
        @keyframes confirm-float-a { 0%,100% { transform: translateY(0px); } 50% { transform: translateY(-18px); } }
        @keyframes confirm-float-b { 0%,100% { transform: translateY(0px); } 50% { transform: translateY(20px); } }
        .confirm-float-a { animation: confirm-float-a 9.5s ease-in-out infinite; }
        .confirm-float-b { animation: confirm-float-b 12s ease-in-out infinite 1s; }
        @media (prefers-reduced-motion: reduce) {
          .confirm-float-a,
          .confirm-float-b { animation: none; }
        }
      `}</style>

      <div className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0">
          <div className="confirm-float-a absolute -left-28 -top-20 h-[26rem] w-[26rem] rounded-full bg-[#dcbf8f]/40 blur-[96px]" />
          <div className="confirm-float-b absolute -right-24 top-16 h-[22rem] w-[22rem] rounded-full bg-[#d8a6dc]/38 blur-[88px]" />
          <div className="confirm-float-a absolute bottom-0 left-1/3 h-[18rem] w-[18rem] rounded-full bg-[#c7dab7]/42 blur-[84px]" />
        </div>

        <header className="relative mx-auto flex max-w-[88rem] items-center justify-between px-6 pb-4 pt-6 sm:px-8">
          <Link to="/" className="inline-flex items-center">
            <img src="/stampee.svg" alt="Stampee" className="h-10 w-auto" />
          </Link>
          <Link
            to="/login"
            className="inline-flex items-center rounded-full border border-black/10 bg-white/80 px-4 py-2 text-sm font-semibold text-[#1d1d1f] transition-colors hover:bg-white"
          >
            {t("Go to login")}
          </Link>
        </header>

        <main className="relative mx-auto flex w-full max-w-[88rem] px-6 pb-20 pt-6 sm:px-8 sm:pt-10">
          <section className="w-full rounded-[2rem] border border-black/[0.08] bg-white/80 p-6 shadow-[0_24px_64px_-42px_rgba(0,0,0,0.3)] backdrop-blur-sm sm:p-10 lg:p-12">
            <div className="flex h-14 w-14 items-center justify-center rounded-[1.1rem] bg-[#efe6d5] text-[#5f4a2b]">
              <MailCheck className="h-7 w-7" strokeWidth={2.1} />
            </div>

            <p className="mt-6 text-[11px] font-semibold uppercase tracking-[0.2em] text-[#7b7264]">{t("Signup successful")}</p>
            <h1 className="mt-3 max-w-[15ch] text-[clamp(2.2rem,5vw,4rem)] font-semibold leading-[0.94] tracking-[-0.04em] text-[#171512]">
              {t("Confirm your email to finish setup.")}
            </h1>
            <p className="mt-5 max-w-[42rem] text-base leading-7 text-[#5f584b] sm:text-lg">
              {t("We sent a confirmation link to your email. Open it to activate your account, then return and log in.")}
            </p>
            {email && (
              <p className="mt-3 text-sm font-medium text-[#4a4338]">
                {t("Sent to")} <span className="font-semibold">{email}</span>
              </p>
            )}

            <div className="mt-8 grid gap-3 sm:grid-cols-3">
              {[
                "Check your inbox and spam folder.",
                "Open the email and confirm your account.",
                "Return here and sign in.",
              ].map((step) => (
                <div
                  key={step}
                  className="rounded-[1.15rem] border border-black/[0.08] bg-[#f7f3eb] px-4 py-4 text-sm leading-6 text-[#3d372d]"
                >
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#7d6339]" />
                    <span>{t(step)}</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <Button
                asChild
                className="h-12 rounded-[1rem] bg-[#1b1813] px-6 text-base font-semibold text-white shadow-none hover:bg-[#11100d]"
              >
                <Link to="/login">{t("Go to Login")}</Link>
              </Button>
              <Button
                asChild
                variant="outline"
                className="h-12 rounded-[1rem] border-black/[0.1] bg-white px-6 text-base font-semibold text-[#171512] shadow-none hover:bg-[#f8f5ef]"
              >
                <Link to="/">{t("Back to Home")}</Link>
              </Button>
            </div>
          </section>
        </main>
      </div>

      <PublicFooter />
    </div>
  );
};
