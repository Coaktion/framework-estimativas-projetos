'use client';

import { ArrowUpRight, FileText, Globe, type LucideIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';

type TemplateLinks = {
  pacote_horas: string;
  escopo_fechado: string;
  time_materials: string;
  pacote_horas_ae: string;
};

type DemoLinks = {
  PT: string;
  EN: string;
  ES: string;
};

type HomeClientProps = {
  templateLinks: TemplateLinks;
  demoLinks: DemoLinks;
};

type ResourceRow = {
  key: string;
  label: string;
  url: string;
  badge: string;
  /** Texto do selo quando a opção ainda não está disponível. */
  disabledLabel?: string;
};

/**
 * Recursos externos da Home: templates de escopo (Drive) e ambientes de demo (Zendesk).
 * Lista aberta em vez de dropdown: cada link fica a um clique. Sem bandeiras/emoji;
 * o idioma aparece como código (PT-BR, EN-US).
 */
function ResourceCard({ title, subtitle, Icon, rows }: { title: string; subtitle: string; Icon: LucideIcon; rows: ResourceRow[] }) {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-7">
      <header className="flex items-center gap-3 mb-3">
        <span className="w-10 h-10 rounded-xl bg-brand-soft text-brand-soft-fg flex items-center justify-center shrink-0">
          <Icon className="w-5 h-5" />
        </span>
        <div className="min-w-0">
          <h3 className="text-title font-bold text-brand-dark">{title}</h3>
          <p className="text-label text-slate-500">{subtitle}</p>
        </div>
      </header>
      <ul>
        {rows.map((row, i) => {
          const disabled = !row.url || Boolean(row.disabledLabel);
          const border = i > 0 ? 'border-t border-slate-200' : '';
          return (
            <li key={row.key} className={border}>
              {disabled ? (
                <span aria-disabled="true" className="flex items-center gap-3 py-3.5 px-1 text-slate-300 cursor-not-allowed">
                  <span className="flex-1 min-w-0">{row.label}</span>
                  <span className="text-label font-medium text-brand-dark bg-slate-100 rounded-full px-2.5 py-0.5">{row.disabledLabel}</span>
                </span>
              ) : (
                <a
                  href={row.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 py-3.5 px-1 rounded-lg text-brand-dark hover:bg-slate-100 transition-colors"
                >
                  <span className="flex-1 min-w-0 font-medium">{row.label}</span>
                  <span className="text-caption font-medium text-slate-500 border border-slate-200 rounded-md px-1.5">{row.badge}</span>
                  <ArrowUpRight className="w-4 h-4 text-slate-500" />
                </a>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export default function HomeClient({ templateLinks, demoLinks }: HomeClientProps) {
  const { t } = useTranslation();

  const templates: ResourceRow[] = [
    { key: 'pacote_horas', label: t('home.tplHours'), url: templateLinks.pacote_horas, badge: 'SC' },
    { key: 'time_materials', label: t('home.tplTimeMaterials'), url: templateLinks.time_materials, badge: 'SC' },
    { key: 'pacote_horas_ae', label: t('home.tplHoursAe'), url: templateLinks.pacote_horas_ae, badge: 'AE' },
    { key: 'escopo_fechado', label: t('home.tplFixedScope'), url: templateLinks.escopo_fechado, badge: 'SC', disabledLabel: t('home.comingSoon') },
  ];

  const demos: ResourceRow[] = [
    { key: 'PT', label: t('home.langPt'), url: demoLinks.PT, badge: 'PT-BR' },
    { key: 'EN', label: t('home.langEn'), url: demoLinks.EN, badge: 'EN-US' },
    { key: 'ES', label: t('home.langEs'), url: demoLinks.ES, badge: 'ES-ES', disabledLabel: t('home.unavailable') },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <ResourceCard title={t('home.templatesTitle')} subtitle={t('home.templatesSubtitle')} Icon={FileText} rows={templates} />
      <ResourceCard title={t('home.demosTitle')} subtitle={t('home.demosSubtitle')} Icon={Globe} rows={demos} />
    </div>
  );
}
