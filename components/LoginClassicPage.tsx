import React, { useState } from "react";
import { Link, Navigate, useLocation } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { AuthLayout } from "./AuthLayout";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { useAuth } from "./AuthProvider";
import { DEMO_WORKSPACE_ENABLED } from "../lib/siteConfig";
import { useI18n } from "../lib/i18n";

const inputCls =
  "h-12 rounded-xl border-black/[0.1] bg-[#f5f5f7] text-[#1d1d1f] placeholder:text-[#6e6e73]/50 focus-visible:border-[#1d1d1f] focus-visible:ring-0";
const labelCls = "block text-[11px] font-semibold uppercase tracking-[0.16em] text-[#6e6e73]";

export const LoginClassicPage: React.FC = () => {
  const { t } = useI18n();
  const { currentUser, loading, login, loginDemo } = useAuth();
  const location = useLocation();
  const fromPath = (location.state as { from?: { pathname?: string } })?.from?.pathname;
  const showDemoWorkspace = DEMO_WORKSPACE_ENABLED && new URLSearchParams(location.search).get("admin") === "pogi";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const withTimeout = async <T,>(promise: Promise<T>, ms = 15000): Promise<T> =>
    new Promise<T>((resolve, reject) => {
      const timeoutId = window.setTimeout(() => {
        reject(new Error("Sign in timed out. Please try again."));
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

  if (!loading && currentUser) {
    return <Navigate to={fromPath ?? (currentUser.role === "staff" ? "/issued-cards" : "/dashboard")} replace />;
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      const result = await withTimeout(login(email, password));
      if (!result.ok) {
        setError(result.error);
      }
    } catch {
      setError("Unable to sign in right now. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const handleDemo = async () => {
    setBusy(true);
    setError("");
    try {
      await withTimeout(loginDemo());
    } catch {
      setError("Unable to sign in to demo right now. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const isSubmitting = busy;
  const isDisabled = busy || loading;

  return (
    <AuthLayout
      title={t("Welcome back.")}
      subtitle={t("Manage campaigns, issue stamps, and track loyalty performance in real time.")}
      badge={t("Sign in")}
      theme="login"
    >
      <form className="space-y-5" onSubmit={handleSubmit}>
        <div className="mb-2">
          <h2 className="text-xl font-semibold text-[#1d1d1f]">{t("Sign in to your account")}</h2>
          <p className="mt-1 text-sm text-[#6e6e73]">{t("Enter your credentials below to continue.")}</p>
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
          <div className="flex items-center justify-between">
            <label className={labelCls}>{t("Password")}</label>
            <Link
              to="/forgot-password"
              className="text-[11px] text-[#6e6e73] underline-offset-2 hover:underline hover:text-[#1d1d1f]"
            >
              {t("Forgot password?")}
            </Link>
          </div>
          <Input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={t("Your password")}
            className={inputCls}
            type="password"
            autoComplete="current-password"
            required
          />
        </div>

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
            {t(error)}
          </div>
        )}

        <Button
          type="submit"
          disabled={isDisabled}
          className="h-12 w-full rounded-full bg-[#1d1d1f] text-base font-medium text-white shadow-sm hover:bg-black/80"
        >
          {isSubmitting ? t("Signing in...") : <>{t("Continue")} <ArrowRight className="ml-2 h-4 w-4" /></>}
        </Button>
        {loading && !busy && (
          <p className="text-center text-xs text-[#6e6e73]">{t("Checking existing session...")}</p>
        )}

        {showDemoWorkspace && (
          <>
            <div className="relative py-1">
              <div className="border-t border-black/[0.08]" />
              <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-white px-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#6e6e73]">{t("or")}
              </span>
            </div>

            <Button
              type="button"
              variant="outline"
              disabled={isDisabled}
              className="h-12 w-full rounded-full border-black/[0.1] bg-white text-base font-medium text-[#1d1d1f] hover:bg-[#f5f5f7]"
              onClick={handleDemo}
            >
              {t("Try Demo Workspace")}
            </Button>
          </>
        )}

        <p className="text-center text-sm text-[#6e6e73]">
          {t("New here?")}{" "}
          <Link to="/signup" className="font-semibold text-[#1d1d1f] underline-offset-2 hover:underline">
            {t("Create your workspace")}
          </Link>
        </p>
      </form>
    </AuthLayout>
  );
};
