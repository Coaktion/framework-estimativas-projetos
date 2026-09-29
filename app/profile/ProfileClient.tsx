'use client';

import { useState, useTransition, FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Key, CheckCircle2, AlertTriangle, Loader2, Shield } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { changePasswordAction } from './actions';

export default function ProfileClient({
  email,
  name,
  role,
}: {
  email?: string | null;
  name?: string | null;
  role?: string | null;
}) {
  const { t } = useTranslation();
  const router = useRouter();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  const initials = name
    ? name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
    : email?.[0].toUpperCase() || 'U';

  const reset = () => {
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    startTransition(async () => {
      const res = await changePasswordAction({ currentPassword, newPassword, confirmPassword });
      if (res?.success) {
        setFeedback({ type: 'success', message: t('profile.passwordChanged', 'Senha alterada com sucesso.') });
        reset();
        router.refresh();
      } else {
        setFeedback({ type: 'error', message: res?.error || t('errors.generic', 'Erro inesperado.') });
      }
    });
  };

  return (
    <div className="max-w-3xl mx-auto py-16 px-6 space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex flex-col md:flex-row items-start md:items-center gap-8">
        <div className="w-24 h-24 rounded-[2.5rem] brand-bg-primary flex items-center justify-center text-2xl font-black text-white shadow-2xl">
          {initials}
        </div>
        <div className="space-y-2">
          <p className="inline-flex items-center gap-2 px-3 py-1 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border border-indigo-100 dark:border-indigo-500/30">
            <Shield className="w-3 h-3" />
            <span className="text-[8px] font-black uppercase tracking-[0.22em]">
              {role || t('userMenu.member', 'Membro')}
            </span>
          </p>
          <h1 className="text-5xl font-black text-brand-dark dark:text-[color:var(--text-main)] tracking-tighter font-heading uppercase leading-none">
            {name || t('userMenu.user', 'Usuário')}{' '}
            <span className="text-brand-primary dark:text-[color:var(--primary)]">
              {t('profile.titleAccent', 'Profile')}
            </span>
          </h1>
          <p className="text-slate-500 dark:text-[color:var(--text-muted)] text-xs font-bold uppercase tracking-[0.2em]">
            {email}
          </p>
        </div>
      </div>

      <div className="bg-[#FFFFFF] dark:bg-[color:var(--bg-card-solid)] rounded-[3rem] border border-slate-300 dark:border-[color:var(--border-main)] shadow-2xl overflow-hidden">
        <div className="px-12 py-8 border-b border-slate-100 dark:border-[color:var(--border-main)] flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl brand-bg-primary flex items-center justify-center text-white shadow-lg">
            <Key className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-2xl font-black text-brand-dark dark:text-[color:var(--text-main)] font-heading uppercase tracking-tight">
              {t('profile.changePassword', 'Alterar Senha')}
            </h2>
            <p className="text-[10px] font-bold text-slate-400 dark:text-[color:var(--text-muted)] uppercase tracking-widest mt-1">
              {t('profile.changePasswordHint', 'Atualize periodicamente para manter sua conta segura.')}
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-12 space-y-8">
          <div className="grid grid-cols-1 gap-6">
            <div>
              <label className="block text-[9px] font-black text-slate-400 dark:text-[color:var(--text-muted)] uppercase tracking-widest ml-1 mb-2.5">
                {t('profile.currentPassword', 'Senha Atual')}
              </label>
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                disabled={isPending}
                placeholder="••••••••"
                className="w-full bg-slate-50 dark:bg-[color:var(--bg-input-solid)] border border-slate-200 dark:border-[color:var(--border-main)] text-brand-dark dark:text-[color:var(--text-main)] rounded-[1.5rem] pl-6 pr-6 py-4 text-sm font-bold outline-none focus:ring-2 focus:ring-brand-primary/20 dark:focus:ring-[color:var(--primary)]/20 focus:border-brand-primary dark:focus:border-[color:var(--primary)] transition-all placeholder:text-slate-300 dark:placeholder:text-[color:var(--text-muted)] disabled:opacity-50"
                required
              />
            </div>

            <div>
              <label className="block text-[9px] font-black text-slate-400 dark:text-[color:var(--text-muted)] uppercase tracking-widest ml-1 mb-2.5">
                {t('profile.newPassword', 'Nova Senha')}
              </label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                disabled={isPending}
                placeholder="••••••••"
                className="w-full bg-slate-50 dark:bg-[color:var(--bg-input-solid)] border border-slate-200 dark:border-[color:var(--border-main)] text-brand-dark dark:text-[color:var(--text-main)] rounded-[1.5rem] pl-6 pr-6 py-4 text-sm font-bold outline-none focus:ring-2 focus:ring-brand-primary/20 dark:focus:ring-[color:var(--primary)]/20 focus:border-brand-primary dark:focus:border-[color:var(--primary)] transition-all placeholder:text-slate-300 dark:placeholder:text-[color:var(--text-muted)] disabled:opacity-50"
                minLength={6}
                required
              />
              <p className="text-[8px] font-black text-slate-400 dark:text-[color:var(--text-muted)] uppercase tracking-widest mt-2 ml-1">
                {t('profile.minPasswordHint', 'Mínimo de 6 caracteres.')}
              </p>
            </div>

            <div>
              <label className="block text-[9px] font-black text-slate-400 dark:text-[color:var(--text-muted)] uppercase tracking-widest ml-1 mb-2.5">
                {t('profile.confirmPassword', 'Confirmar Nova Senha')}
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={isPending}
                placeholder="••••••••"
                className="w-full bg-slate-50 dark:bg-[color:var(--bg-input-solid)] border border-slate-200 dark:border-[color:var(--border-main)] text-brand-dark dark:text-[color:var(--text-main)] rounded-[1.5rem] pl-6 pr-6 py-4 text-sm font-bold outline-none focus:ring-2 focus:ring-brand-primary/20 dark:focus:ring-[color:var(--primary)]/20 focus:border-brand-primary dark:focus:border-[color:var(--primary)] transition-all placeholder:text-slate-300 dark:placeholder:text-[color:var(--text-muted)] disabled:opacity-50"
                minLength={6}
                required
              />
            </div>
          </div>

          {feedback && (
            <div
              className={`flex items-start gap-3 px-6 py-5 rounded-2xl border ${
                feedback.type === 'success'
                  ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-100 dark:border-emerald-500/30'
                  : 'bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-300 border-red-100 dark:border-red-500/30'
              }`}
            >
              {feedback.type === 'success' ? (
                <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" />
              ) : (
                <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
              )}
              <p className="text-[10px] font-black uppercase tracking-widest leading-relaxed">
                {feedback.message}
              </p>
            </div>
          )}

          <div className="flex flex-col md:flex-row items-stretch md:items-center justify-end gap-4 pt-4 border-t border-slate-100 dark:border-[color:var(--border-main)]">
            <button
              type="button"
              disabled={isPending}
              onClick={reset}
              className="px-8 py-4 rounded-[2rem] text-[10px] font-black uppercase tracking-widest bg-slate-50 dark:bg-[color:var(--bg-input-solid)] border border-slate-200 dark:border-[color:var(--border-main)] text-slate-500 dark:text-[color:var(--text-muted)] hover:border-slate-300 transition-all disabled:opacity-50"
            >
              {t('common.clear', 'Limpar')}
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="px-10 py-4 rounded-[2rem] text-[10px] font-black uppercase tracking-widest brand-bg-primary text-white shadow-xl btn-premium hover:opacity-90 transition-all flex items-center justify-center gap-3 disabled:opacity-50"
            >
              {isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Key className="w-4 h-4" />
              )}
              <span>
                {isPending
                  ? t('common.processing', 'Processando...')
                  : t('profile.savePassword', 'Salvar Nova Senha')}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
