'use client';

import { useState } from "react";
import { signIn } from "next-auth/react";
import { Shield, Zap, Mail, Lock, Loader2, AlertCircle } from "lucide-react";
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
    <div className="flex flex-col items-center justify-center min-h-[80vh] space-y-12 animate-in fade-in duration-700">
      <div className="text-center space-y-4">
        <div className="flex justify-center mb-4">
          <LanguageToggle />
        </div>
        <div className="flex justify-center mb-8">
          <div className="brand-bg-primary p-6 rounded-[2.5rem] shadow-2xl shadow-green-900/20 rotate-3 hover:rotate-0 transition-all duration-500">
            <Zap className="w-12 h-12 text-white" />
          </div>
        </div>
        <h1 className="text-5xl font-black text-brand-dark tracking-tighter uppercase font-heading leading-tight">
          PRE-SALES<span className="text-brand-accent">.AI</span>
        </h1>
        <p className="text-slate-400 text-[10px] font-black uppercase tracking-[0.4em]">{t('login.restrictedAccess')}</p>
      </div>

      <div className="w-full max-w-md bg-white dark:bg-[#0a0a0a] p-10 rounded-[3rem] border border-slate-200 dark:border-[#1f1f1f] shadow-2xl space-y-8">
        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="bg-red-50 dark:bg-[#3b1414] border border-red-100 dark:border-[#5a1e1e] text-red-600 dark:text-[#ff7676] p-4 rounded-2xl flex items-center space-x-3 animate-in shake duration-300">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span className="text-[10px] font-black uppercase tracking-widest leading-tight">{error}</span>
            </div>
          )}

          <div className="space-y-2">
            <label className="flex items-center space-x-2 text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
              <Mail className="w-3 h-3" />
              <span>{t('login.corporateEmail')}</span>
            </label>
            <input 
              type="email" 
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t('login.emailPlaceholder')}
              className="w-full bg-slate-50 dark:bg-[#141414] dark:text-[#ffffff] dark:border-[#1f1f1f] border border-slate-200 rounded-2xl px-6 py-4 text-sm font-bold focus:ring-2 focus:ring-brand-primary dark:focus:bg-[#0a0a0a] focus:bg-white outline-none transition-all placeholder:text-slate-300 dark:placeholder:text-[#5e5e5e]"
            />
          </div>

          <div className="space-y-2">
            <label className="flex items-center space-x-2 text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
              <Lock className="w-3 h-3" />
              <span>{t('login.yourPassword')}</span>
            </label>
            <input 
              type="password" 
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full bg-slate-50 dark:bg-[#141414] dark:text-[#ffffff] dark:border-[#1f1f1f] border border-slate-200 rounded-2xl px-6 py-4 text-sm font-bold focus:ring-2 focus:ring-brand-primary dark:focus:bg-[#0a0a0a] focus:bg-white outline-none transition-all placeholder:text-slate-300 dark:placeholder:text-[#5e5e5e]"
            />
          </div>

          <button 
            type="submit"
            disabled={loading}
            className="w-full bg-brand-dark dark:bg-[#141414] text-white dark:text-[#ffffff] p-6 rounded-2xl font-black text-[10px] uppercase tracking-[0.3em] shadow-xl dark:shadow-black/50 dark:border dark:border-[#1f1f1f] hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center space-x-4 disabled:opacity-50 disabled:scale-100"
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
        
        <div className="pt-4 flex items-center justify-center space-x-2 text-slate-300 dark:text-[#5e5e5e]">
          <Shield className="w-3 h-3" />
          <span className="text-[8px] font-black uppercase tracking-widest">{t('login.dataProtection')}</span>
        </div>
      </div>
    </div>
  );
}
