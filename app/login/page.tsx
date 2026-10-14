'use client';

import { useState } from "react";
import { signIn } from "next-auth/react";
import { Shield, Mail, Lock, Loader2, AlertCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import LanguageToggle from "@/components/LanguageToggle";

export default function LoginPage() {
  const router = useRouter();
  const { t } = useTranslation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        setError(t('login.invalidCredentials'));
      } else {
        // Force a full page reload to the root to ensure session is picked up
        window.location.href = "/";
      }
    } catch (err) {
      setError(t('login.genericError'));
    } finally {
      setLoading(false);
    }
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
        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div role="alert" className="border border-[color:var(--danger)] text-[color:var(--danger)] p-3.5 rounded-[10px] flex items-center gap-3 animate-in shake duration-300">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span className="text-body font-medium leading-tight">{error}</span>
            </div>
          )}

          <div className="space-y-2">
            <label className="flex items-center gap-2 text-label font-medium text-brand-dark">
              <Mail className="w-3 h-3" />
              <span>{t('login.corporateEmail')}</span>
            </label>
            <input 
              type="email" 
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t('login.emailPlaceholder')}
              className="w-full h-12 bg-white border border-slate-300 rounded-[10px] px-4 text-body text-brand-dark outline-none focus:border-brand-primary focus:ring-[3px] focus:ring-[color:var(--focus-ring)] transition-colors placeholder:text-slate-500"
            />
          </div>

          <div className="space-y-2">
            <label className="flex items-center gap-2 text-label font-medium text-brand-dark">
              <Lock className="w-3 h-3" />
              <span>{t('login.yourPassword')}</span>
            </label>
            <input 
              type="password" 
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full h-12 bg-white border border-slate-300 rounded-[10px] px-4 text-body text-brand-dark outline-none focus:border-brand-primary focus:ring-[3px] focus:ring-[color:var(--focus-ring)] transition-colors placeholder:text-slate-500"
            />
          </div>

          <button 
            type="submit"
            disabled={loading}
            className="w-full h-12 brand-bg-primary rounded-full text-body font-medium btn-premium flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>{t('login.authenticating')}</span>
              </>
            ) : (
              <>
                <Shield className="w-4 h-4" />
                <span>{t('login.signIn')}</span>
              </>
            )}
          </button>
        </form>
        
        <div className="flex items-center justify-center gap-2 text-slate-500">
          <Shield className="w-3 h-3" />
          <span className="text-caption">{t('login.dataProtection')}</span>
        </div>
      </div>
    </div>
  );
}
