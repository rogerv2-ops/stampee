import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { LockKeyhole, ShieldAlert } from 'lucide-react';
import { Button } from './ui/button';
import { useAuth } from './AuthProvider';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { useI18n } from '../lib/i18n';

type AccessState = 'checking' | 'mfa_required' | 'authorized' | 'denied' | 'unavailable';

const PageFrame: React.FC<React.PropsWithChildren> = ({ children }) => (
  <main className="grid min-h-screen place-items-center bg-[#f7f5ef] px-4 py-10 text-[#201d18]">
    <section className="w-full max-w-lg rounded-3xl border border-black/[0.08] bg-white p-7 shadow-sm sm:p-9">
      {children}
    </section>
  </main>
);

export const PlatformAuthPage: React.FC = () => {
  const { t } = useI18n();
  const { currentUser, loading } = useAuth();
  const navigate = useNavigate();
  const currentUserId = currentUser?.id ?? null;
  const attemptedUser = useRef<string | null>(null);
  const [state, setState] = useState<AccessState>('checking');
  const [attempt, setAttempt] = useState(0);
  const [factorId, setFactorId] = useState<string | null>(null);
  const [mfaCode, setMfaCode] = useState('');
  const [mfaError, setMfaError] = useState('');
  const [submittingMfa, setSubmittingMfa] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!currentUserId) {
      attemptedUser.current = null;
      setState('denied');
      return;
    }
    if (attemptedUser.current === currentUserId) return;
    attemptedUser.current = currentUserId;
    if (!isSupabaseConfigured) {
      setState('unavailable');
      return;
    }

    let active = true;
    void (async () => {
      setState('checking');
      setFactorId(null);
      setMfaError('');
      try {
        const { data, error } = await supabase.auth.mfa.listFactors();
        if (!active) return;
        if (error) {
          setState('unavailable');
          return;
        }
        const verifiedTotp = data?.totp.find((factor) => factor.status === 'verified');
        if (!verifiedTotp) {
          setState('mfa_required');
          return;
        }
        setFactorId(verifiedTotp.id);
        setState('mfa_required');
      } catch {
        if (active) setState('unavailable');
      }
    })();
    return () => { active = false; };
  }, [attempt, currentUserId, loading]);

  const verifyMfa = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!factorId || submittingMfa) return;
    const code = mfaCode.trim();
    if (!/^\d{6}$/.test(code)) {
      setMfaError(t('Enter the six-digit code from your authenticator app.'));
      return;
    }

    setSubmittingMfa(true);
    setMfaError('');
    setMfaCode('');
    setState('checking');
    try {
      const { data, error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code });
      if (error || !data?.access_token) {
        setMfaError(t('Unable to verify the code. Check it and try again.'));
        setState('mfa_required');
        return;
      }
      const response = await fetch('/api/platform/session', {
        method: 'POST',
        credentials: 'same-origin',
        cache: 'no-store',
        headers: { Authorization: `Bearer ${data.access_token}` },
      });
      if (response.ok) {
        navigate('/platform', { replace: true });
        return;
      }
      if (response.status >= 500) setState('unavailable');
      else setState('denied');
    } catch {
      setState('unavailable');
    } finally {
      setSubmittingMfa(false);
    }
  };

  const retry = () => {
    attemptedUser.current = null;
    setFactorId(null);
    setMfaCode('');
    setMfaError('');
    setState('checking');
    setAttempt((value) => value + 1);
  };

  return (
    <PageFrame>
      <div className="mb-5 grid h-12 w-12 place-items-center rounded-2xl bg-[#f2eee5] text-[#315e57]">
        {state === 'denied' ? <ShieldAlert aria-hidden="true" /> : <LockKeyhole aria-hidden="true" />}
      </div>
      <h1 className="text-2xl font-semibold">{t('Check platform access')}</h1>
      {state === 'checking' && <p className="mt-3 text-sm text-[#625d54]" role="status">{t('Checking access…')}</p>}
      {state === 'denied' && (
        <>
          <p className="mt-3 text-sm leading-6 text-[#625d54]">{currentUser ? t('Your account is not authorized to open the platform area.') : t('Sign in with the account approved for platform access.')}</p>
          {!currentUser && (
            <Button asChild className="mt-6">
              <Link to="/login" state={{ from: { pathname: '/platform/auth' } }}>{t('Sign in to continue')}</Link>
            </Button>
          )}
        </>
      )}
      {state === 'mfa_required' && (
        <>
          <p className="mt-3 text-sm leading-6 text-[#625d54]">
            {factorId
              ? t('Enter the code from your verified authenticator app. The code is used only for this check and is not stored.')
              : t('A verified authenticator factor is required before platform access.')}
          </p>
          {factorId && (
            <form className="mt-6 space-y-4" onSubmit={(event) => void verifyMfa(event)}>
              <label className="block text-sm font-medium" htmlFor="platform-totp-code">{t('Authenticator code')}</label>
              <input
                id="platform-totp-code"
                name="platform-totp-code"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]{6}"
                maxLength={6}
                value={mfaCode}
                onChange={(event) => setMfaCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
                className="w-full rounded-xl border border-black/15 bg-white px-4 py-3 text-base tracking-[0.25em] outline-none focus:border-[#315e57]"
                aria-describedby={mfaError ? 'platform-totp-error' : undefined}
                required
              />
              {mfaError && <p id="platform-totp-error" className="text-sm text-red-700" role="alert">{mfaError}</p>}
              <Button type="submit" disabled={submittingMfa || mfaCode.length !== 6}>
                {t('Verify and continue')}
              </Button>
            </form>
          )}
        </>
      )}
      {state === 'unavailable' && (
        <>
          <p className="mt-3 text-sm leading-6 text-[#625d54]">{t('Unable to verify access right now. Please try again later.')}</p>
          <Button className="mt-6" variant="outline" onClick={retry}>{t('Verify again')}</Button>
        </>
      )}
    </PageFrame>
  );
};

export const PlatformPage: React.FC = () => {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [state, setState] = useState<AccessState>('checking');

  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      try {
        const response = await fetch('/api/platform/session', {
          method: 'GET',
          credentials: 'same-origin',
          cache: 'no-store',
          signal: controller.signal,
        });
        setState(response.ok ? 'authorized' : response.status >= 500 ? 'unavailable' : 'denied');
      } catch {
        if (!controller.signal.aborted) setState('unavailable');
      }
    })();
    return () => controller.abort();
  }, []);

  const leavePlatform = async () => {
    try {
      await fetch('/api/platform/session', { method: 'DELETE', credentials: 'same-origin', cache: 'no-store' });
    } finally {
      navigate('/', { replace: true });
    }
  };

  if (state === 'checking') return null;

  if (state === 'denied') {
    return (
      <PageFrame>
        <div className="mb-5 grid h-12 w-12 place-items-center rounded-2xl bg-[#f2eee5] text-[#315e57]"><ShieldAlert aria-hidden="true" /></div>
        <h1 className="text-2xl font-semibold">{t('Access denied')}</h1>
        <p className="mt-3 text-sm leading-6 text-[#625d54]">{t('Your account is not authorized to open the platform area.')}</p>
      </PageFrame>
    );
  }

  if (state === 'unavailable') {
    return (
      <PageFrame>
        <div className="mb-5 grid h-12 w-12 place-items-center rounded-2xl bg-[#f2eee5] text-[#315e57]"><ShieldAlert aria-hidden="true" /></div>
        <h1 className="text-2xl font-semibold">{t('Unable to verify access right now. Please try again later.')}</h1>
      </PageFrame>
    );
  }

  return (
    <PageFrame>
      <div className="mb-5 grid h-12 w-12 place-items-center rounded-2xl bg-[#f2eee5] text-[#315e57]"><LockKeyhole aria-hidden="true" /></div>
      <h1 className="text-2xl font-semibold">{t('Platform access')}</h1>
      <p className="mt-3 text-sm leading-6 text-[#625d54]">{t('No platform data or administration tools are available in this phase.')}</p>
      <Button className="mt-6" variant="outline" onClick={() => void leavePlatform()}>{t('Leave platform')}</Button>
    </PageFrame>
  );
};
