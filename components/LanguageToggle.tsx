'use client';

import { useTranslation } from 'react-i18next';
import { Languages } from 'lucide-react';
import { LANGUAGE_LABELS } from '@/app/i18n/settings';
import { useLanguage } from './LanguageProvider';

/**
 * Botão PT / EN. Mostra o idioma para o qual o clique vai mudar,
 * seguindo o mesmo padrão visual dos botões de tema e modo compacto.
 */
export default function LanguageToggle() {
  const { language, toggleLanguage } = useLanguage();
  const { t } = useTranslation();

  const next = language === 'pt' ? 'en' : 'pt';

  return (
    <button
      type="button"
      onClick={toggleLanguage}
      title={next === 'en' ? t('nav.switchToEnglish') : t('nav.switchToPortuguese')}
      aria-label={t('nav.language')}
      className="inline-flex items-center gap-1.5 h-9 px-2.5 rounded-[10px] border border-slate-200 bg-white text-slate-500 hover:text-brand-dark hover:border-slate-400 transition-colors"
    >
      <Languages className="w-4 h-4" />
      <span className="text-label font-medium leading-none">
        {LANGUAGE_LABELS[language].short}
      </span>
    </button>
  );
}
