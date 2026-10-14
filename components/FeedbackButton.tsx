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
      className="inline-flex items-center gap-2 h-9 px-3 rounded-full border border-slate-300 bg-white text-brand-dark hover:border-slate-500 transition-colors"
    >
      <MessageSquarePlus className="w-4 h-4" />
      <span className="hidden xl:inline text-label font-medium leading-none">
        {t('nav.feedback')}
      </span>
    </a>
  );
}
