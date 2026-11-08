import React, { useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { AuthLayout } from "./AuthLayout";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { useAuth } from "./AuthProvider";
import { useI18n } from "../lib/i18n";

const inputCls =
  "h-12 rounded-xl border-black/[0.1] bg-[#f5f5f7] text-[#1d1d1f] placeholder:text-[#6e6e73]/50 focus-visible:border-[#1d1d1f] focus-visible:ring-0";
const labelCls = "block text-[11px] font-semibold uppercase tracking-[0.16em] text-[#6e6e73]";

export const ForgotPasswordPage: React.FC = () => {
  const { t } = useI18n();
  const { currentUser, resetPassword } = useAuth();
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  if (currentUser) {
    return <Navigate to="/settings" replace />;
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    if (!email.trim()) {
      setError("Please enter your email address.");
      return;
    }
    setBusy(true);
    const result = await resetPassword(email.trim());
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setSent(true);
  };

  if (sent) {
    return (
      <AuthLayout
        title={t("Check your inbox.")}
        subtitle="We sent a password reset link to your email."
        badge="Done"
        theme="login"
      >
        <div className="space-y-6 text-center">
          <div className="flex justify-center">
            <CheckCircle2 className="h-14 w-14 text-green-500" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-[#1d1d1f]">{t("Reset link sent!")}</h2>
            <p className="mt-1 text-sm text-[#6e6e73]">
              {t("Check {email} for a password reset link.", { email })}
            </p>
          </div>
          <Link
            to="/login"
            className="inline-flex h-12 w-full items-center justify-center rounded-full bg-[#1d1d1f] text-base font-medium text-white shadow-sm hover:bg-black/80"
          >
            {t("Back to Sign In")}
            <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title={t("Forgot your password?")}
      subtitle="Enter your account email and we'll send you a reset link."
      badge="Reset password"
      theme="login"
    >
      <form className="space-y-5" onSubmit={handleSubmit}>
        <div className="mb-2">
          <h2 className="text-xl font-semibold text-[#1d1d1f]">{t("Find your account")}</h2>
          <p className="mt-1 text-sm text-[#6e6e73]">{t("Enter the email you used to sign up.")}</p>
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

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
            {t(error)}
          </div>
        )}

        <Button
          type="submit"
          disabled={busy}
          className="h-12 w-full rounded-full bg-[#1d1d1f] text-base font-medium text-white shadow-sm hover:bg-black/80"
        >
          {busy ? t("Sending...") : t("Send Reset Link")}
          {!busy && <ArrowRight className="ml-2 h-4 w-4" />}
        </Button>

        <p className="text-center text-sm text-[#6e6e73]">
          {t("Remember your password?")}{" "}
          <Link to="/login" className="font-semibold text-[#1d1d1f] underline-offset-2 hover:underline">
            {t("Sign in")}
          </Link>
        </p>
      </form>
    </AuthLayout>
  );
};
