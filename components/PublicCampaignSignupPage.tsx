import React, { useEffect, useState } from 'react';
import { useI18n } from "../lib/i18n";
import { useNavigate, useParams } from 'react-router-dom';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Button } from './ui/button';
import { fetchPublicCampaignSignupContext, registerPublicCampaignSignup } from '../lib/db/publicSignup';
import { isSupabaseConfigured } from '../lib/supabase';

const SERVICE_UNAVAILABLE_MESSAGE = 'Service is temporarily unavailable. Please try again later.';

export const PublicCampaignSignupPage: React.FC = () => {
  const navigate = useNavigate();
  const { t, locale } = useI18n();
  const { slug, campaignId } = useParams<{ slug: string; campaignId: string }>();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [preRedirectMessage, setPreRedirectMessage] = useState('');
  const [error, setError] = useState('');
  const [context, setContext] = useState<Awaited<ReturnType<typeof fetchPublicCampaignSignupContext>>>(null);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [mobile, setMobile] = useState('');

  useEffect(() => {
    if (!isSupabaseConfigured || !slug || !campaignId) {
      setLoading(false);
      return;
    }

    let active = true;
    void (async () => {
      const payload = await fetchPublicCampaignSignupContext(slug, campaignId);
      if (!active) return;
      setContext(payload);
      setLoading(false);
    })();

    return () => {
      active = false;
    };
  }, [campaignId, slug]);

  const disabled = context?.campaign.isEnabled === false;
  const isShowingPreRedirectLoader = preRedirectMessage.length > 0;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');

    const trimmedName = name.trim();
    if (!trimmedName) {
      setError(t("Name is required."));
      return;
    }
    if (!slug || !campaignId) {
      setError(t("Invalid signup link."));
      return;
    }

    setSubmitting(true);
    const result = await registerPublicCampaignSignup({
      slug,
      campaignId,
      name: trimmedName,
      email,
      mobile,
    });

    if (result.outcome === 'issued' || result.outcome === 'redirect_existing') {
      setPreRedirectMessage(
        result.outcome === 'issued'
          ? t("Generating your loyalty card. Please wait...")
          : t("Redirecting to your loyalty card. Please wait...")
      );
      await new Promise((resolve) => setTimeout(resolve, 900));
      navigate(`/${slug}/${result.uniqueId}`, { replace: true });
      return;
    }

    setSubmitting(false);

    if (result.outcome === 'campaign_disabled_no_existing') {
      setError(t("New signups are paused for this campaign. If you already have an in-progress card, enter the same email or mobile number you used before."));
      return;
    }

    setError(result.error);
  };

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!isSupabaseConfigured) {
    return (
      <div className="h-screen flex items-center justify-center px-6 text-center text-muted-foreground">
        {t(SERVICE_UNAVAILABLE_MESSAGE)}
      </div>
    );
  }

  if (!context) {
    return (
      <div className="h-screen flex items-center justify-center px-6 text-center text-muted-foreground">
        {t("Campaign signup link is invalid.")}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f5f5f7] px-4 py-10 sm:px-6 sm:py-14">
      {isShowingPreRedirectLoader && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/90 px-6 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl border border-black/10 bg-white p-6 text-center shadow-[0_18px_52px_-36px_rgba(0,0,0,0.45)]">
            <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-[#1d1d1f] border-t-transparent" />
            <p className="mt-4 text-sm font-medium text-[#1d1d1f]" aria-live="polite">
              {preRedirectMessage}
            </p>
            <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-[#efeff1]">
              <div className="h-full w-full origin-left animate-pulse rounded-full bg-[#1d1d1f]" />
            </div>
          </div>
        </div>
      )}
      <div className="mx-auto w-full max-w-xl">
        <section className="rounded-[2rem] border border-black/[0.08] bg-white p-6 shadow-[0_24px_64px_-38px_rgba(0,0,0,0.35)] sm:p-8">
          <p className="text-[0.68rem] font-semibold uppercase tracking-[0.26em] text-[#6e6e73]">{t("Loyalty Signup")}</p>
          <h1 className="mt-3 text-[clamp(1.9rem,5vw,2.7rem)] font-black leading-[0.96] tracking-[-0.03em] text-[#1d1d1f]">
            {context.owner.businessName}
          </h1>
          <p className="mt-3 text-[0.98rem] leading-7 text-[#4f5258]">
            {t("Join {name} to start collecting stamps.", { name: context.campaign.name })}
          </p>

          {disabled && (
            <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-800">
              {t("New signups are currently paused for this campaign. If you already have an in-progress card, enter the same email or mobile to continue.")}
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-6 space-y-5">
            <div className="grid gap-2">
              <Label htmlFor="name" className="text-sm font-medium text-[#1d1d1f]">{t("Name")} <span className="text-[#d73a49]">*</span>
              </Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t("Your full name")}
                autoComplete="name"
                required
                className="h-12 rounded-xl border-black/10 text-[#1d1d1f] placeholder:text-[#8f9197]"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="email" className="text-sm font-medium text-[#1d1d1f]">{t("Email")} <span className="text-[#6e6e73]">{t("(Optional)")}</span>
              </Label>
              <Input
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                autoComplete="email"
                type="email"
                className="h-12 rounded-xl border-black/10 text-[#1d1d1f] placeholder:text-[#8f9197]"
              />
              <p className="text-xs leading-5 text-[#6e6e73]">{t("Used for card recovery and reward updates.")}</p>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="mobile" className="text-sm font-medium text-[#1d1d1f]">{t("Mobile Number")} <span className="text-[#6e6e73]">{t("(Optional)")}</span>
              </Label>
              <Input
                id="mobile"
                value={mobile}
                onChange={(e) => setMobile(e.target.value)}
                placeholder={t("09xxxxxxxxx")}
                autoComplete="tel"
                className="h-12 rounded-xl border-black/10 text-[#1d1d1f] placeholder:text-[#8f9197]"
              />
              <p className="text-xs leading-5 text-[#6e6e73]">{t("Helps staff find your card quickly.")}</p>
            </div>

            {error && (
              <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {error}
              </div>
            )}

            <Button
              type="submit"
              className="h-12 w-full rounded-xl bg-[#1d1d1f] text-sm font-semibold text-white hover:bg-black/85"
              disabled={submitting}
            >
              {submitting ? t("Checking your card...") : t("Get My Loyalty Card")}
            </Button>
          </form>
        </section>
      </div>
    </div>
  );
};
