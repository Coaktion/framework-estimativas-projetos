'use client';

import { useState, useTransition, useMemo, useEffect } from 'react';
import type { FormEvent } from 'react';
import { Plus, Trash2, ExternalLink, Lock, Globe, X, Loader2, Zap, Search, List, LayoutGrid, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createProjectAction, deleteProjectAction } from './actions';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '@/components/LanguageProvider';

/** Horas em formato curto: 148h, 47,5h. Mesmo formato do histórico da AE. */
function formatHours(value: number): string {
  const rounded = Math.round((Number(value) || 0) * 10) / 10;
  const text = Number.isInteger(rounded)
    ? String(rounded)
    : rounded.toFixed(1).replace('.', ',');
  return `${text}h`;
}

// Estilos compartilhados (identidade Aktie Now: rótulos 13/12px, sem caixa alta).
const SEGMENTED = 'inline-flex items-center gap-0.5 p-[3px] h-11 rounded-full border border-slate-300 bg-white';
const SEGMENT_BTN = 'h-full px-4 rounded-full inline-flex items-center gap-1.5 text-body font-medium transition-colors';
const SEGMENT_ON = 'bg-brand-dark text-[color:var(--bg-main)]';
const SEGMENT_OFF = 'text-slate-500 hover:text-brand-dark';
const TH = 'px-4 py-3 text-left text-label font-medium text-slate-500 whitespace-nowrap';
const BADGE = 'inline-flex items-center gap-1.5 h-[26px] px-2.5 rounded-full bg-slate-100 text-brand-dark text-label font-medium whitespace-nowrap';
const CHIP = 'inline-flex items-center h-7 px-2.5 rounded-lg border text-label font-medium whitespace-nowrap transition-colors';
const CHIP_LATEST = 'brand-bg-primary border-transparent';
const CHIP_OLD = 'bg-white border-slate-300 text-brand-dark hover:border-slate-500';

type ProjectVersionChip = {
  id: number;
  ordinal: number;
  versionName: string;
  totalHours: number;
  createdAt: string | Date;
};

export default function ProjectDashboardClient({ projects, currentUserId }: any) {
  const { t } = useTranslation();
  const { dateLocale } = useLanguage();
  const router = useRouter();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCreatingProject, startCreatingProject] = useTransition();
  const [isDeletingProject, startDeletingProject] = useTransition();
  const [searchQuery, setSearchQuery] = useState('');
  const [projectScope, setProjectScope] = useState<'mine' | 'all'>('mine');
  // Lista (tabela) é o padrão; a visualização em cards continua disponível e fica lembrada no navegador.
  const [view, setView] = useState<'list' | 'cards'>('list');
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem('tc-sc-view');
      if (saved === 'cards' || saved === 'list') setView(saved);
    } catch {}
  }, []);
  const changeView = (next: 'list' | 'cards') => {
    setView(next);
    try { window.localStorage.setItem('tc-sc-view', next); } catch {}
  };

  const handleCreateSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isCreatingProject) return;

    const form = event.currentTarget;
    const formData = new FormData(form);

    startCreatingProject(async () => {
      try {
        const result = await createProjectAction(formData);
        if (result?.ok) {
          router.push(`/sc/project/${result.projectId}`);
        }
      } catch (err) {
        console.error(err);
        alert('Não foi possível criar o projeto. Tente novamente.');
      }
    });
  };

  const filteredProjects = useMemo(() => {
    const scoped = projectScope === 'mine'
      ? projects.filter((p: any) => p.ownerId === currentUserId)
      : projects;

    if (!searchQuery) return scoped;
    const query = searchQuery.toLowerCase();
    return scoped.filter((p: any) =>
      p.name.toLowerCase().includes(query)
    );
  }, [projects, currentUserId, projectScope, searchQuery]);

  const handleDelete = async (id: number, name: string) => {
    if (isDeletingProject) return;
    if (confirm(t('sc.confirmDelete', { name }))) {
      startDeletingProject(async () => {
        try {
          await deleteProjectAction(id);
          router.refresh();
        } catch (err) {
          console.error(err);
          alert('Não foi possível excluir o projeto. Tente novamente.');
        }
      });
    }
  };

  const viewToggle = (
    <div className={`${SEGMENTED} h-9`} role="group" aria-label={`${t('sc.viewList')} / ${t('sc.viewCards')}`}>
      <button type="button" aria-pressed={view === 'list'} onClick={() => changeView('list')} className={`${SEGMENT_BTN} ${view === 'list' ? SEGMENT_ON : SEGMENT_OFF}`}>
        <List className="w-4 h-4" />{t('sc.viewList')}
      </button>
      <button type="button" aria-pressed={view === 'cards'} onClick={() => changeView('cards')} className={`${SEGMENT_BTN} ${view === 'cards' ? SEGMENT_ON : SEGMENT_OFF}`}>
        <LayoutGrid className="w-4 h-4" />{t('sc.viewCards')}
      </button>
    </div>
  );

  return (
    <div className="space-y-8">
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-6">
        <div className="min-w-0">
          <h1 className="text-brand-dark font-heading text-page">{t('sc.title')}</h1>
          <p className="text-slate-500 text-[18px] font-light mt-2">{t('sc.subtitle')}</p>
        </div>
        <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-3 w-full lg:w-auto">
          <div className={SEGMENTED} role="group" aria-label={t('sc.title')}>
            {(['mine', 'all'] as const).map((scope) => (
              <button
                key={scope}
                type="button"
                aria-pressed={projectScope === scope}
                onClick={() => setProjectScope(scope)}
                className={`${SEGMENT_BTN} ${projectScope === scope ? SEGMENT_ON : SEGMENT_OFF}`}
              >
                {scope === 'mine' ? t('common.mine') : t('common.all')}
              </button>
            ))}
          </div>
          <label className="relative w-full sm:w-72">
            <span className="sr-only">{t('sc.searchPlaceholder')}</span>
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('sc.searchPlaceholder')}
              className="w-full h-11 bg-white border border-slate-300 rounded-[10px] pl-10 pr-3 text-body outline-none focus:border-brand-primary focus:ring-[3px] focus:ring-[color:var(--focus-ring)] transition-colors placeholder:text-slate-500"
            />
          </label>
          <button
            onClick={() => !isCreatingProject && !isDeletingProject && setIsModalOpen(true)}
            disabled={isCreatingProject || isDeletingProject}
            className="h-11 brand-bg-primary px-5 rounded-full text-body font-medium btn-premium flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Plus className="w-5 h-5 shrink-0" />
            <span>{t('sc.newProject')}</span>
          </button>
        </div>
      </div>

      {filteredProjects.length === 0 ? (
        <div className="py-24 bg-white rounded-3xl border-4 border-dashed border-slate-50 text-center">
          <div className="brand-bg-primary w-20 h-20 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-xl">
            <Search className="w-10 h-10 text-white" />
          </div>
          <p className="text-slate-400 font-bold ">{t('sc.emptyState')}</p>
        </div>
      ) : view === 'list' ? (
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-b border-slate-200">
            <span className="text-label text-slate-500">{t('sc.count', { count: filteredProjects.length })}</span>
            {viewToggle}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full tabular-nums">
              <thead>
                <tr className="border-b border-slate-300">
                  <th className={TH}>{t('sc.colProject')}</th>
                  <th className={TH}>{t('sc.colVisibility')}</th>
                  <th className={TH}>{t('sc.versions')}</th>
                  <th className={TH}>{t('sc.colUpdated')}</th>
                  <th className={TH}><span className="sr-only">{t('common.actions')}</span></th>
                </tr>
              </thead>
              <tbody>
                {filteredProjects.map((project: any) => {
                  const versions = [...((project.versions || []) as ProjectVersionChip[])].sort((a, b) => b.ordinal - a.ordinal);
                  return (
                    <tr key={project.id} className="border-b border-slate-200 last:border-b-0 hover:bg-[color:var(--accent-tint)] transition-colors">
                      <td className="px-4 py-3.5 min-w-[240px]">
                        <Link href={`/sc/project/${project.id}`} title={t('sc.openLatestVersion')} className="block font-medium text-brand-dark hover:underline decoration-[color:var(--primary)] decoration-2 underline-offset-[3px]">
                          {project.name}
                        </Link>
                        {project.owner?.name && (
                          <span className="text-label text-slate-500">{t('sc.createdBy', { name: project.owner.name })}</span>
                        )}
                      </td>
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <div className="flex flex-wrap gap-1.5">
                          <span className={BADGE}>
                            {project.isPrivate ? <Lock className="w-3.5 h-3.5" /> : <Globe className="w-3.5 h-3.5" />}
                            {project.isPrivate ? t('common.private') : t('common.public')}
                          </span>
                          {project.status === 'AE_ESTIMATE' && (
                            <span className={BADGE}>
                              <span className="w-2 h-2 rounded-full bg-[color:var(--warning)]" />
                              {t('sc.legacyAE')}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        {versions.length === 0 ? (
                          <span className="text-label text-slate-500">{t('sc.noVersions')}</span>
                        ) : (
                          <div className="flex flex-wrap gap-1.5">
                            {versions.map((v, index) => (
                              <Link
                                key={String(v.id)}
                                href={`/sc/project/${project.id}?version_id=${v.id}`}
                                title={v.versionName || undefined}
                                className={`${CHIP} ${index === 0 ? CHIP_LATEST : CHIP_OLD}`}
                              >
                                V{v.ordinal}{v.totalHours > 0 ? ` · ${formatHours(v.totalHours)}` : ''}
                              </Link>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3.5 whitespace-nowrap text-body">{new Date(project.updatedAt).toLocaleDateString(dateLocale)}</td>
                      <td className="px-4 py-3.5">
                        <div className="flex items-center justify-end gap-1">
                          <Link href={`/sc/project/${project.id}`} className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg font-medium text-brand-dark hover:bg-slate-100 whitespace-nowrap">
                            {t('sc.editScope')}
                            <ChevronRight className="w-4 h-4" />
                          </Link>
                          <button
                            onClick={() => handleDelete(project.id, project.name)}
                            disabled={isDeletingProject}
                            className="p-2 rounded-lg text-slate-500 hover:text-[color:var(--danger)] hover:bg-slate-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            title={t('common.delete')}
                            aria-label={`${t('common.delete')}: ${project.name}`}
                          >
                            {isDeletingProject ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                          </button>
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
          {filteredProjects.map((project: any) => (
            <div key={project.id} className="group bg-white rounded-3xl border border-slate-300 hover:border-brand-primary transition-all duration-500 shadow-xl hover:shadow-2xl overflow-hidden flex flex-col">
              <div className="p-10 space-y-6 flex-1">
                <div className="flex items-center justify-between">
                  <div className="flex gap-2">
                    <span className={`px-4 py-1.5 rounded-xl text-caption font-medium border flex items-center space-x-2 ${
                      project.isPrivate ? 'bg-amber-50 text-amber-600 border-amber-100' : 'bg-emerald-50 text-emerald-600 border-emerald-100'
                    }`}>
                      {project.isPrivate ? <Lock className="w-3.5 h-3.5 shrink-0" /> : <Globe className="w-3.5 h-3.5 shrink-0" />}
                      <span>{project.isPrivate ? t('common.private') : t('common.public')}</span>
                    </span>
                    {project.status === 'AE_ESTIMATE' && (
                      <span className="px-4 py-1.5 rounded-xl text-caption font-medium border bg-slate-100 text-brand-dark border-slate-200 flex items-center space-x-2">
                        <Zap className="w-3.5 h-3.5 shrink-0" />
                        <span>{t('sc.legacyAE')}</span>
                      </span>
                    )}
                  </div>
                  <span className="text-caption font-medium text-slate-300 ">{new Date(project.updatedAt).toLocaleDateString(dateLocale)}</span>
                </div>
                
                <h3 className="text-2xl font-bold text-brand-dark group-hover:text-brand-primary transition-colors tracking-tight leading-tight">
                  {project.name}
                </h3>

                {/* Atalhos de versão, no mesmo espírito dos chips da Calculadora
                    AE. O card em si continua abrindo a versão mais recente; os
                    chips existem para pular direto para uma versão anterior sem
                    passar pelo editor. Ordem DECRESCENTE: a mais nova primeiro. */}
                <div className="pt-4 mt-4 border-t border-slate-100">
                  <p className="text-caption font-medium text-slate-400 mb-2.5">
                    {t('sc.versions')}
                  </p>
                  {(project.versions || []).length === 0 ? (
                    <span className="text-caption font-medium text-slate-300">
                      {t('sc.noVersions')}
                    </span>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {[...(project.versions as ProjectVersionChip[])]
                        .sort((a, b) => b.ordinal - a.ordinal)
                        .map((v, index) => {
                          const isLatest = index === 0;
                          return (
                            <Link
                              key={String(v.id)}
                              href={`/sc/project/${project.id}?version_id=${v.id}`}
                              title={v.versionName || undefined}
                              className={`
                                inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-caption font-medium   border transition-all
                                ${isLatest
                                  ? 'brand-bg-primary text-brand-ink border-brand-primary shadow-md shadow-green-900/10'
                                  : 'bg-slate-50 text-slate-500 border-slate-200 hover:border-brand-primary hover:text-brand-primary'
                                }
                              `}
                            >
                              <span>
                                V{v.ordinal}
                                {v.totalHours > 0 ? ` · ${formatHours(v.totalHours)}` : ''}
                              </span>
                            </Link>
                          );
                        })}
                    </div>
                  )}
                </div>
              </div>

              <div className="px-10 py-8 bg-slate-50/50 border-t border-slate-100 flex items-center justify-between">
                <Link
                  href={`/sc/project/${project.id}`}
                  title={t('sc.openLatestVersion')}
                  className="text-label font-medium text-brand-dark hover:text-brand-primary flex items-center space-x-2 transition-all"
                >
                    <span>{t('sc.editScope')}</span>
                    <ExternalLink className="w-3 h-3 shrink-0" />
                  </Link>
                <button 
                  onClick={() => handleDelete(project.id, project.name)}
                  disabled={isDeletingProject}
                  className="text-slate-300 hover:text-red-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed p-1"
                  title={t('common.delete')}
                >
                  {isDeletingProject ? <Loader2 className="w-4 h-4 animate-spin shrink-0" /> : <Trash2 className="w-4 h-4 shrink-0" />}
                </button>
              </div>
            </div>
          ))}
        </div>
        </>
      )}

      {/* Modal de Novo Projeto */}
      {isModalOpen && (
        <div
          className="fixed inset-0 bg-[rgb(3_14_1/0.8)] backdrop-blur-md flex items-center justify-center z-[60] p-4"
          onClick={(e) => { if (!isCreatingProject && e.target === e.currentTarget) setIsModalOpen(false); }}
        >
          <div className="bg-white dark:bg-[color:var(--bg-card)] dark:border dark:border-[color:var(--border-main)] rounded-3xl shadow-2xl max-w-md w-full overflow-hidden border border-white/20 relative">
            <div className="px-8 pt-8 flex justify-between items-start gap-4">
              <div>
                <h3 className="text-brand-dark font-heading text-section">{t('sc.newProject')}</h3>
                <p className="text-slate-500 text-body mt-1">{t('sc.modalSubtitle')}</p>
              </div>
              <button
                type="button"
                onClick={() => !isCreatingProject && setIsModalOpen(false)}
                disabled={isCreatingProject}
                className="text-slate-500 hover:text-brand-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed p-1"
                aria-label={t('common.close')}
              >
                <X className="w-6 h-6 shrink-0" />
              </button>
            </div>
            
            <form onSubmit={handleCreateSubmit} className="p-8 space-y-6">
              <div className="space-y-2">
                <label className="block text-label font-medium text-brand-dark">{t('sc.projectName')}</label>
                <input
                  type="text"
                  name="name"
                  placeholder={t('sc.projectNamePlaceholder')}
                  className="w-full bg-slate-50 dark:bg-[color:var(--bg-input)] dark:text-[color:var(--text-main)] dark:placeholder:text-[color:var(--text-muted)] dark:border-[color:var(--border-main)] border border-slate-300 rounded-[10px] px-4 h-11 text-body focus:ring-2 focus:ring-brand-primary focus:bg-white outline-none transition-all placeholder:text-slate-300 disabled:opacity-50 disabled:cursor-not-allowed"
                  required
                  disabled={isCreatingProject}
                  autoFocus
                />
              </div>

              <div className="flex items-center space-x-4 bg-slate-50 dark:bg-[color:var(--bg-input)] dark:border dark:border-[color:var(--border-main)] p-6 rounded-2xl border border-slate-100">
                <div className="flex-1 min-w-0">
                  <label htmlFor="isPrivate" className={`block text-body font-bold tracking-tight ${isCreatingProject ? 'text-slate-400 dark:text-[color:var(--text-muted)]' : 'text-brand-dark dark:text-[color:var(--text-main)]'}`}>{t('sc.privacy')}</label>
                  <p className="text-label text-slate-400 dark:text-[color:var(--text-muted)] font-medium mt-0.5">{t('sc.privacyHint')}</p>
                </div>
                <div className={`relative inline-block w-12 h-6 transition duration-200 ease-in-out rounded-full shrink-0 ${isCreatingProject ? 'opacity-50 cursor-not-allowed' : ''} bg-slate-200 dark:bg-[color:var(--bg-input)] dark:border dark:border-[color:var(--border-main)]`}>
                  <input
                    type="checkbox"
                    name="isPrivate"
                    id="isPrivate"
                    disabled={isCreatingProject}
                    className="absolute w-6 h-6 transition duration-200 ease-in-out transform bg-white dark:bg-[color:var(--bg-card)] border-4 border-slate-200 dark:border-[color:var(--border-main)] rounded-full appearance-none cursor-pointer checked:translate-x-6 checked:border-brand-primary outline-none disabled:cursor-not-allowed"
                  />
                </div>
              </div>

              <div className="flex flex-col space-y-4 pt-4">
                <button
                  type="submit"
                  disabled={isCreatingProject}
                  className="w-full brand-bg-primary text-brand-ink py-5 rounded-2xl text-label font-medium hover:opacity-90 shadow-xl btn-premium transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  <Loader2 className={`w-4 h-4 shrink-0 animate-spin ${isCreatingProject ? 'opacity-100' : 'opacity-0'}`} style={{ width: isCreatingProject ? '1rem' : 0, height: isCreatingProject ? '1rem' : 0 }} />
                  <span className="truncate">{t('sc.createProject')}</span>
                </button>
                <button
                  type="button"
                  onClick={() => !isCreatingProject && setIsModalOpen(false)}
                  disabled={isCreatingProject}
                  className="w-full py-4 text-label font-medium text-slate-400 dark:text-[color:var(--text-muted)] hover:text-brand-dark dark:hover:text-[color:var(--text-main)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {t('common.cancel')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
