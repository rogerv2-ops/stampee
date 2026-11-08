import React, { useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { ArrowRight, Link2 } from "lucide-react";
import { AuthLayout } from "./AuthLayout";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { useAuth } from "./AuthProvider";
import { getSlugHint, isSlugValid, normalizeSlug } from "../lib/slug";
import { useI18n } from "../lib/i18n";
import { APP_ORIGIN } from "../lib/siteConfig";

const inputCls =
  "h-10 rounded-xl border-black/[0.1] bg-[#f5f5f7] text-[#1d1d1f] placeholder:text-[#6e6e73]/50 focus-visible:border-[#1d1d1f] focus-visible:ring-0";
const labelCls = "block text-[11px] font-semibold uppercase tracking-[0.16em] text-[#6e6e73]";

export const SignupClassicPage: React.FC = () => {
  const { t } = useI18n();
  const { currentUser, loading, signup, isSlugAvailable } = useAuth();
  const [businessName, setBusinessName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [slugInput, setSlugInput] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [busy, setBusy] = useState(false);
  const [slugAvailable, setSlugAvailable] = useState(false);
  const [slugChecking, setSlugChecking] = useState(false);
  const [slugCheckFailed, setSlugCheckFailed] = useState(false);

  const withTimeout = async <T,>(promise: Promise<T>, ms = 15000): Promise<T> =>
    new Promise<T>((resolve, reject) => {
      const timeoutId = window.setTimeout(() => {
        reject(new Error("Signup timed out. Please try again."));
      }, ms);
      promise
        .then((value) => {
          window.clearTimeout(timeoutId);
          resolve(value);
        })
        .catch((err) => {
          window.clearTimeout(timeoutId);
          reject(err);
        });
    });

  const normalizedSlug = normalizeSlug(slugInput);
  const slugValid = isSlugValid(normalizedSlug);
  const slugHint = getSlugHint(normalizedSlug);

  useEffect(() => {
    if (!slugTouched) {
      setSlugInput(normalizeSlug(businessName));
    }
  }, [businessName, slugTouched]);

  useEffect(() => {
    if (!slugValid) {
      setSlugAvailable(false);
      setSlugChecking(false);
      setSlugCheckFailed(false);
      return;
    }
    let cancelled = false;
    setSlugChecking(true);
    const timer = setTimeout(async () => {
      try {
        const available = await isSlugAvailable(normalizedSlug);
        if (!cancelled) {
          setSlugAvailable(available);
          setSlugCheckFailed(false);
          setSlugChecking(false);
        }
      } catch {
        if (!cancelled) {
          setSlugAvailable(false);
          setSlugCheckFailed(true);
          setSlugChecking(false);
        }
      }
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
      setSlugChecking(false);
    };
  }, [normalizedSlug, slugValid, isSlugAvailable]);

  const slugStatusLabel = !normalizedSlug
    ? ""
    : !slugValid
    ? t("Invalid")
    : slugChecking
    ? t("Checking...")
    : slugCheckFailed
    ? t("Check failed")
    : slugAvailable
    ? t("Available")
    : t("Taken");

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    setInfo("");
    if (!slugValid) {
      setError("Your public URL is invalid. Use lowercase letters, numbers, and hyphens only.");
      return;
    }
    if (!slugAvailable && !slugCheckFailed) {
      setError("That public URL is already taken.");
      return;
    }
    setBusy(true);
    try {
      const result = await withTimeout(signup({ businessName, email, password, slug: normalizedSlug }));
      if (!result.ok) {
        setError(result.error);
        return;
      }
      if (result.message) setInfo(result.message);
    } catch {
      setError("Unable to create account right now. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  if (!loading && currentUser) {
    return <Navigate to={currentUser.role === "staff" ? "/issued-cards" : "/dashboard"} replace />;
  }

  const isSubmitting = busy;
  const isDisabled = slugChecking || (!slugAvailable && !slugCheckFailed) || !slugValid || busy || loading;

  return (
    <AuthLayout
      title={t("Launch in minutes.")}
      subtitle="Set up your brand and launch a loyalty program your customers actually use."
      badge={t("Get started")}
      theme="signup"
    >
      <form className="space-y-4" onSubmit={handleSubmit}>
        <div className="mb-2">
          <h2 className="text-xl font-semibold text-[#1d1d1f]">{t("Create your workspace")}</h2>
          <p className="mt-1 text-sm text-[#6e6e73]">{t("Free to start - no credit card required.")}</p>
        </div>

        <div className="space-y-1.5">
          <label className={labelCls}>{t("Business name")}</label>
          <Input
            value={businessName}
            onChange={(e) => setBusinessName(e.target.value)}
            placeholder="The Daily Brew"
            className={inputCls}
            required
          />
        </div>

        <div className="space-y-1.5">
          <label className={labelCls}>{t("Email")}</label>
          <Input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@brand.com"
            className={inputCls}
            type="email"
            autoComplete="email"
            required
          />
        </div>

        <div className="space-y-1.5">
          <label className={labelCls}>{t("Password")}</label>
          <Input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={t("At least 8 characters")}
            className={inputCls}
            type="password"
            autoComplete="new-password"
            required
          />
        </div>

        <div className="space-y-2 rounded-2xl border border-black/[0.07] bg-[#f5f5f7] p-3">
          <div className="flex items-center justify-between">
            <label className={labelCls}>{t("Your public URL")}</label>
            {normalizedSlug && (
              <span
                className={`text-[11px] font-semibold ${
                  slugAvailable
                    ? "text-emerald-600"
                    : slugCheckFailed
                    ? "text-amber-600"
                    : "text-red-500"
                }`}
              >
                {slugStatusLabel}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 rounded-xl border border-black/[0.1] bg-white px-4 py-3 focus-within:border-[#1d1d1f]">
            <Link2 className="h-4 w-4 shrink-0 text-[#6e6e73]" />
            <span className="shrink-0 text-sm font-medium text-[#6e6e73]">{APP_ORIGIN.replace(/^https?:\/\//, "")}/</span>
            <input
              value={normalizedSlug}
              onChange={(e) => {
                setSlugTouched(true);
                setSlugInput(e.target.value);
              }}
              className="min-w-0 flex-1 bg-transparent font-mono text-sm text-[#1d1d1f] outline-none placeholder:text-[#6e6e73]/50"
              placeholder={t("yourbrand")}
              required
            />
          </div>

          <p className="text-xs text-[#6e6e73]">
            {t(slugHint)} {t("Lowercase letters, numbers, and hyphens only.")}
          </p>
          {slugCheckFailed && (
            <p className="text-xs text-amber-700">
              {t("Could not verify URL availability right now. You can still continue.")}
            </p>
          )}
        </div>

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
            {t(error)}
          </div>
        )}
        {info && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            {t(info)}
          </div>
        )}

        <Button
          type="submit"
          disabled={isDisabled}
          className="h-11 w-full rounded-full bg-[#1d1d1f] text-sm font-medium text-white shadow-sm hover:bg-black/80 disabled:opacity-40"
        >
          {isSubmitting ? t("Creating...") : t("Create Workspace")}
          {!isSubmitting && <ArrowRight className="ml-2 h-4 w-4" />}
        </Button>
        {loading && !busy && (
          <p className="text-center text-xs text-[#6e6e73]">{t("Checking existing session...")}</p>
        )}

        <p className="text-center text-sm text-[#6e6e73]">
          {t("Already have an account?")} {" "}
          <Link to="/login" className="font-semibold text-[#1d1d1f] underline-offset-2 hover:underline">
            {t("Log in")}
          </Link>
        </p>
      </form>
    </AuthLayout>
  );
};
