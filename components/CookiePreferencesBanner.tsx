import { useI18n } from "../lib/i18n";
import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";

type CookiePreferences = {
  essential: true;
  analytics: boolean;
  updatedAt: string;
};

const COOKIE_PREFS_KEY = "stampee_cookie_preferences_v1";

export const CookiePreferencesBanner: React.FC = () => {
  const { t, locale } = useI18n();
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(COOKIE_PREFS_KEY);
      if (!stored) {
        setIsVisible(true);
      }
    } catch {
      setIsVisible(true);
    }
  }, []);

  const savePreferences = (analytics: boolean) => {
    const payload: CookiePreferences = {
      essential: true,
      analytics,
      updatedAt: new Date().toISOString(),
    };
    try {
      window.localStorage.setItem(COOKIE_PREFS_KEY, JSON.stringify(payload));
    } catch {
      // If storage is unavailable, still hide to avoid blocking the page.
    }
    setIsVisible(false);
  };

  if (!isVisible) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-[70] px-4 pb-4 sm:px-6 lg:px-10">
      <div className="mx-auto max-w-[88rem] rounded-2xl border border-white/10 bg-[#1d1d1f]/96 p-4 text-white shadow-[0_30px_70px_-34px_rgba(0,0,0,0.65)] backdrop-blur-xl sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-4xl">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-white/70">{t("Cookie Preferences")}</p>
            <p className="mt-2 text-sm leading-6 text-white/85 sm:text-[0.95rem]">
              {t("We use cookies to enhance your experience. Essential cookies are required for the site to function.")}
              {t("Analytics cookies help us improve our service.")} {" "}
              <Link to="/cookie" className="font-semibold underline underline-offset-2 hover:text-white">
                {t("Learn more")}
              </Link>
              .
            </p>
          </div>

          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
            <button
              type="button"
              onClick={() => savePreferences(false)}
              className="h-10 rounded-full border border-white/25 px-4 text-sm font-medium text-white/90 transition-colors hover:bg-white/10"
            >
              {t("Essential Only")}
            </button>
            <button
              type="button"
              onClick={() => savePreferences(true)}
              className="h-10 rounded-full bg-white px-4 text-sm font-semibold text-[#1d1d1f] transition-colors hover:bg-white/90"
            >
              {t("Allow Analytics")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CookiePreferencesBanner;
