'use client';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '@/components/LanguageProvider';

import { useState, useMemo } from 'react';
import Link from "next/link";
import { Zap, Clock, Search, CheckCircle2, AlertTriangle } from "lucide-react";

type HistoryVersion = {
  id: number;
  version: number;
  createdAt: Date;
  needsSC: boolean;
};

type HistoryGroup = {
  clientName: string;
  latestId: number;
  latestVersion: number;
  latestCreatedAt: Date;
  latestNeedsSC: boolean;
  count: number;
  versions: HistoryVersion[];
};

export default function AEHistoryClient({ groups }: { groups: HistoryGroup[] }) {
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState('');

  const filteredGroups = useMemo(() => {
    const arr = Array.isArray(groups) ? groups : [];
    if (!searchQuery) return arr;
    const q = searchQuery.toLowerCase();
    return arr.filter((g) => String(g.clientName || '').toLowerCase().includes(q));
  }, [groups, searchQuery]);

  return (
    <div className="max-w-7xl mx-auto space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h1 className="text-6xl font-black text-brand-dark dark:text-[color:var(--text-main)] tracking-tighter font-heading uppercase leading-none">
            {t('aeHistory.title')} <span className="text-brand-primary dark:text-[color:var(--primary)]">{t('aeHistory.titleAccent')}</span>
          </h1>
          <p className="text-slate-400 dark:text-[color:var(--text-muted)] text-xs mt-4 font-bold uppercase tracking-[0.2em]">
            {t('aeHistory.projectsLabel')} ({t('aeHistory.clientCount', { count: filteredGroups.length })}{filteredGroups.length ? ` · ${t('aeHistory.versionCount', { count: filteredGroups.reduce((s, g) => s + Number(g.count || 0), 0) })}` : ''})
          </p>
        </div>
        <div className="flex flex-col md:flex-row items-center gap-4 w-full md:w-auto">
          <div className="relative w-full md:w-80 group">
            <Search className="w-4 h-4 absolute left-6 top-1/2 -translate-y-1/2 text-slate-500 dark:text-[color:var(--text-muted)] group-focus-within:text-brand-primary dark:group-focus-within:text-[color:var(--primary)] transition-colors" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('aeHistory.searchPlaceholder')}
              className="w-full bg-[#FFFFFF] dark:bg-[color:var(--bg-card-solid)] border border-slate-500 dark:border-[color:var(--border-main)] text-brand-dark dark:text-[color:var(--text-main)] rounded-[1.5rem] pl-14 pr-6 py-4 text-xs font-bold uppercase tracking-widest outline-none focus:ring-2 focus:ring-brand-primary/20 dark:focus:ring-[color:var(--primary)]/20 focus:border-brand-primary dark:focus:border-[color:var(--primary)] transition-all placeholder:text-slate-500 dark:placeholder:text-[color:var(--text-muted)]"
            />
          </div>
          <Link
            href="/ae"
            className="w-full md:w-auto bg-[#FFFFFF] dark:bg-[color:var(--bg-card-solid)] border border-slate-500 dark:border-[color:var(--border-main)] text-slate-500 dark:text-[color:var(--text-main)] px-8 py-5 rounded-[2rem] text-[10px] font-black uppercase tracking-widest flex items-center justify-center space-x-2 hover:border-brand-primary dark:hover:border-[color:var(--primary)] hover:text-brand-primary dark:hover:text-[color:var(--primary)] transition-all"
          >
            <span>{t('aeHistory.newEstimate')}</span>
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredGroups.length === 0 ? (
          <div className="col-span-full py-24 bg-[#FFFFFF] dark:bg-[color:var(--bg-card-solid)] rounded-[3rem] border-4 border-dashed border-slate-50 dark:border-[color:var(--border-main)] text-center">
            <div className="brand-bg-primary w-20 h-20 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-xl">
              {searchQuery ? <Search className="w-10 h-10 text-white" /> : <Zap className="w-10 h-10 text-white" />}
            </div>
            <p className="text-slate-400 dark:text-[color:var(--text-muted)] font-bold uppercase tracking-widest">
              {searchQuery ? t('aeHistory.emptySearch') : t('aeHistory.emptyState')}
            </p>
          </div>
        ) : (
          filteredGroups.map((g) => (
            <ProjectCard key={g.clientName} group={g} />
          ))
        )}
      </div>
    </div>
  );
}

function ProjectCard({ group }: { group: HistoryGroup }) {
  const { t } = useTranslation();
  const { dateLocale } = useLanguage();
  const orderedVersions = useMemo(
    () => [...(group.versions || [])].sort((a, b) => b.version - a.version),
    [group.versions],
  );

  return (
    <div className="group block relative">
      <div className="bg-[#FFFFFF] dark:bg-[color:var(--bg-card-solid)] rounded-[3rem] border border-slate-300 dark:border-[color:var(--border-main)] hover:border-brand-primary dark:hover:border-[color:var(--primary)] transition-all duration-500 shadow-xl hover:shadow-2xl overflow-hidden">
        <div className="p-10 space-y-6">
          {/* Linha 1: Data (última versão) + Tag Versão (sintética) */}
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <span className="px-4 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest border bg-purple-50 dark:bg-purple-500/10 text-purple-600 dark:text-purple-300 border-purple-100 dark:border-purple-500/30 flex items-center space-x-2">
              <Clock className="w-2 h-2" />
              <span>{new Date(group.latestCreatedAt).toLocaleDateString(dateLocale)}</span>
            </span>

            <span className="inline-flex items-center space-x-2 px-4 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest border bg-slate-50 dark:bg-[color:var(--bg-input-solid)] text-slate-600 dark:text-[color:var(--text-main)] border-slate-200 dark:border-[color:var(--border-main)]">
              <Clock className="w-2 h-2" />
              <span>V{group.latestVersion} · {group.count} versões</span>
            </span>
          </div>

          {/* Nome do projeto (cliente) — clique abre a ÚLTIMA versão */}
          <Link href={`/ae/${group.latestId}`} className="block">
            <h3 className="text-2xl font-black text-brand-dark dark:text-[color:var(--text-main)] group-hover:text-brand-primary dark:group-hover:text-[color:var(--primary)] transition-colors uppercase tracking-tight leading-tight break-words">
              {group.clientName}
            </h3>
          </Link>

          {/* Tag Needs SC / AE Estimate (baseada na última versão) */}
          <span className={`inline-flex items-center space-x-2 px-4 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest border ${
            group.latestNeedsSC
              ? 'bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-300 border-amber-100 dark:border-amber-500/30'
              : 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300 border-emerald-100 dark:border-emerald-500/30'
          }`}>
            {group.latestNeedsSC ? (<AlertTriangle className="w-2 h-2" />) : (<CheckCircle2 className="w-2 h-2" />)}
            <span>{group.latestNeedsSC ? t('aeHistory.needsSC') : t('aeHistory.aeEstimate')}</span>
          </span>

          {/* Lista resumida das versões (chips clicáveis) */}
          <div className="pt-4 mt-4 border-t border-slate-100 dark:border-[color:var(--border-main)]">
            <p className="text-[8px] font-black uppercase tracking-[0.22em] text-slate-400 dark:text-[color:var(--text-muted)] mb-2.5">
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
                      inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest border transition-all
                      ${latest
                        ? 'brand-bg-primary text-white border-brand-primary shadow-md shadow-green-900/10'
                        : v.needsSC
                          ? 'bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-300 border-amber-100 dark:border-amber-500/30 hover:border-amber-400 dark:hover:border-amber-500 hover:text-amber-700 dark:hover:text-amber-200'
                          : 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300 border-emerald-100 dark:border-emerald-500/30 hover:border-emerald-400 dark:hover:border-emerald-500 hover:text-emerald-700 dark:hover:text-emerald-200'
                      }
                    `}
                  >
                    {v.needsSC
                      ? <AlertTriangle className="w-1.5 h-1.5" />
                      : <CheckCircle2 className="w-1.5 h-1.5" />}
                    <span>V{v.version}</span>
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
