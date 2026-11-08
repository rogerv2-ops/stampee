import React, { useEffect, useState } from "react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { AuthSplitLayout } from "./AuthSplitLayout";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { useAuth } from "./AuthProvider";
import { buildIssuedCardsKioskUrl } from "../lib/links";
import { useI18n } from "../lib/i18n";

const inputCls =
  "h-14 rounded-[1.2rem] border border-black/[0.08] bg-[#f4f1ea] px-4 text-[15px] text-[#171512] shadow-none placeholder:text-[#8a8276] focus-visible:border-black/25 focus-visible:bg-white focus-visible:ring-0";
const labelCls = "block text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-[#777062]";

export const StaffLoginPage: React.FC = () => {
  const { t } = useI18n();
  const { currentUser, loginStaff } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const kioskId = searchParams.get("kiosk") ?? "";
  const [email, setEmail] = useState("");
  const [pin, setPin] = useState("");
  const [orgId, setOrgId] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const withTimeout = async <T,>(promise: Promise<T>, ms = 15000): Promise<T> =>
    new Promise<T>((resolve, reject) => {
      const timeoutId = window.setTimeout(() => {
        reject(new Error("Login timed out. Please try again."));
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

  useEffect(() => {
    const orgParam = searchParams.get("id") ?? "";
    if (orgParam) {
      setOrgId(orgParam);
    }
  }, [searchParams]);

  if (currentUser) {
    return <Navigate to={kioskId ? buildIssuedCardsKioskUrl(kioskId) : "/issued-cards"} replace />;
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      const result = await withTimeout(loginStaff(email, pin, orgId));
      if (!result.ok) {
        setError(result.error);
        return;
      }
      navigate(kioskId ? buildIssuedCardsKioskUrl(kioskId) : "/issued-cards");
    } catch {
      setError("Unable to log in right now. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const hasPrefilledOrgId = Boolean(searchParams.get("id"));

  return (
    <AuthSplitLayout
      title={t("Staff portal")}
      subtitle={t("Log in with your email, PIN, and Org ID to issue cards, scan kiosk traffic, and keep the line moving.")}
      badge={t("Team access")}
      mode="staff"
    >
      <form className="space-y-5" onSubmit={handleSubmit}>
        <p className="text-sm leading-6 text-[#6d6658]">
          {t("Staff credentials remain separate from owner login and stay tied to the correct business Org ID.")}
        </p>

        {kioskId && (
          <div className="rounded-[1.35rem] border border-black/[0.08] bg-[#fbf3e6] px-4 py-4 text-sm text-[#6a5845]">
            {t("Kiosk session detected. After login you will be sent straight into the scan flow for this device.")}
          </div>
        )}

        <div className="space-y-1.5">
          <label className={labelCls}>{t("Email")}</label>
          <Input
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@brand.com"
            className={inputCls}
            type="email"
            autoComplete="email"
            required
          />
        </div>

        <div className="space-y-1.5">
          <label className={labelCls}>{t("PIN")}</label>
          <Input
            value={pin}
            onChange={(event) => setPin(event.target.value)}
            placeholder={t("4-6 digits")}
            className={inputCls}
            type="password"
            inputMode="numeric"
            maxLength={6}
            required
          />
        </div>

        <div className="space-y-1.5">
          <label className={labelCls}>{t("Org ID")}</label>
          <Input
            value={orgId}
            onChange={(event) => setOrgId(event.target.value)}
            placeholder={t("owner business ID")}
            className={`${inputCls} font-mono`}
            required
            disabled={hasPrefilledOrgId}
          />
          <p className="text-xs leading-6 text-[#6d6658]">
            {hasPrefilledOrgId
              ? t("This Org ID was pre-filled from your staff portal link.")
              : t("Ask your owner for the Org ID from Settings if you do not already have the portal link.")}
          </p>
        </div>

        {error && (
          <div className="rounded-[1.2rem] border border-red-200 bg-red-50/90 px-4 py-3 text-sm text-red-600">
            {t(error)}
          </div>
        )}

        <Button
          type="submit"
          className="h-14 w-full rounded-[1.2rem] bg-[#1b1813] text-base font-semibold text-white shadow-none hover:bg-[#11100d]"
          disabled={busy}
        >
          {busy ? t("Logging in...") : t("Log in as Staff")}
          {!busy && <ArrowRight className="ml-2 h-4 w-4" />}
        </Button>

        <div className="rounded-[1.35rem] border border-black/[0.08] bg-[#f5f1e8] px-4 py-4 text-sm text-[#6d6658]">
          {t("Owner login?")}{" "}
          <Link to="/login" className="font-semibold text-[#171512] underline-offset-2 hover:underline">
            {t("Go to main login")}
          </Link>
        </div>
      </form>
    </AuthSplitLayout>
  );
};
