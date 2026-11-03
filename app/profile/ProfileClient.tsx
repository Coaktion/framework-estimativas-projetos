'use client';

import { Shield } from "lucide-react";
import { useTranslation } from "react-i18next";

type Props = {
  name: string;
  email: string;
  role: string;
  /** Cartões extras abaixo do aviso de login (ex.: chaves de API). */
  children?: React.ReactNode;
};

export default function ProfileClient({ name, email, role, children }: Props) {
  const { t } = useTranslation();
  const initials = name
    ? name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
    : (email?.[0]?.toUpperCase() || 'U');

  return (
    <div className="max-w-2xl mx-auto py-10 px-4 flex flex-col gap-8 animate-in fade-in duration-500">
      {/* Cabeçalho do perfil */}
      <div className="flex items-center gap-5">
        <div className="w-16 h-16 rounded-2xl bg-brand-soft text-brand-soft-fg flex items-center justify-center text-[22px] font-bold shrink-0">
          {initials}
        </div>
        <div className="min-w-0">
          <span className="text-caption uppercase tracking-[0.22em] text-[color:var(--text-subtle)]">
            {t('profile.titleAccent')}
          </span>
          <h1 className="text-brand-dark font-heading text-[clamp(30px,4vw,42px)] leading-tight truncate">
            {name || email}
          </h1>
          <p className="text-body text-[color:var(--text-muted)] truncate">{email}</p>
        </div>
        {role && (
          <span className="ml-auto hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100 text-caption font-bold uppercase tracking-[0.18em] shrink-0">
            <Shield className="w-3 h-3" />
            {role}
          </span>
        )}
      </div>

      {/* Login só com Google: não há senha para trocar. */}
      <div className="bg-[color:var(--bg-card-solid)] border border-[color:var(--border-main)] rounded-2xl p-8 shadow-sm space-y-2">
        <div className="flex items-center gap-3">
          <Shield className="w-5 h-5 text-brand-primary" />
          <h2 className="text-title font-medium text-brand-dark">{t('profile.googleOnlyTitle')}</h2>
        </div>
        <p className="text-body text-[color:var(--text-muted)]">{t('profile.googleOnlyHint')}</p>
      </div>

      {children}
    </div>
  );
}
