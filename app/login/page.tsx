'use client';

import { useEffect, useState } from "react";
import { getProviders, signIn } from "next-auth/react";
import { Shield, Loader2, AlertCircle } from "lucide-react";
import { useTranslation } from "react-i18next";
import LanguageToggle from "@/components/LanguageToggle";

/**
 * Login só com Google (SSO @aktienow.com). As regras ficam em lib/auth.ts;
 * recusas voltam para /login?error=<código>.
 */
export default function LoginPage() {
  const { t } = useTranslation();
  const [error, setError] = useState("");
  const [providersLoaded, setProvidersLoaded] = useState(false);
  const [googleEnabled, setGoogleEnabled] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  useEffect(() => {
    getProviders()
      .then((p) => setGoogleEnabled(Boolean(p?.google)))
      .catch(() => {})
      .finally(() => setProvidersLoaded(true));
    const code = new URLSearchParams(window.location.search).get('error');
    if (code) setError(ssoErrorMessage(code));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function ssoErrorMessage(code: string) {
    if (code === 'SsoDomain') return t('login.ssoDomain');
    if (code === 'SsoNotRegistered' || code === 'AccessDenied') return t('login.ssoNotRegistered');
    return t('login.ssoGenericError');
  }

  const handleGoogle = () => {
    setGoogleLoading(true);
    setError("");
    void signIn("google", { callbackUrl: "/" });
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] gap-10 animate-in fade-in duration-700">
      <div className="text-center flex flex-col items-center gap-4">
        <LanguageToggle />
        <h1 className="text-brand-dark font-heading text-[clamp(48px,7vw,72px)] leading-[0.95]">
          Tool <span className="text-brand-primary">Center</span>
        </h1>
        <p className="text-slate-500 text-body">{t('login.restrictedAccess')}</p>
      </div>

      <div className="w-full max-w-md bg-white p-8 rounded-2xl border border-slate-200 shadow-sm space-y-6">
        {error && (
          <div role="alert" className="border border-[color:var(--danger)] text-[color:var(--danger)] p-3.5 rounded-[10px] flex items-center gap-3 animate-in shake duration-300">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span className="text-body font-medium leading-tight">{error}</span>
          </div>
        )}

        {providersLoaded && !googleEnabled ? (
          <div role="alert" className="border border-[color:var(--danger)] text-[color:var(--danger)] p-3.5 rounded-[10px] flex items-center gap-3">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span className="text-body font-medium leading-tight">{t('login.ssoNotConfigured')}</span>
          </div>
        ) : (
          <button
            type="button"
            onClick={handleGoogle}
            disabled={googleLoading || !providersLoaded}
            className="w-full h-12 brand-bg-primary rounded-full text-body font-medium btn-premium flex items-center justify-center gap-3 disabled:opacity-50"
          >
            {googleLoading || !providersLoaded ? <Loader2 className="w-4 h-4 animate-spin" /> : <span className="bg-[#ffffff] rounded-full p-1 flex"><GoogleIcon /></span>}
            <span>{t('login.signInWithGoogle')}</span>
          </button>
        )}

        <p className="text-caption text-slate-500 text-center">{t('login.ssoHint')}</p>

        <div className="flex items-center justify-center gap-2 text-slate-500">
          <Shield className="w-3 h-3" />
          <span className="text-caption">{t('login.dataProtection')}</span>
        </div>
      </div>
    </div>
  );
}

/** Logo "G" do Google (cores oficiais), sem dependência externa. */
function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}
