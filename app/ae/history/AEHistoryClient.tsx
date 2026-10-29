'use client';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '@/components/LanguageProvider';
import { useSession } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';

import { useState, useMemo, useCallback, useEffect } from 'react';
import Link from "next/link";
import {
  Zap, Clock, Search, CheckCircle2, AlertTriangle, Shield, Filter, Lock, Globe,
  List, LayoutGrid, ChevronRight, Plus,
} from "lucide-react";

// Estilos compartilhados com a lista de Projetos (/sc), para as duas telas
// terem o mesmo comportamento visual.
const SEGMENTED = 'inline-flex items-center gap-0.5 p-[3px] h-11 rounded-full border border-slate-300 bg-white';
const SEGMENT_BTN = 'h-full px-4 rounded-full inline-flex items-center gap-1.5 text-body font-medium transition-colors';
const SEGMENT_ON = 'bg-brand-dark text-[color:var(--bg-main)]';
const SEGMENT_OFF = 'text-slate-500 hover:text-brand-dark';
const TH = 'px-4 py-3 text-left text-label font-medium text-slate-500 whitespace-nowrap';
const BADGE = 'inline-flex items-center gap-1.5 h-[26px] px-2.5 rounded-full bg-slate-100 text-brand-dark text-label font-medium whitespace-nowrap';
const CHIP = 'inline-flex items-center gap-1.5 h-7 px-2.5 rounded-lg border text-label font-medium whitespace-nowrap transition-colors';
const CHIP_LATEST = 'brand-bg-primary border-transparent';
const CHIP_OLD = 'bg-white border-slate-300 text-brand-dark hover:border-slate-500';
const DOT_WARN = 'w-2 h-2 rounded-full bg-[color:var(--warning)] shrink-0';
const DOT_OK = 'w-2 h-2 rounded-full bg-[#3f9d36] shrink-0';

/** Horas em formato curto: 148h, 47,5h. Evita "47.66h" na listagem. */
function formatHours(value: number, language: string = 'pt'): string {
  const rounded = Math.round((Number(value) || 0) * 10) / 10;
  // Vírgula decimal só em português: no inglês fica 47.5h.
  const text = Number.isInteger(rounded)
    ? String(rounded)
    : language === 'en' ? rounded.toFixed(1) : rounded.toFixed(1).replace('.', ',');
  return `${text}h`;
}

type HistoryVersion = {
  id: number;
  version: number;
  hours: number;
  createdAt: Date;
  needsSC: boolean;
};

type HistoryGroup = {
  clientName: string;
  latestId: number;
  latestVersion: number;
  latestHours: number;
  latestCreatedAt: Date;
  latestNeedsSC: boolean;
  count: number;
  versions: HistoryVersion[];
  owner?: {
    id: number;
    name?: string;
    email?: string;
    role?: string;
  } | null;
  isAdmin?: boolean;
};

type Scope = 'mine' | 'all';

export default function AEHistoryClient(
  props: HistoryGroup & {
    groups?: HistoryGroup[];
    isAdmin?: boolean;
    currentUserId?: number;
    scope?: Scope;
  },
) {
  const { t } = useTranslation();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session } = useSession();

  const groups = Array.isArray(props.groups) ? props.groups : [];
  const sessionIsAdmin = props.isAdmin ??
    (Boolean((session?.user as any)?.isAdmin) ||
    (String((session?.user as any)?.role || '').toUpperCase() === 'ADMIN'));

  const initialScope = props.scope ?? (sessionIsAdmin ? 'all' : 'mine');
  const [projectScope, setProjectScope] = useState<Scope>(initialScope);

  const setScope = useCallback((next: Scope) => {
    setProjectScope(next);
    const params = new URLSearchParams(searchParams?.toString() || '');
    params.set('scope', next);
    router.push(`/ae/history?${params.toString()}`);
  }, [router, searchParams]);

  const showOwnerChip = sessionIsAdmin && projectScope === 'all';
  const [searchQuery, setSearchQuery] = useState('');
  const { dateLocale, language } = useLanguage();

  // Lista (tabela) é o padrão, como em Projetos; a escolha fica lembrada no navegador.
  const [view, setView] = useState<'list' | 'cards'>('list');
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem('tc-ae-history-view');
      if (saved === 'cards' || saved === 'list') setView(saved);
    } catch {}
  }, []);
  const changeView = (next: 'list' | 'cards') => {
    setView(next);
    try { window.localStorage.setItem('tc-ae-history-view', next); } catch {}
  };

  const filteredGroups = useMemo(() => {
    const arr = Array.isArray(groups) ? groups : [];
    if (!searchQuery) return arr;
    const q = searchQuery.toLowerCase();
    return arr.filter((g) => String(g.clientName || '').toLowerCase().includes(q));
  }, [groups, searchQuery]);

  const totalVersions = filteredGroups.reduce((sum, g) => sum + Number(g.count || 0), 0);

  const viewToggle = (
    <div className={`${SEGMENTED} h-9`} role="group" aria-label={`${t('sc.viewList', 'Lista')} / ${t('sc.viewCards', 'Cards')}`}>
      <button type="button" aria-pressed={view === 'list'} onClick={() => changeView('list')} className={`${SEGMENT_BTN} ${view === 'list' ? SEGMENT_ON : SEGMENT_OFF}`}>
        <List className="w-4 h-4" />{t('sc.viewList', 'Lista')}
      </button>
      <button type="button" aria-pressed={view === 'cards'} onClick={() => changeView('cards')} className={`${SEGMENT_BTN} ${view === 'cards' ? SEGMENT_ON : SEGMENT_OFF}`}>
        <LayoutGrid className="w-4 h-4" />{t('sc.viewCards', 'Cards')}
      </button>
    </div>
  );

  return (
    <div className="space-y-8">
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-6">
        <div className="min-w-0">
          <h1 className="text-brand-dark font-heading text-page">
            {t('aeHistory.title')} <span className="text-brand-primary">{t('aeHistory.titleAccent')}</span>
          </h1>
          <p className="text-slate-500 text-[18px] font-light mt-2">
            {t('aeHistory.subtitle', 'Estimativas da Calculadora AE, agrupadas por cliente.')}
          </p>
          {sessionIsAdmin && (
            <p className="mt-2 inline-flex items-center gap-2 text-label text-slate-500">
              <Filter className="w-3.5 h-3.5" />
              <span>
                {t('aeHistory.viewingPrefix', 'Visualizando estimativas de')}{' '}
                <span className="font-medium text-brand-dark">
                  {projectScope === 'all'
                    ? t('aeHistory.scopeAll', 'todos os AE')
                    : t('aeHistory.scopeMine', 'apenas as minhas')}
                </span>
              </span>
            </p>
          )}
        </div>
        <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-3 w-full lg:w-auto">
          {sessionIsAdmin && (
            <div className={SEGMENTED} role="group" aria-label={t('aeHistory.title')}>
              {(['mine', 'all'] as const).map((scope) => (
                <button
                  key={scope}
                  type="button"
                  aria-pressed={projectScope === scope}
                  onClick={() => setScope(scope)}
                  className={`${SEGMENT_BTN} ${projectScope === scope ? SEGMENT_ON : SEGMENT_OFF}`}
                >
                  {scope === 'mine' ? <Lock className="w-3.5 h-3.5" /> : <Globe className="w-3.5 h-3.5" />}
                  {scope === 'mine' ? t('aeHistory.scopeMineBtn', 'Meus') : t('aeHistory.scopeAllBtn', 'Todos')}
                </button>
              ))}
            </div>
          )}
          <label className="relative w-full sm:w-72">
            <span className="sr-only">{t('aeHistory.searchPlaceholder')}</span>
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('aeHistory.searchPlaceholder')}
              className="w-full h-11 bg-white border border-slate-300 rounded-[10px] pl-10 pr-3 text-body text-brand-dark outline-none focus:border-brand-primary focus:ring-[3px] focus:ring-[color:var(--focus-ring)] transition-colors placeholder:text-slate-500"
            />
          </label>
          <Link
            href="/ae"
            className="h-11 brand-bg-primary px-5 rounded-full text-body font-medium btn-premium flex items-center justify-center gap-2"
          >
            <Plus className="w-5 h-5 shrink-0" />
            <span>{t('aeHistory.newEstimate')}</span>
          </Link>
        </div>
      </div>

      {filteredGroups.length === 0 ? (
        <div className="py-20 bg-white rounded-2xl border border-slate-200 text-center">
          <div className="w-14 h-14 rounded-2xl bg-brand-soft text-brand-soft-fg flex items-center justify-center mx-auto mb-4">
            {searchQuery ? <Search className="w-7 h-7" /> : <Zap className="w-7 h-7" />}
          </div>
          <p className="text-body text-slate-500">
            {searchQuery ? t('aeHistory.emptySearch') : t('aeHistory.emptyState')}
          </p>
        </div>
      ) : view === 'list' ? (
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-b border-slate-200">
            <span className="text-label text-slate-500">
              {t('aeHistory.clientCount', { count: filteredGroups.length })}
              {totalVersions ? ` · ${t('aeHistory.versionCount', { count: totalVersions })}` : ''}
            </span>
            {viewToggle}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full tabular-nums">
              <thead>
                <tr className="border-b border-slate-300">
                  <th className={TH}>{t('aeHistory.colClient', 'Cliente')}</th>
                  <th className={TH}>{t('aeHistory.colStatus', 'Situação')}</th>
                  <th className={TH}>{t('common.versions')}</th>
                  <th className={TH}>{t('aeHistory.colUpdated', 'Última versão')}</th>
                  <th className={TH}><span className="sr-only">{t('common.actions')}</span></th>
                </tr>
              </thead>
              <tbody>
                {filteredGroups.map((g) => {
                  const versions = [...(g.versions || [])].sort((a, b) => b.version - a.version);
                  return (
                    <tr key={g.clientName} className="border-b border-slate-200 last:border-b-0 hover:bg-[color:var(--accent-tint)] transition-colors">
                      <td className="px-4 py-3.5 min-w-[220px]">
                        <Link href={`/ae/${g.latestId}`} className="block font-medium text-brand-dark hover:underline decoration-[color:var(--primary)] decoration-2 underline-offset-[3px]">
                          {g.clientName}
                        </Link>
                        {showOwnerChip && g.owner && (
                          <span className="inline-flex items-center gap-1 text-label text-slate-500">
                            <Shield className="w-3 h-3" />
                            {String(g.owner.name || g.owner.email || t('common.unknown'))}
                            {g.owner.role ? ` (${g.owner.role})` : ''}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <span className={BADGE}>
                          <span className={g.latestNeedsSC ? DOT_WARN : DOT_OK} />
                          {g.latestNeedsSC ? t('aeHistory.needsSC') : t('aeHistory.aeEstimate')}
                          {/* Estimativa que exige SE não tem número fechado: sem horas */}
                          {!g.latestNeedsSC && g.latestHours > 0 ? ` · ${formatHours(g.latestHours, language)}` : ''}
                        </span>
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex flex-wrap gap-1.5">
                          {versions.map((v) => {
                            const latest = Number(v.id) === Number(g.latestId);
                            return (
                              <Link
                                key={String(v.id)}
                                href={`/ae/${v.id}`}
                                className={`${CHIP} ${latest ? CHIP_LATEST : CHIP_OLD}`}
                                title={v.needsSC ? t('aeHistory.needsSC') : t('aeHistory.aeEstimate')}
                              >
                                {!latest && <span className={v.needsSC ? DOT_WARN : DOT_OK} />}
                                V{v.version}
                                {v.needsSC ? ` · ${t('aeHistory.scShort')}` : v.hours > 0 ? ` · ${formatHours(v.hours, language)}` : ''}
                              </Link>
                            );
                          })}
                        </div>
                      </td>
                      <td className="px-4 py-3.5 whitespace-nowrap text-body">
                        {new Date(g.latestCreatedAt).toLocaleDateString(dateLocale)}
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex justify-end">
                          <Link href={`/ae/${g.latestId}`} className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg font-medium text-brand-dark hover:bg-slate-100 whitespace-nowrap">
                            {t('aeHistory.open', 'Abrir')}
                            <ChevronRight className="w-4 h-4" />
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <>
          <div className="flex justify-end -mt-2 mb-4">{viewToggle}</div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredGroups.map((g) => (
              <ProjectCard key={g.clientName} group={g} canSeeOwner={showOwnerChip} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function ProjectCard({ group, canSeeOwner }: { group: HistoryGroup; canSeeOwner: boolean }) {
  const { t } = useTranslation();
  const { dateLocale, language } = useLanguage();
  const showOwnerChip = canSeeOwner;
  const orderedVersions = useMemo(
    () => [...(group.versions || [])].sort((a, b) => b.version - a.version),
    [group.versions],
  );

  return (
    <div className="group block relative">
      <div className="bg-white dark:bg-[color:var(--bg-card-solid)] rounded-3xl border border-slate-300 dark:border-[color:var(--border-main)] hover:border-brand-primary dark:hover:border-[color:var(--primary)] transition-all duration-500 shadow-xl hover:shadow-2xl overflow-hidden">
        <div className="p-10 space-y-6">
          {/* Linha 1: Data (última versão) + Tag Versão (sintética) */}
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <span className="px-4 py-1.5 rounded-xl text-caption font-medium border bg-slate-100 dark:bg-[color:var(--bg-input-solid)] text-brand-dark dark:text-[color:var(--text-main)] border-slate-200 dark:border-[color:var(--border-main)] flex items-center space-x-2">
              <Clock className="w-3.5 h-3.5" />
              <span>{new Date(group.latestCreatedAt).toLocaleDateString(dateLocale)}</span>
            </span>

            <span className="inline-flex items-center space-x-2 px-4 py-1.5 rounded-xl text-caption font-medium border bg-slate-50 dark:bg-[color:var(--bg-input-solid)] text-slate-600 dark:text-[color:var(--text-main)] border-slate-200 dark:border-[color:var(--border-main)]">
              <Clock className="w-3.5 h-3.5" />
              <span>V{group.latestVersion} · {t('aeHistory.versionCount', { count: group.count })}</span>
            </span>
          </div>

          {/* Nome do projeto (cliente) — clique abre a ÚLTIMA versão */}
          <Link href={`/ae/${group.latestId}`} className="block">
            <h3 className="text-2xl font-bold text-brand-dark dark:text-[color:var(--text-main)] group-hover:text-brand-primary dark:group-hover:text-[color:var(--primary)] transition-colors tracking-tight leading-tight break-words">
              {group.clientName}
            </h3>
          </Link>

          {/* chip do owner do projeto — EXCLUSIVO para admins */}
          {showOwnerChip && group.owner && (
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-xl bg-slate-100 text-brand-dark dark:bg-[color:var(--bg-input-solid)] dark:text-[color:var(--text-main)] border border-slate-200 dark:border-[color:var(--border-main)]">
              <Shield className="w-3.5 h-3.5 shrink-0" />
              <span className="text-caption font-medium ">
                {String(group.owner.name || group.owner.email || t('common.unknown'))}
                {group.owner.role ? ` (${group.owner.role})` : ''}
              </span>
            </div>
          )}

          {/* Tag Needs SC / AE Estimate (baseada na última versão) */}
          <span className={`inline-flex items-center space-x-2 px-4 py-1.5 rounded-xl text-caption font-medium border ${
            group.latestNeedsSC
              ? 'bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-300 border-amber-100 dark:border-amber-500/30'
              : 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300 border-emerald-100 dark:border-emerald-500/30'
          }`}>
            {group.latestNeedsSC ? (<AlertTriangle className="w-3.5 h-3.5" />) : (<CheckCircle2 className="w-3.5 h-3.5" />)}
            <span>
              {group.latestNeedsSC ? t('aeHistory.needsSC') : t('aeHistory.aeEstimate')}
              {/* Estimativa que exige SE não tem número fechado — mostrar horas
                  ali passaria a ideia de um valor acordado que não existe. */}
              {!group.latestNeedsSC && group.latestHours > 0
                ? ` · ${formatHours(group.latestHours, language)}`
                : ''}
            </span>
          </span>

          {/* Lista resumida das versões (chips clicáveis) */}
          <div className="pt-4 mt-4 border-t border-slate-100 dark:border-[color:var(--border-main)]">
            <p className="text-caption font-medium text-slate-400 dark:text-[color:var(--text-muted)] mb-2.5">
              {t('common.versions')}
            </p>
            <div className="flex flex-wrap gap-2">
              {orderedVersions.map((v) => {
                const latest = Number(v.id) === Number(group.latestId);
                return (
                  <Link
                    key={String(v.id)}
                    href={`/ae/${v.id}`}
                    className={`
                      inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-caption font-medium   border transition-all
                      ${latest
                        ? 'brand-bg-primary text-brand-ink border-brand-primary shadow-md shadow-green-900/10'
                        : v.needsSC
                          ? 'bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-300 border-amber-100 dark:border-amber-500/30 hover:border-amber-400 dark:hover:border-amber-500 hover:text-amber-700 dark:hover:text-amber-200'
                          : 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300 border-emerald-100 dark:border-emerald-500/30 hover:border-emerald-400 dark:hover:border-emerald-500 hover:text-emerald-700 dark:hover:text-emerald-200'
                      }
                    `}
                  >
                    {v.needsSC
                      ? <AlertTriangle className="w-3.5 h-3.5" />
                      : <CheckCircle2 className="w-3.5 h-3.5" />}
                    <span>
                      V{v.version}
                      {v.needsSC
                        ? ` · ${t('aeHistory.scShort')}`
                        : v.hours > 0 ? ` · ${formatHours(v.hours, language)}` : ''}
                    </span>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
