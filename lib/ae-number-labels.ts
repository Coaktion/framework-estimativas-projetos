import { QUANTITY_FORMULAS } from './ae-config';

/**
 * Rótulo legível de um número da Calculadora AE pelo caminho
 * ("horas_unitarias.funcoes", "itens_fixos.wfm.cenarios_previsao"...). Usado no
 * painel Admin, no bloqueio de exclusão da biblioteca e no histórico — no
 * lugar das chaves técnicas, que antes apareciam cruas na tela.
 */

type TFunc = (key: string, params?: Record<string, any>) => string;
type Lang = 'pt' | 'en' | 'es';

const moduleName = (key: string, t: TFunc) => t(`aeModules.${key}`, { defaultValue: key });

export function aeNumberLabel(path: string, t: TFunc, lang: Lang): string {
  const parts = path.split('.');
  const [group] = parts;
  const key = parts[parts.length - 1];
  switch (group) {
    case 'horas_unitarias': {
      const spec = QUANTITY_FORMULAS.find((f) => f.key === key);
      return spec ? spec.label[lang] : t(`aeNumbers.${key}`, { defaultValue: key });
    }
    case 'configuracoes_gerais':
      return t('aeTable.generalConfigOf', { module: moduleName(key, t) });
    case 'treinamentos':
      return t('aeTable.trainingOf', { module: moduleName(key, t) });
    case 'workshops':
      return t('aeTable.workshopOf', { module: moduleName(key, t) });
    case 'apps':
      return key.endsWith('_base')
        ? t('aeNumbers.appBase', { app: t(`aeApps.${key.replace(/_base$/, '')}`, { defaultValue: key }) })
        : t(`aeApps.${key}`, { defaultValue: key });
    case 'itens_fixos':
      return t(`aeFixed.${key}`, { defaultValue: key });
    case 'fatores_plano':
    case 'fatores_operacao': {
      const target = parts[1];
      const targetLabel = t(`aeNumbers.factor_${target}`, { defaultValue: target });
      const planKey: Record<string, string> = { team: 'ae.planTeam', growth: 'ae.planGrowth', professional: 'ae.planProfessional', enterprise: 'ae.planEnterprise' };
      // fatores_plano.<alvo>.<CS|ES>.<plano>
      const sku = group === 'fatores_plano' && parts.length === 4 ? parts[2] : null;
      const skuLabel = sku === 'ES' ? t('plans.employeeService') : sku === 'CS' ? t('plans.customerService') : null;
      return [targetLabel, skuLabel, planKey[key] ? t(planKey[key]) : key].filter(Boolean).join(' · ');
    }
    case 'percentuais':
      return t(`aeNumbers.pct_${key}`, { defaultValue: key });
    case 'sales_engineer':
      return t(`aeNumbers.se_${key}`, { defaultValue: key });
    default:
      return key;
  }
}

/** Título de um subgrupo de números (ex.: itens fixos de "support_nao_team"). */
export function aeNumberGroupLabel(group: string, sub: string, t: TFunc): string {
  if (group === 'itens_fixos') return t(`aeNumbers.fixedGroup_${sub}`, { defaultValue: sub });
  if (group === 'fatores_plano' || group === 'fatores_operacao') return t(`aeNumbers.factor_${sub}`, { defaultValue: sub });
  return sub;
}
