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
      className="flex items-center space-x-2 py-2 px-3 rounded-xl bg-slate-50 text-slate-400 hover:bg-slate-100 hover:text-brand-primary transition-all"
    >
      <Languages className="w-4 h-4" />
      <span className="text-[10px] font-black uppercase tracking-widest leading-none">
        {LANGUAGE_LABELS[language].short}
      </span>
    </button>
  );
}
