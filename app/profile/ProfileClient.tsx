'use client';

import { useState, useTransition } from "react";
import { Key, Lock, Shield, Loader2, CheckCircle2, AlertTriangle, Eraser } from "lucide-react";
import { useTranslation } from "react-i18next";
import { changePasswordAction } from "./actions";

type Props = {
  name: string;
  email: string;
  role: string;
};

export default function ProfileClient({ name, email, role }: Props) {
  const { t } = useTranslation();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  const initials = name
    ? name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
    : (email?.[0]?.toUpperCase() || 'U');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    startTransition(async () => {
      const res = await changePasswordAction(currentPassword, newPassword, confirmPassword);
      if (res.success) {
        setFeedback({ type: 'success', message: t('profile.passwordChanged') });
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
      } else {
        setFeedback({ type: 'error', message: res.error || t('errors.generic') });
      }
    });
  };

  const handleClear = () => {
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setFeedback(null);
  };

  const inputClass = "w-full h-12 bg-[color:var(--bg-input-solid)] border border-[color:var(--border-main)] rounded-[10px] px-4 text-body text-brand-dark outline-none focus:border-brand-primary focus:ring-[3px] focus:ring-[color:var(--focus-ring)] transition-colors placeholder:text-[color:var(--text-subtle)] disabled:opacity-50";

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

      {/* Cartão de troca de senha */}
      <div className="bg-[color:var(--bg-card-solid)] border border-[color:var(--border-main)] rounded-2xl p-8 shadow-sm space-y-6">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <Key className="w-5 h-5 text-brand-primary" />
            <h2 className="text-title font-medium text-brand-dark">{t('profile.changePassword')}</h2>
          </div>
          <p className="text-body text-[color:var(--text-muted)]">{t('profile.changePasswordHint')}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {feedback && (
            <div
              role="alert"
              className={
                feedback.type === 'success'
                  ? "border border-[#7FD171] bg-[color:var(--accent-tint)] text-brand-dark p-3.5 rounded-[10px] flex items-center gap-3"
                  : "border border-[color:var(--danger)] text-[color:var(--danger)] p-3.5 rounded-[10px] flex items-center gap-3"
              }
            >
              {feedback.type === 'success'
                ? <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                : <AlertTriangle className="w-4 h-4 flex-shrink-0" />}
              <span className="text-body font-medium leading-tight">{feedback.message}</span>
            </div>
          )}

          <div className="space-y-2">
            <label className="flex items-center gap-2 text-label font-medium text-brand-dark">
              <Lock className="w-3 h-3" />
              <span>{t('profile.currentPassword')}</span>
            </label>
            <input
              type="password"
              required
              autoComplete="current-password"
              disabled={isPending}
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="••••••••"
              className={inputClass}
            />
          </div>

          <div className="space-y-2">
            <label className="flex items-center gap-2 text-label font-medium text-brand-dark">
              <Key className="w-3 h-3" />
              <span>{t('profile.newPassword')}</span>
            </label>
            <input
              type="password"
              required
              minLength={6}
              autoComplete="new-password"
              disabled={isPending}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="••••••••"
              className={inputClass}
            />
            <p className="text-caption text-[color:var(--text-subtle)]">{t('profile.minPasswordHint')}</p>
          </div>

          <div className="space-y-2">
            <label className="flex items-center gap-2 text-label font-medium text-brand-dark">
              <Key className="w-3 h-3" />
              <span>{t('profile.confirmPassword')}</span>
            </label>
            <input
              type="password"
              required
              minLength={6}
              autoComplete="new-password"
              disabled={isPending}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="••••••••"
              className={inputClass}
            />
          </div>

          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <button
              type="button"
              onClick={handleClear}
              disabled={isPending}
              className="h-12 px-6 rounded-full border border-[color:var(--border-main)] text-body font-medium text-[color:var(--text-muted)] hover:border-[color:var(--border-strong)] hover:text-brand-dark transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <Eraser className="w-4 h-4" />
              <span>{t('common.clear')}</span>
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="flex-1 h-12 brand-bg-primary rounded-full text-body font-medium btn-premium flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>{t('common.saving')}</span>
                </>
              ) : (
                <>
                  <Key className="w-4 h-4" />
                  <span>{t('profile.savePassword')}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
