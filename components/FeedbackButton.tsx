'use client';

import { useTranslation } from 'react-i18next';
import { MessageSquarePlus } from 'lucide-react';

/** Formulário externo de sugestões e relato de bugs. */
const FEEDBACK_FORM_URL =
  'https://docs.google.com/forms/d/e/1FAIpQLSe7w9DDjve8ZKzSdg7pOYYVHz1FML54Sp90Lycz8v7ruMSRnA/viewform?usp=dialog';

/**
 * Abre o formulário em nova aba. `rel="noopener noreferrer"` evita que a página
 * de destino consiga manipular esta aba.
 */
export default function FeedbackButton() {
  const { t } = useTranslation();

  return (
    <a
      href={FEEDBACK_FORM_URL}
      target="_blank"
      rel="noopener noreferrer"
      title={t('nav.feedbackTitle')}
      aria-label={t('nav.feedbackTitle')}
      className="flex items-center space-x-2 py-2 px-3 rounded-xl bg-slate-50 text-slate-400 hover:bg-slate-100 hover:text-brand-primary transition-all"
    >
      <MessageSquarePlus className="w-4 h-4" />
      <span className="hidden lg:inline text-[10px] font-black uppercase tracking-widest leading-none">
        {t('nav.feedback')}
      </span>
    </a>
  );
}
