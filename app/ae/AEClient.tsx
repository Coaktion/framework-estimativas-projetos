'use client';
import { useTranslation } from 'react-i18next';
import { useSession } from 'next-auth/react';
import { useLanguage } from '@/components/LanguageProvider';
import { packageName } from '@/lib/localized-names';
import { buildAEScopePrompt, marketplaceAppsForPrompt, type AEScopePromptInput } from '@/lib/ae-scope-prompt';
import { zohoSectionFor } from '@/lib/zoho-section';
import AEResultTable from '@/components/AEResultTable';
import { aeChannelOptions } from '@/lib/ae-channel-options';
import { AE_VIEW_COOKIE } from '@/lib/editor-view';

import { useState, useMemo, useEffect, useRef } from 'react';
import { 
  Zap, Plus, X, ShieldCheck, 
  Layers, 
  Settings, Loader2,
  AlertTriangle, CheckCircle2, 
  MessageSquare, Users, Shield, Clock, Box,
  Copy, BookOpen, Hash, Search, Rows3
} from 'lucide-react';
import Link from 'next/link';
import { saveAEEstimateAction } from './actions';
import {
  AE_PLAN_RANK,
  buildEngineInputs,
  isSideConversationEligible,
  normalizeAESku,
} from '@/lib/ae-inputs';
import { DEFAULT_AE_CONFIG } from '@/lib/ae-config';
import { useUnsavedChangesGuard } from '@/lib/use-unsaved-changes';
import {
  ACTION_FLOW_OPTIONS,
  calculateAEEstimate,
  validateAEInputs,
  type AEInputData,
  type ModuleKey,
  type ZendeskPlan,
  type SkuType,
  type OperationType,
} from '@/lib/ae-engine';

// Conversão formulário → inputs do engine: implementação ÚNICA, compartilhada
// com a tela de visualização (ver lib/ae-inputs.ts).
const PLAN_RANK = AE_PLAN_RANK;
const normalizeSku = normalizeAESku;

/**
 * Estado completo do formulário a partir do JSON salvo de uma estimativa (ou
 * vazio). Usado TANTO no estado inicial dos campos quanto na reidratação
 * quando os dados mudam sem remontar o componente.
 *
 * Começar já com os valores restaurados (em vez de restaurar num efeito) é o
 * que garante que os efeitos de consistência — zerar artigos sem Knowledge,
 * filtrar módulos pelo plano — nunca enxerguem o formulário vazio. Antes,
 * "Criar nova versão" perdia os artigos de Knowledge e o ADPP, e no modo de
 * desenvolvimento (StrictMode roda os efeitos duas vezes) nem a trava de
 * hidratação bastava.
 */
function formFromInitial(initialData: any, initialClientName: string) {
  const d = initialData && typeof initialData === 'object' ? initialData : null;
  const plan = String(d?.zendeskPlan || '').toLowerCase().replace(/^suite\s+/, '').trim();
  const sku = String(d?.skuType || '').toLowerCase();
  const restoredModules = Array.isArray(d?.selectedModules)
    // Estimativas antigas podem trazer 'AI Agents'; ele não existe mais aqui.
    ? d.selectedModules.filter((m: string) => Boolean(m) && m !== 'AI Agents')
    : [];
  const restoredChannels = Array.isArray(d?.channels) && d.channels.length
    ? d.channels.filter(Boolean)
    : Array.isArray(d?.selectedChannels) && d.selectedChannels.length ? d.selectedChannels.filter(Boolean) : [];
  const selectedApps = Array.isArray(d?.selectedApps) ? d.selectedApps.filter(Boolean) : [];
  const selectedNativeConnections = Array.isArray(d?.selectedNativeConnections) ? d.selectedNativeConnections.filter(Boolean) : [];
  return {
    clientName: String(initialClientName || ''),
    clientObjectives: typeof d?.clientObjectives === 'string' ? d.clientObjectives : '',
    successIndicators: typeof d?.successIndicators === 'string' ? d.successIndicators : '',
    selectedModules: (restoredModules.length ? restoredModules : ['Support']) as string[],
    knowledgeArticles: d?.knowledgeArticles != null ? Math.max(0, Number(d.knowledgeArticles) || 0) : 0,
    operationTypes: (Array.isArray(d?.operationTypes) ? d.operationTypes.filter(Boolean) : []) as string[],
    skuType: (sku === 'employee_service' || sku === 'es' ? 'employee_service' : 'customer_service') as 'customer_service' | 'employee_service',
    deploymentType: (d?.deploymentType === 'optimization' ? 'optimization' : 'new') as 'new' | 'optimization',
    hasAppsMarketplace: selectedApps.length > 0,
    selectedApps: selectedApps as string[],
    appQuantities: (d?.appQuantities && typeof d.appQuantities === 'object' ? { ...d.appQuantities } : {}) as Record<string, number>,
    otherApp: typeof d?.otherApp === 'string' ? d.otherApp : '',
    zendeskPlan: (['team', 'growth', 'professional', 'enterprise'].includes(plan) ? plan : 'professional') as 'team' | 'growth' | 'professional' | 'enterprise',
    hasNativeConnections: selectedNativeConnections.length > 0,
    selectedNativeConnections: selectedNativeConnections as string[],
    agents: d?.agents != null ? Math.max(1, Number(d.agents) || 1) : 1,
    brands: d?.brands != null ? Math.max(1, Number(d.brands) || 1) : 1,
    selectedChannels: (restoredChannels.length ? restoredChannels : ['web_form']) as string[],
    channelQuantities: (d?.channelQuantities && typeof d.channelQuantities === 'object' ? { ...d.channelQuantities } : { web_form: 1 }) as Record<string, number>,
    areas: d?.areas != null ? Math.max(1, Number(d.areas) || 1) : 1,
    selectedActionFlows: (Array.isArray(d?.selectedActionFlows) ? d.selectedActionFlows.filter(Boolean) : []) as string[],
    hasSSO: Boolean(d?.hasSSO),
    hasTeamsSideConv: Boolean(d?.hasTeamsSideConv),
    hasSlackSideConv: Boolean(d?.hasSlackSideConv),
    hasAppCondicionais: Boolean(d?.hasAppCondicionais),
    hasAppTicketManager: Boolean(d?.hasAppTicketManager),
  };
}

export default function AEClient({ packages, variables, initialClientName = '', initialData = null, initialVersion = null, cloneFromId = null, aeConfig = DEFAULT_AE_CONFIG, aeConfigId = null, initialCompact = false }: any) {
  const { t } = useTranslation();
  const { language, dateLocale } = useLanguage();
  const { data: session } = useSession();
  const [isPending, setIsPending] = useState(false);
  const [showResult, setShowResult] = useState(false);

  /**
   * Resultado CONGELADO no momento do cálculo.
   *
   * Antes a tabela era derivada do `estimation` vivo, que segue reagindo a
   * qualquer mudança de estado depois do cálculo. Numa nova versão, o
   * `revalidatePath('/ae')` disparado pelo save reinjetava `initialData` e
   * revertia o formulário para a versão anterior — a tela então mostrava o
   * resultado da versão antiga. Congelar aqui garante que o painel exiba
   * exatamente o que foi calculado e salvo.
   */
  const [resultSnapshot, setResultSnapshot] = useState<{
    engineResult: any;
    engineInputs: any;
    total: number;
    techHours: number;
    needsSC: boolean;
    variables: Record<string, number>;
    clientName: string;
  } | null>(null);

  // Estado inicial já restaurado a partir da estimativa de origem (clone) — ver
  // `formFromInitial`.
  const [initialForm] = useState(() => formFromInitial(initialData, initialClientName));

  const [clientName, setClientName] = useState(initialForm.clientName);
  const [zohoLink, setZohoLink] = useState('');
  const [clientObjectives, setClientObjectives] = useState(initialForm.clientObjectives);
  const [successIndicators, setSuccessIndicators] = useState(initialForm.successIndicators);

  const [selectedModules, setSelectedModules] = useState<string[]>(initialForm.selectedModules);
  const [knowledgeArticles, setKnowledgeArticles] = useState(initialForm.knowledgeArticles);

  const [operationTypes, setOperationTypes] = useState<string[]>(initialForm.operationTypes);
  const [skuType, setSkuType] = useState<'customer_service' | 'employee_service'>(initialForm.skuType);
  const [deploymentType, setDeploymentType] = useState<'new' | 'optimization'>(initialForm.deploymentType);

  const [hasAppsMarketplace, setHasAppsMarketplace] = useState(initialForm.hasAppsMarketplace);
  const [selectedApps, setSelectedApps] = useState<string[]>(initialForm.selectedApps);
  const [appQuantities, setAppQuantities] = useState<Record<string, number>>(initialForm.appQuantities);
  const [otherApp, setOtherApp] = useState(initialForm.otherApp);

  const [zendeskPlan, setZendeskPlan] = useState<'team' | 'growth' | 'professional' | 'enterprise'>(initialForm.zendeskPlan);
  const [hasNativeConnections, setHasNativeConnections] = useState(initialForm.hasNativeConnections);
  const [selectedNativeConnections, setSelectedNativeConnections] = useState<string[]>(initialForm.selectedNativeConnections);

  const [agents, setAgents] = useState(initialForm.agents);
  const [brands, setBrands] = useState(initialForm.brands);
  const [selectedChannels, setSelectedChannels] = useState<string[]>(initialForm.selectedChannels);
  const [channelQuantities, setChannelQuantities] = useState<Record<string, number>>(initialForm.channelQuantities);
  const [areas, setAreas] = useState(initialForm.areas);
  const [showExtraChannels, setShowExtraChannels] = useState(false);
  // Visão compacta (preferência lembrada em cookie): tudo mais denso, todos os
  // canais à vista e os dois textos longos com o tamanho de sempre.
  const [compact, setCompact] = useState(Boolean(initialCompact));
  const toggleCompact = () => {
    const next = !compact;
    setCompact(next);
    document.cookie = `${AE_VIEW_COOKIE}=${next ? 'compact' : 'normal'}; path=/; max-age=31536000; SameSite=Lax`;
  };
  const [selectedActionFlows, setSelectedActionFlows] = useState<string[]>(initialForm.selectedActionFlows);

  const [hasSSO, setHasSSO] = useState(initialForm.hasSSO);
  const [hasTeamsSideConv, setHasTeamsSideConv] = useState(initialForm.hasTeamsSideConv);
  const [hasSlackSideConv, setHasSlackSideConv] = useState(initialForm.hasSlackSideConv);

  const [hasAppCondicionais, setHasAppCondicionais] = useState(initialForm.hasAppCondicionais);
  const [hasAppTicketManager, setHasAppTicketManager] = useState(initialForm.hasAppTicketManager);

  /** Aplica um estado completo de formulário (restauração ou limpeza). */
  const applyForm = (form: ReturnType<typeof formFromInitial>) => {
    setClientName(form.clientName);
    setClientObjectives(form.clientObjectives);
    setSuccessIndicators(form.successIndicators);
    setSelectedModules(form.selectedModules);
    setKnowledgeArticles(form.knowledgeArticles);
    setOperationTypes(form.operationTypes);
    setSkuType(form.skuType);
    setDeploymentType(form.deploymentType);
    setHasAppsMarketplace(form.hasAppsMarketplace);
    setSelectedApps(form.selectedApps);
    setAppQuantities(form.appQuantities);
    setOtherApp(form.otherApp);
    setZendeskPlan(form.zendeskPlan);
    setHasNativeConnections(form.hasNativeConnections);
    setSelectedNativeConnections(form.selectedNativeConnections);
    setAgents(form.agents);
    setBrands(form.brands);
    setSelectedChannels(form.selectedChannels);
    setChannelQuantities(form.channelQuantities);
    setAreas(form.areas);
    setSelectedActionFlows(form.selectedActionFlows);
    setHasSSO(form.hasSSO);
    setHasTeamsSideConv(form.hasTeamsSideConv);
    setHasSlackSideConv(form.hasSlackSideConv);
    setHasAppCondicionais(form.hasAppCondicionais);
    setHasAppTicketManager(form.hasAppTicketManager);
  };

  const resetForm = () => {
    applyForm(formFromInitial(null, ''));
    setZohoLink('');
    setShowResult(false);
    setResultSnapshot(null);
    setSaveState({ status: 'idle' });
  };

  /**
   * Chave ESTÁVEL do payload vindo do servidor.
   *
   * `initialData` é um objeto novo em cada render do server component, então usar
   * a identidade dele como dependência do efeito abaixo fazia o formulário ser
   * reidratado sempre que a rota era revalidada — inclusive pelo
   * `revalidatePath('/ae')` que o próprio save dispara. Numa nova versão isso
   * jogava os inputs de volta para a configuração da versão clonada. Comparando
   * o CONTEÚDO serializado, a reidratação só acontece quando os dados realmente
   * mudam (outro cloneFrom, outro cliente).
   */
  const initialDataKey = useMemo(() => {
    try {
      return JSON.stringify({ d: initialData ?? null, c: initialClientName ?? '', v: cloneFromId ?? null });
    } catch {
      return String(initialClientName ?? '');
    }
  }, [initialData, initialClientName, cloneFromId]);

  // Começa marcado como hidratado: o estado inicial JÁ veio de `formFromInitial`.
  // O efeito abaixo só reidrata quando os dados mudam sem remontar a página
  // (ex.: outro ?cloneFrom= pela navegação do próprio app).
  const hydratedKeyRef = useRef<string | null>(initialDataKey);
  /**
   * Verdadeiro durante o commit de uma REIDRATAÇÃO (dados novos sem remontar).
   * Os efeitos de consistência abaixo rodam nesse mesmo commit ainda com o
   * estado anterior; a trava evita que zerem artigos ou filtrem módulos com
   * base nele. No commit seguinte eles rodam de novo, já com o estado novo.
   */
  const justHydratedRef = useRef(false);
  /** Momento da última hidratação/limpeza — base da guarda de alterações. */
  const [hydratedAt, setHydratedAt] = useState(() => Date.now());

  useEffect(() => {
    // Já hidratamos exatamente este payload — não sobrescrever o que o usuário
    // editou desde então.
    if (hydratedKeyRef.current === initialDataKey) return;
    hydratedKeyRef.current = initialDataKey;
    justHydratedRef.current = true;
    setHydratedAt(Date.now());
    applyForm(formFromInitial(initialData, initialClientName));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialDataKey]);

  useEffect(() => {
    const sku = normalizeSku(skuType);
    if (!isSideConversationEligible(sku, zendeskPlan)) {
      setHasTeamsSideConv(false);
      setHasSlackSideConv(false);
    }
  }, [skuType, zendeskPlan]);

  const planRank = useMemo(
    () => PLAN_RANK[zendeskPlan as keyof typeof PLAN_RANK] || PLAN_RANK.team,
    [zendeskPlan]
  );

  const availableModules = useMemo(() => {
    // Sem 'AI Agents': a Calculadora AE não dimensiona esse módulo (ele
    // continua disponível no Framework e no painel administrativo).
    const baseModules: string[] = ['Support', 'Knowledge', 'Voice'];

    // Analytics exige Professional+ — antes era oferecido em qualquer plano, o que
    // fazia o treinamento contar e o workshop não (regras discordantes no engine).
    if (planRank >= PLAN_RANK.professional) {
      baseModules.push('Analytics', 'Community', 'QA', 'WFM', 'Copilot');
    }

    if (planRank >= PLAN_RANK.enterprise) {
      baseModules.push('ADPP');
    }

    return baseModules;
  }, [planRank]);

  useEffect(() => {
    // Commit da hidratação: o estado restaurado ainda não está visível aqui.
    if (justHydratedRef.current) return;
    if (!selectedModules.includes('Support')) {
      setHasSSO(false);
      setHasTeamsSideConv(false);
      setHasSlackSideConv(false);
      }

    if (!selectedModules.includes('Knowledge')) {
      setKnowledgeArticles(0);
    }
  }, [selectedModules]);

  useEffect(() => {
    // Commit da hidratação: o plano restaurado ainda não está visível aqui.
    if (justHydratedRef.current) return;
    setSelectedModules(prev => {
      const filtered = prev.filter(module => availableModules.includes(module));
      return filtered.length > 0 ? filtered : ['Support'];
    });
  }, [availableModules]);

  /**
   * O canal Voice e o módulo Voice são interdependentes no engine: a quantidade de
   * IVR vem de channelQuantities.voice, mas as horas só são faturadas quando o
   * módulo Voice está selecionado. Marcar apenas um dos dois produzia silenciosamente
   * ~0 hora de voz, então ligamos o módulo automaticamente ao escolher o canal.
   */
  useEffect(() => {
    if (justHydratedRef.current) return;
    const voiceChannelOn = selectedChannels.includes('voice') && (channelQuantities.voice ?? 1) > 0;
    if (voiceChannelOn && availableModules.includes('Voice')) {
      setSelectedModules(prev => (prev.includes('Voice') ? prev : [...prev, 'Voice']));
    }
  }, [selectedChannels, channelQuantities, availableModules]);

  // Último efeito do commit: libera a trava da hidratação para os próximos.
  useEffect(() => {
    justHydratedRef.current = false;
  });

  const handleNewSimulation = () => {
    // Limpar o formulário descarta o que não foi salvo (inclusive um salvamento
    // que falhou): pede confirmação, como sair da página.
    if (!confirmLeaveForm()) return;
    resetForm();
    // Formulário limpo é o novo ponto de partida da guarda de alterações.
    setHydratedAt(Date.now());
    // Recarrega a URL sem parâmetros
    window.history.pushState({}, '', '/ae');
  };
 
  // Canais (lista compartilhada com a página da estimativa salva).
  const { main: channelOptions, extra: extraChannelOptions } = aeChannelOptions(t);

  // `value` é o nome canônico em português — é ele que vai para o banco e para o
  // engine de cálculo. `label` é só exibição e segue o idioma ativo.
  const nativeConnectionOptions = useMemo(() => {
    return packages
      // Categoria configurável no painel Admin › Calculadora AE.
      .filter((p: any) => p.categoryName === (aeConfig?.settings?.nativeIntegrationsCategory || 'Integrações Nativas'))
      .map((p: any) => ({ value: p.name as string, label: packageName(p, language) }));
  }, [packages, language, aeConfig]);

  const marketplaceOptions = useMemo(
    () => [
      { value: 'WooCommerce', label: 'WooCommerce' },
      { value: 'Dialpad', label: 'Dialpad' },
      { value: 'Aircall', label: 'Aircall' },
      { value: 'VTEX', label: 'VTEX' },
      { value: 'Stripe', label: 'Stripe' },
      { value: 'Pipedrive', label: 'Pipedrive' },
      { value: 'SweetHawk', label: 'SweetHawk' },
      { value: 'Outros', label: t('ae.otherMarketplace') },
    ],
    [t],
  );

  const toggleChannel = (id: string) => {
    setSelectedChannels(prev => {
      const isSelected = prev.includes(id);
      if (isSelected) {
        if (prev.length === 1) return prev;
        const newChannels = prev.filter(i => i !== id);
        const newQuantities = { ...channelQuantities };
        delete newQuantities[id];
        setChannelQuantities(newQuantities);
        return newChannels;
      } else {
        setChannelQuantities(prev => ({ ...prev, [id]: 1 }));
        return [...prev, id];
      }
    });
  };

  const handleChannelQtyChange = (id: string, qty: number) => {
    setChannelQuantities(prev => ({ ...prev, [id]: Math.max(0, qty) }));
  };

  const toggleModule = (id: string) => {
    setSelectedModules(prev => {
      const isSelected = prev.includes(id);
      return isSelected
        ? (prev.length === 1 ? prev : prev.filter(i => i !== id))
        : [...prev, id];
    });
  };

  const toggleOperationType = (id: string) => {
    setOperationTypes(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const toggleApp = (id: string) => {
    setSelectedApps(prev => {
      const isSelected = prev.includes(id);
      if (isSelected) {
        const newApps = prev.filter(i => i !== id);
        if (id === 'SweetHawk' || id === 'Outros') {
          const newQuantities = { ...appQuantities };
          delete newQuantities[id];
          setAppQuantities(newQuantities);
        }
        return newApps;
      } else {
        if (id === 'SweetHawk' || id === 'Outros') {
          setAppQuantities(prev => ({ ...prev, [id]: 1 }));
        }
        return [...prev, id];
      }
    });
  };

  const handleAppQtyChange = (id: string, qty: number) => {
    setAppQuantities(prev => ({ ...prev, [id]: Math.max(0, qty) }));
  };

  const toggleNativeConnection = (id: string) => {
    setSelectedNativeConnections(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const toggleActionFlow = (name: string) => {
    setSelectedActionFlows(prev =>
      prev.includes(name) ? prev.filter(item => item !== name) : [...prev, name]
    );
  };

  const addActionFlow = (name: string) => {
    if (!name) return;

    setSelectedActionFlows(prev =>
      prev.includes(name) ? prev : [...prev, name]
    );
  };

  const canUseSideConversations = useMemo(
    () => isSideConversationEligible(normalizeSku(skuType), zendeskPlan),
    [skuType, zendeskPlan]
  );

  const { engineInputs, engineResult, validation, estimation } = useMemo(() => {
    const formState = {
      agents,
      brands,
      areas,
      selectedChannels,
      channelQuantities,
      selectedModules,
      operationTypes,
      skuType,
      zendeskPlan,
      knowledgeArticles,
      selectedApps,
      appQuantities,
      selectedNativeConnections,
      selectedActionFlows,
      hasSSO,
      hasTeamsSideConv,
      hasSlackSideConv,
      hasAppCondicionais,
      hasAppTicketManager,
    };
    const inputs = buildEngineInputs(formState);
    const validation = validateAEInputs(inputs);
    let result: ReturnType<typeof calculateAEEstimate> | null = null;
    if (validation.valid) {
      try {
        result = calculateAEEstimate(inputs, aeConfig);
      } catch (err) {
        // Antes o erro era engolido em silêncio e a estimativa saía zerada, o que
        // parecia um resultado válido. Agora fica registrado no console.
        console.error('AE engine failed:', err);
        result = null;
      }
    }

    const db = result || {
      lineItemHours: 0,
      discoveryHours: 0,
      validationHours: 0,
      goLiveHours: 0,
      commTechHours: 0,
      gpHours: 0,
      totalHours: 0,
      requiresSalesEngineer: false,
      breakdown: {},
      quantities: {},
    };

    const totalHours =
      db.lineItemHours +
      db.discoveryHours +
      db.validationHours +
      db.goLiveHours +
      db.commTechHours +
      db.gpHours;

    return {
      engineInputs: inputs,
      // Saída crua do engine — usada pela tabela de resultado. Sai daqui em vez
      // de um setState dentro do useMemo (atualização em fase de render).
      engineResult: result,
      validation,
      estimation: {
        total: totalHours,
        techHours: db.lineItemHours,
        needsSC: db.requiresSalesEngineer,
        escalationRequired: db.requiresSalesEngineer,
        escalationMessage:
          t('ae.escalationDefault'),
        breakdown: db.breakdown || {},
        quantities: db.quantities || {},
        lineItemHours: db.lineItemHours,
        discoveryHours: db.discoveryHours,
        validationHours: db.validationHours,
        goLiveHours: db.goLiveHours,
        commTechHours: db.commTechHours,
        gpHours: db.gpHours,
        calculatedResults: {
          support: {
            funcoes: (db.quantities as any).funcoes ?? 0,
            grupos: (db.quantities as any).grupos ?? 0,
            campos_ticket: (db.quantities as any).campos_ticket ?? 0,
            condicionais_campos: (db.quantities as any).condicionais_campos ?? 0,
            campos_usuario: (db.quantities as any).campos_usuario ?? 0,
            campos_organizacao: (db.quantities as any).campos_organizacao ?? 0,
            visualizacoes: (db.quantities as any).visualizacoes ?? 0,
            macros: (db.quantities as any).macros ?? 0,
            gatilhos_simples: (db.quantities as any).gatilhos_simples ?? 0,
            gatilhos_complexos: (db.quantities as any).gatilhos_complexos ?? 0,
            automacoes_simples: (db.quantities as any).automacoes_simples ?? 0,
            automacoes_complexas: (db.quantities as any).automacoes_complexas ?? 0,
            politicas_sla: (db.quantities as any).politicas_sla ?? 0,
          },
          analytics: {
            horas_estimadas: (db.breakdown as any).generalConfig || 0,
          },
          knowledge: { horas_estimadas: (db.breakdown as any).knowledge || 0 },
          voice: {
            ivr: (db.quantities as any).ivr ?? 0,
            saudacoes: (db.quantities as any).saudacoes ?? 0,
          },
          copilot: {
            intencoes_personalizadas: (db.quantities as any).intencoes ?? 0,
            entidades: (db.quantities as any).entidades ?? 0,
            procedimentos: (db.quantities as any).procedimentos ?? 0,
          },
          wfm: {
            grupos_trabalho: (db.quantities as any).wfm_grupos_trabalho ?? 0,
            equipes: (db.quantities as any).wfm_equipes ?? 0,
            turnos: (db.quantities as any).wfm_turnos ?? 0,
          },
          qa: {
            filtros: (db.quantities as any).qa_filtros ?? 0,
            quizzes: (db.quantities as any).qa_quizzes ?? 0,
            tabelas_desempenho: (db.quantities as any).qa_tabelas_desempenho ?? 0,
          },
          apps_aktie_now: {
            condicionais_avancadas_horas: (db.breakdown as any).appCondicionais || 0,
            ticket_manager_horas: (db.breakdown as any).appTicketManager || 0,
          },
          action_flows: {
            horas_estimadas: (db.breakdown as any).actionFlows || 0,
            quantidade: inputs.selectedActionFlows?.length || 0,
          },
          workshops: { horas_estimadas: (db.breakdown as any).workshops || 0 },
          trainings: { horas_estimadas: (db.breakdown as any).training || 0 },
          variables: {
            discovery: db.discoveryHours,
            validation: db.validationHours,
            comunicacao_tecnica: db.commTechHours,
            go_live: db.goLiveHours,
            gp: db.gpHours,
          },
        },
      },
    };
  }, [
    agents,
    brands,
    areas,
    selectedChannels,
    channelQuantities,
    selectedModules,
    operationTypes,
    skuType,
    zendeskPlan,
    knowledgeArticles,
    selectedApps,
    appQuantities,
    selectedNativeConnections,
    selectedActionFlows,
    hasSSO,
    hasTeamsSideConv,
    hasSlackSideConv,
    hasAppCondicionais,
    hasAppTicketManager,
    aeConfig,
  ]);

  /* ------------------------------------------------------------------------ */
  /*               SALVAMENTO (com erro detalhado) e GUARDA                    */
  /* ------------------------------------------------------------------------ */

  type SaveError = { message: string; code?: string; details?: string; step: string; at: string };
  const [saveState, setSaveState] = useState<{
    status: 'idle' | 'saving' | 'saved' | 'error';
    error?: SaveError;
    id?: number;
    version?: number;
  }>({ status: 'idle' });
  const lastSavePayloadRef = useRef<any>(null);
  const [saveErrorCopied, setSaveErrorCopied] = useState(false);

  /** Tudo o que o salvar grava do formulário, num texto comparável. */
  const aeFormSnapshot = JSON.stringify({
    clientName, zohoLink, clientObjectives, successIndicators, selectedModules, knowledgeArticles,
    operationTypes, skuType, deploymentType, selectedApps, appQuantities, otherApp, zendeskPlan,
    selectedNativeConnections, selectedActionFlows, agents, brands, selectedChannels, channelQuantities,
    areas, hasSSO, hasTeamsSideConv, hasSlackSideConv, hasAppCondicionais, hasAppTicketManager,
  });
  // Ponto de partida da guarda. É ESTADO (não ref) para que, ao acompanhar o
  // formulário logo depois de carregar, a tela re-renderize e a guarda desarme.
  const [aeBaseline, setAeBaseline] = useState<string>(aeFormSnapshot);
  // Logo após carregar (ou limpar) o formulário, os efeitos de consistência
  // ainda ajustam o estado em cascata: nesse intervalo o ponto de partida
  // acompanha, e a guarda fica desligada, para não acusar alterações que o
  // usuário não fez.
  const SETTLE_MS = 800;
  const inSettleWindow = Date.now() - hydratedAt < SETTLE_MS;
  useEffect(() => {
    if (Date.now() - hydratedAt < SETTLE_MS && aeBaseline !== aeFormSnapshot) setAeBaseline(aeFormSnapshot);
  }, [aeFormSnapshot, hydratedAt, aeBaseline]);
  const isFormDirty = !inSettleWindow && aeFormSnapshot !== aeBaseline;
  const { confirmLeave: confirmLeaveForm } = useUnsavedChangesGuard(
    isFormDirty && saveState.status !== 'saving',
    t('common.unsavedChangesConfirm'),
  );

  const persistEstimate = async (payload: any, snapshotAtSave: string) => {
    lastSavePayloadRef.current = { payload, snapshotAtSave };
    setSaveState({ status: 'saving' });
    setIsPending(true);
    try {
      const result: any = await saveAEEstimateAction(payload);
      if (result?.ok) {
        setSaveState({ status: 'saved', id: result.id, version: result.version });
        setAeBaseline(snapshotAtSave);
      } else {
        setSaveState({
          status: 'error',
          error: result?.error || { message: t('errors.aeSaveFailed'), step: 'unknown', at: new Date().toISOString() },
        });
      }
    } catch (error: any) {
      // Falha de rede/servidor antes de a action responder.
      console.error('Error saving estimate:', error);
      setSaveState({
        status: 'error',
        error: {
          message: t('ae.saveErrorRequest'),
          details: String(error?.message || error),
          step: 'request',
          at: new Date().toISOString(),
        },
      });
    } finally {
      setIsPending(false);
    }
  };

  const retrySave = () => {
    const last = lastSavePayloadRef.current;
    if (last) void persistEstimate(last.payload, last.snapshotAtSave);
  };

  const copySaveErrorDetails = async () => {
    const err = saveState.error;
    if (!err) return;
    const text = [
      `${t('ae.saveErrorTitle')}`,
      `${t('ae.saveErrorMessage')}: ${err.message}`,
      err.code ? `${t('ae.saveErrorCode')}: ${err.code}` : '',
      `${t('ae.saveErrorStep')}: ${err.step}`,
      `${t('ae.saveErrorAt')}: ${err.at}`,
      `${t('ae.saveErrorClient')}: ${clientName}`,
      err.details ? `${t('ae.saveErrorDetails')}:\n${err.details}` : '',
    ].filter(Boolean).join('\n');
    try { await navigator.clipboard.writeText(text); } catch { /* sem permissão: o texto continua na tela */ }
    setSaveErrorCopied(true);
    setTimeout(() => setSaveErrorCopied(false), 2500);
  };

  const handleCalculate = async () => {
    if (!validation.valid) {
      setIsPending(false);
      return;
    }

    setIsPending(true);
    

    // Congela o resultado ANTES de salvar. O save chama revalidatePath('/ae'),
    // o que reinjeta `initialData` e faz o formulário voltar ao estado clonado;
    // sem este congelamento o painel passaria a exibir a versão anterior.
    setResultSnapshot({
      engineResult,
      engineInputs,
      total: estimation.total,
      techHours: estimation.techHours,
      needsSC: estimation.needsSC,
      variables: estimation.calculatedResults.variables,
      clientName,
    });
    setShowResult(true);

    setIsPending(false);
    await persistEstimate({
        clientName,
        zohoLink,
        clientObjectives,
        successIndicators,
        engineInputs,
        selectedModules,
        knowledgeArticles,
        operationTypes,
        skuType,
        deploymentType,
        selectedApps,
        otherApp,
        zendeskPlan,
        selectedNativeConnections,
        selectedActionFlows,
        agents,
        brands,
        channels: selectedChannels,
        channelQuantities,
        areas,
        hasSSO,
        hasTeamsSideConv,
        hasSlackSideConv,
        hasAppCondicionais,
        hasAppTicketManager,
        resultHours: estimation.total,
        needsSC: estimation.needsSC,
        appQuantities,
        parentId: cloneFromId || undefined,
        aeConfigId: aeConfigId ?? null,
        // Horas efetivas usadas no cálculo (com as da biblioteca já aplicadas):
        // a estimativa reabre igual mesmo que a biblioteca mude depois.
        aeNumbers: { numbers: aeConfig.numbers, nativeIntegrationHours: aeConfig.nativeIntegrationHours || null },
      }, aeFormSnapshot);
  };

  /**
   * Valores do painel de resultado. SEMPRE do snapshot congelado no cálculo —
   * nunca do `estimation` vivo, que continua reagindo a mudanças de estado.
   * O fallback só existe para satisfazer a tipagem; `showResult` só vira true
   * depois de `setResultSnapshot`.
   */
  const shown = resultSnapshot ?? {
    engineResult: null,
    engineInputs: null,
    total: 0,
    techHours: 0,
    needsSC: false,
    variables: {} as Record<string, number>,
    clientName: '',
  };
  const shownVar = (key: string) => Number(shown.variables?.[key] ?? 0);

  /* ------------------------------------------------------------------------ */
  /*        EXPORTAÇÃO DO ESCOPO COMO PROMPT PARA A SKILL scope-creator        */
  /* ------------------------------------------------------------------------ */

  /**
   * Monta o mesmo envelope que o framework gera, mudando apenas `ORIGEM` e
   * `TEMPLATE`. A skill não precisa saber de onde veio: o template escolhido é
   * que define a estrutura do documento.
   *
   * Sai do SNAPSHOT congelado, não do estado vivo — assim o prompt descreve a
   * estimativa que foi calculada e salva, e não um rascunho editado depois.
   */
  const scopePromptInput = useMemo<AEScopePromptInput | null>(() => {
    // O prompt descreve a estimativa SALVA, com o número de versão que o
    // servidor atribuiu (antes saía o número da versão de origem do clone).
    if (!resultSnapshot || saveState.status !== 'saved') return null;

    const appQuantitiesByLabel = appQuantities || {};
    return {
      estimate: resultSnapshot.engineResult,
      inputs: resultSnapshot.engineInputs,
      clientName: resultSnapshot.clientName,
      versionLabel: saveState.version != null ? `v${saveState.version}` : null,
      zohoLink,
      preSalesName: (session?.user as any)?.name || null,
      // Texto livre do AE — vira o bloco [CONTEXTO DO CLIENTE] no prompt, que é
      // o que permite à skill escrever dores e objetivos sem inventar.
      clientObjectives,
      successIndicators,
      deploymentType,
      // Mesma lista da tela de visualização (ver marketplaceAppsForPrompt).
      marketplaceApps: marketplaceAppsForPrompt(selectedApps, appQuantitiesByLabel),
      otherApp: selectedApps.includes('Outros') ? otherApp : '',
      hasAppCondicionais,
      hasAppTicketManager,
      // O prompt sai no idioma da interface: quem trabalha em inglês recebe as
      // instruções em inglês e IDIOMA DE SAÍDA: en-US.
      locale: language,
      // Sem rótulos próprios: os canais saem com os nomes canônicos de
      // lib/ae-scope-prompt.ts, iguais aos da tela de visualização.
      skuLabel: skuType === 'employee_service'
        ? t('plans.employeeService')
        : t('plans.customerService'),
      generatedAt: new Date(),
    };
  }, [
    resultSnapshot, selectedApps, appQuantities, otherApp, hasAppCondicionais,
    hasAppTicketManager, zohoLink, clientObjectives, successIndicators,
    deploymentType, skuType, saveState.status, saveState.version, session, language, t,
  ]);

  const scopePrompt = useMemo(() => (scopePromptInput ? buildAEScopePrompt(scopePromptInput) : ''), [scopePromptInput]);

  const [scopePromptCopied, setScopePromptCopied] = useState(false);
  const [scopePromptLoading, setScopePromptLoading] = useState(false);

  const handleCopyScopePrompt = async () => {
    if (!scopePromptInput) return;
    setScopePromptLoading(true);
    const zohoSection = await zohoSectionFor(scopePromptInput.zohoLink);
    setScopePromptLoading(false);
    const text = buildAEScopePrompt({ ...scopePromptInput, zohoSection });
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy'); } catch (_) {}
      document.body.removeChild(ta);
    }
    setScopePromptCopied(true);
    setTimeout(() => setScopePromptCopied(false), 2500);
  };

  return (
    <div className="max-w-7xl mx-auto space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="space-y-4">
            <h1 className="text-brand-dark font-heading text-page leading-none">
              {t('ae.titleCalculator')} <span className="text-brand-primary">{t('ae.titleAE')}</span>
            </h1>
            <p className="text-slate-400 text-label mt-4 font-medium ">{t('ae.subtitle')}</p>
            {initialVersion != null && (
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-brand-primary/10 border border-brand-primary/20 rounded-2xl">
                <BookOpen className="w-3.5 h-3.5 text-brand-primary" />
                <span className="text-label font-medium text-brand-primary">
                  {cloneFromId ? t('ae.newVersionFrom', { version: initialVersion }) : t('ae.versionBadge', { version: initialVersion })}
                </span>
              </div>
            )}
          </div>
          <div className="flex items-center space-x-4">
            <Link 
              href="/ae/history"
              className="bg-white border border-slate-200 text-slate-400 px-6 py-3 rounded-2xl text-label font-medium flex items-center space-x-2 hover:border-brand-primary hover:text-brand-primary transition-all"
            >
              <Clock className="w-4 h-4" />
              <span>{t('ae.myHistory')}</span>
            </Link>
            <button
              type="button"
              onClick={toggleCompact}
              aria-pressed={compact}
              title={t('ae.compactViewHint')}
              className={`px-5 py-3 rounded-2xl text-label font-medium flex items-center gap-2 border transition-all ${
                compact ? 'border-brand-primary bg-brand-soft text-brand-dark' : 'bg-white border-slate-200 text-slate-400 hover:border-brand-primary hover:text-brand-primary'
              }`}
            >
              <Rows3 className="w-4 h-4" />
              <span>{t('ae.compactView')}</span>
            </button>
            {showResult && (
              <button 
                onClick={handleNewSimulation}
                className="text-brand-primary font-medium text-label flex items-center space-x-2 hover:opacity-70 transition-all"
              >
                <Plus className="w-4 h-4 rotate-45" />
                <span>{t('ae.newSimulation')}</span>
              </button>
            )}
          </div>
        </div>

      {!showResult ? (
        <div className={`grid grid-cols-1 lg:grid-cols-2 gap-10 ${compact ? 'ae-compact' : ''}`}>
          {/* Left Column: Strategic & Operation */}
          <div className="space-y-8">
            <div className="bg-white rounded-3xl border border-slate-200 p-10 shadow-xl shadow-slate-200/50 space-y-8">
              <div className="flex items-center space-x-4 border-b border-slate-50 pb-6">
                <div className="bg-brand-primary/10 p-3 rounded-2xl text-brand-primary">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <h2 className="text-xl font-bold text-brand-dark tracking-tight">{t('ae.strategicInfo')}</h2>
              </div>
              
              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="text-label font-medium text-slate-400 ml-1">{t('ae.clientName')}</label>
                  <input 
                    type="text" 
                    value={clientName}
                    onChange={(e) => setClientName(e.target.value)}
                    placeholder={t('ae.clientNamePlaceholder')}
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 text-body font-bold focus:ring-2 focus:ring-brand-primary focus:bg-white outline-none transition-all"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-label font-medium text-slate-400 ml-1">{t('ae.dealLink')}</label>
                  <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-300 group-focus-within:text-brand-primary transition-colors">
                      <Search className="w-4 h-4" />
                    </div>
                    <input 
                      type="url" 
                      value={zohoLink}
                      onChange={(e) => setZohoLink(e.target.value)}
                      placeholder="https://crm.zoho.com/..." 
                      className="w-full bg-slate-50 border border-slate-200 rounded-2xl pl-10 pr-6 py-4 text-body font-bold focus:ring-2 focus:ring-brand-primary focus:bg-white outline-none transition-all placeholder:text-slate-300" 
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-label font-medium text-slate-400 ml-1">{t('ae.clientObjectives')}</label>
                  <textarea 
                    value={clientObjectives}
                    onChange={(e) => setClientObjectives(e.target.value)}
                    className="ae-long-text w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 text-body font-medium focus:ring-2 focus:ring-brand-primary focus:bg-white outline-none transition-all h-24 resize-none"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-label font-medium text-slate-400 ml-1">{t('ae.successIndicators')}</label>
                  <textarea 
                    value={successIndicators}
                    onChange={(e) => setSuccessIndicators(e.target.value)}
                    className="ae-long-text w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 text-body font-medium focus:ring-2 focus:ring-brand-primary focus:bg-white outline-none transition-all h-24 resize-none"
                  />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-3xl border border-slate-200 p-10 shadow-xl shadow-slate-200/50 space-y-8">
              <div className="flex items-center space-x-4 border-b border-slate-50 pb-6">
                <div className="bg-brand-primary/10 p-3 rounded-2xl text-brand-primary">
                  <Layers className="w-6 h-6" />
                </div>
                <h2 className="text-xl font-bold text-brand-dark tracking-tight">{t('ae.modulesSection')}</h2>
              </div>

              <div className="space-y-8">
                <div className="space-y-4">
                  <label className="text-label font-medium text-slate-400 ml-1">{t('ae.modules')}</label>
                  <div className={`grid gap-3 ${compact ? 'grid-cols-3 sm:grid-cols-4' : 'grid-cols-2 sm:grid-cols-3'}`}>
                    {availableModules.map(m => (
                      <button
                        key={m}
                        onClick={() => toggleModule(m)}
                        className={`p-3 rounded-xl border text-caption font-medium tracking-tight transition-all ${
                          selectedModules.includes(m)
                            ? 'bg-brand-primary border-brand-primary text-brand-ink shadow-lg'
                            : 'bg-slate-50 border-slate-200 text-slate-400 hover:border-brand-primary/30'
                        }`}
                      >
                        {m}
                      </button>
                    ))}
                  </div>
                </div>

                {/* O seletor de treinamento Básico/Avançado de Analytics foi
                    removido: Analytics entra pelo treinamento de Suite, como
                    Support e Knowledge. */}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-4">
                    <label className="text-label font-medium text-slate-400 ml-1">{t('ae.operationType')}</label>
                    <div className="flex flex-wrap gap-2">
                      {['B2C', 'B2B', 'B2E'].map(t => (
                        <button
                          key={t}
                          onClick={() => toggleOperationType(t)}
                          className={`px-4 py-2 rounded-xl border text-caption font-medium transition-all ${
                            operationTypes.includes(t)
                              ? 'bg-brand-primary border-brand-primary text-brand-ink shadow-lg shadow-brand-primary/20'
                              : 'bg-white border-slate-200 text-slate-400 hover:border-brand-primary/30'
                          }`}
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-4">
                    <label className="text-label font-medium text-slate-400 ml-1">{t('ae.sku')}</label>
                    <div className="flex bg-slate-100 p-1 rounded-xl">
                      <button onClick={() => setSkuType('customer_service')} className={`flex-1 py-2 rounded-lg text-caption font-medium transition-all ${skuType === 'customer_service' ? 'bg-white text-brand-dark shadow-sm' : 'text-slate-400'}`}>{t('ae.skuCustomer')}</button>
                      <button onClick={() => setSkuType('employee_service')} className={`flex-1 py-2 rounded-lg text-caption font-medium transition-all ${skuType === 'employee_service' ? 'bg-white text-brand-dark shadow-sm' : 'text-slate-400'}`}>{t('ae.skuEmployee')}</button>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <label className="text-label font-medium text-slate-400 ml-1">{t('ae.deployment')}</label>
                  <div className="flex bg-slate-100 p-1 rounded-xl">
                    <button onClick={() => setDeploymentType('new')} className={`flex-1 py-2 rounded-lg text-caption font-medium transition-all ${deploymentType === 'new' ? 'bg-brand-primary text-brand-ink shadow-sm' : 'text-slate-400'}`}>{t('ae.deploymentNew')}</button>
                    <button onClick={() => setDeploymentType('optimization')} className={`flex-1 py-2 rounded-lg text-caption font-medium transition-all ${deploymentType === 'optimization' ? 'bg-brand-primary text-brand-ink shadow-sm' : 'text-slate-400'}`}>{t('ae.deploymentOptimization')}</button>
                  </div>
                </div>

                <div className="space-y-6 pt-6 border-t border-slate-100">
                  <label className="text-label font-medium text-slate-400 ml-1">{t('ae.additionalServices')}</label>
                  
                  {/* Support Additional Services */}
                  {selectedModules.includes('Support') && (
                    <div className="space-y-4 animate-in fade-in slide-in-from-top-2">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {[
                          { id: 'sso', label: t('ae.singleSignOn'), state: hasSSO, setter: setHasSSO, icon: ShieldCheck },
                          ...(canUseSideConversations
                            ? [
                                { id: 'teams', label: t('ae.sideConvTeams'), state: hasTeamsSideConv, setter: setHasTeamsSideConv, icon: MessageSquare },
                                { id: 'slack', label: t('ae.sideConvSlack'), state: hasSlackSideConv, setter: setHasSlackSideConv, icon: Hash }
                              ]
                            : []),
                        ].map(item => (
                          <label key={item.id} className={`flex items-center justify-between p-4 rounded-xl border transition-all cursor-pointer ${item.state ? 'bg-brand-primary/5 border-brand-primary' : 'bg-slate-50 border-slate-200 opacity-60'}`}>
                            <div className="flex items-center space-x-3">
                              <item.icon className={`w-4 h-4 ${item.state ? 'text-brand-primary' : 'text-slate-400'}`} />
                              <span className={`text-caption font-medium ${item.state ? 'text-brand-dark' : 'text-slate-500'}`}>{item.label}</span>
                            </div>
                            <input type="checkbox" checked={item.state} onChange={(e) => item.setter(e.target.checked)} className="w-5 h-5 rounded border-slate-300 text-brand-primary focus:ring-brand-primary" />
                          </label>
                        ))}
                      </div>
                      {!canUseSideConversations && (
                        <p className="text-caption font-medium text-slate-400 px-1">
                          {t('ae.sideConvNotice')}
                        </p>
                      )}
                    </div>
                  )}

                  {/* Knowledge Additional Services */}
                  {selectedModules.includes('Knowledge') && (
                    <div className="space-y-4 mt-4 animate-in fade-in slide-in-from-top-2">
                      <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <BookOpen className="w-4 h-4 text-slate-400" />
                          <span className="text-caption font-medium text-slate-500">{t('ae.articleCount')}</span>
                        </div>
                        <input 
                          type="number" 
                          min="0" 
                          value={knowledgeArticles} 
                          onChange={(e) => setKnowledgeArticles(Math.max(0, parseInt(e.target.value) || 0))}
                          className="w-16 bg-white border border-slate-200 rounded-lg px-2 py-1 text-label font-medium text-center"
                        />
                      </div>
                    </div>
                  )}

                  {!selectedModules.includes('Support') && !selectedModules.includes('Knowledge') && (
                    <p className="text-caption font-medium text-slate-400 text-center py-4 italic">
                      {t('ae.selectSupportHint')}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Volume, Channels & Zendesk */}
          <div className="space-y-8">
            <div className="bg-slate-50/50 rounded-3xl border border-slate-200 p-10 shadow-inner space-y-8">
              <div className="flex items-center space-x-4 border-b border-slate-200/50 pb-6">
                <div className="bg-brand-soft text-brand-soft-fg p-3 rounded-2xl">
                  <Users className="w-6 h-6" />
                </div>
                <h2 className="text-xl font-bold text-brand-dark tracking-tight">{t('ae.volumeAndChannels')}</h2>
              </div>

              <div className="grid grid-cols-3 gap-6">
                <div className="space-y-2">
                  <label className="text-caption font-medium text-slate-400 ml-1">{t('ae.agents')}</label>
                  <input type="number" min="1" value={agents} onChange={(e) => setAgents(Math.max(1, parseInt(e.target.value) || 1))} className="w-full bg-white border border-slate-200 rounded-2xl px-6 py-4 text-body font-bold focus:ring-2 focus:ring-brand-primary outline-none" />
                </div>
                <div className="space-y-2">
                  <label className="text-caption font-medium text-slate-400 ml-1">{t('ae.brands')}</label>
                  <input type="number" min="1" value={brands} onChange={(e) => setBrands(Math.max(1, parseInt(e.target.value) || 1))} className="w-full bg-white border border-slate-200 rounded-2xl px-6 py-4 text-body font-bold focus:ring-2 focus:ring-brand-primary outline-none" />
                </div>
                <div className="space-y-2">
                  <label className="text-caption font-medium text-slate-400 ml-1">{t('ae.areas')}</label>
                  <input type="number" min="1" value={areas} onChange={(e) => setAreas(Math.max(1, parseInt(e.target.value) || 1))} className="w-full bg-white border border-slate-200 rounded-2xl px-6 py-4 text-body font-bold focus:ring-2 focus:ring-brand-primary outline-none" />
                </div>
              </div>

                <div className="space-y-4">
                  <label className="text-label font-medium text-slate-400 ml-1">{t('ae.activeChannels')}</label>
                  <div className={`grid gap-3 ${compact ? 'grid-cols-2 sm:grid-cols-3' : 'grid-cols-1 sm:grid-cols-2'}`}>
                    {(compact ? [...channelOptions, ...extraChannelOptions] : channelOptions).map((opt) => (
                      <div key={opt.id} className={`flex items-center justify-between p-3 rounded-2xl border transition-all ${
                        selectedChannels.includes(opt.id) ? 'bg-white border-brand-primary shadow-sm' : 'bg-transparent border-slate-200 opacity-60'
                      }`}>
                        <button
                          onClick={() => toggleChannel(opt.id)}
                          className={`flex-1 text-left text-caption font-medium tracking-tight ${selectedChannels.includes(opt.id) ? 'text-brand-dark' : 'text-slate-400'}`}
                        >
                          {opt.label}
                        </button>
                        {selectedChannels.includes(opt.id) && (
                          <div className="flex items-center space-x-2 animate-in zoom-in-90 duration-300">
                            <span className="text-caption font-medium text-slate-300 ">{t('common.qtyShort')}</span>
                            <input 
                              type="number" 
                              min="0"
                              value={channelQuantities[opt.id] ?? 1} 
                              onChange={(e) => handleChannelQtyChange(opt.id, parseInt(e.target.value) ?? 0)}
                              className="w-12 bg-slate-50 border border-slate-100 rounded-lg px-2 py-1 text-label font-medium text-center"
                            />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Ver mais canais (na visão compacta todos já estão à vista) */}
                  {!compact && (
                  <div className="mt-4">
                    <button
                      onClick={() => setShowExtraChannels(!showExtraChannels)}
                      className="text-caption font-medium text-brand-primary flex items-center space-x-2 hover:opacity-70 transition-all ml-1"
                    >
                      <Plus className={`w-3 h-3 transition-transform duration-300 ${showExtraChannels ? 'rotate-45' : ''}`} />
                      <span>{showExtraChannels ? t('ae.showFewerChannels') : t('ae.showMoreChannels')}</span>
                    </button>

                    {showExtraChannels && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4 animate-in fade-in slide-in-from-top-2 duration-300">
                        {extraChannelOptions.map((opt) => (
                          <div key={opt.id} className={`flex items-center justify-between p-3 rounded-2xl border transition-all ${
                            selectedChannels.includes(opt.id) ? 'bg-white border-brand-primary shadow-sm' : 'bg-transparent border-slate-200 opacity-60'
                          }`}>
                            <button
                              onClick={() => toggleChannel(opt.id)}
                              className={`flex-1 text-left text-caption font-medium tracking-tight ${selectedChannels.includes(opt.id) ? 'text-brand-dark' : 'text-slate-400'}`}
                            >
                              {opt.label}
                            </button>
                            {selectedChannels.includes(opt.id) && (
                              <div className="flex items-center space-x-2 animate-in zoom-in-90 duration-300">
                                <span className="text-caption font-medium text-slate-300 ">{t('common.qtyShort')}</span>
                                <input 
                                  type="number" 
                                  min="0"
                                  value={channelQuantities[opt.id] ?? 1} 
                                  onChange={(e) => handleChannelQtyChange(opt.id, parseInt(e.target.value) ?? 0)}
                                  className="w-12 bg-slate-50 border border-slate-100 rounded-lg px-2 py-1 text-label font-medium text-center"
                                />
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  )}
                </div>
            </div>

            <div className="bg-white rounded-3xl border border-slate-200 p-10 shadow-xl shadow-slate-200/50 space-y-8">
              <div className="flex items-center space-x-4 border-b border-slate-50 pb-6">
                <div className="bg-brand-secondary/10 p-3 rounded-2xl text-brand-secondary">
                  <Settings className="w-6 h-6" />
                </div>
                <h2 className="text-xl font-bold text-brand-dark tracking-tight">{t('ae.zendeskEcosystem')}</h2>
              </div>

              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="text-label font-medium text-slate-400 ml-1">{t('ae.zendeskPlan')}</label>
                  <select value={zendeskPlan} onChange={(e) => setZendeskPlan(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 text-body font-bold outline-none focus:ring-2 focus:ring-brand-primary transition-all">
                    <option value="team">{t('ae.planTeam')}</option>
                    <option value="growth">{t('ae.planGrowth')}</option>
                    <option value="professional">{t('ae.planProfessional')}</option>
                    <option value="enterprise">{t('ae.planEnterprise')}</option>
                  </select>
                </div>

                <div className="space-y-4">
                  <label className="text-label font-medium text-slate-400 ml-1">{t('ae.actionFlow')}</label>
                  <div className="p-6 bg-slate-50 rounded-3xl border border-slate-200 space-y-4">
                    <select
                      value=""
                      onChange={(e) => addActionFlow(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-2xl px-6 py-4 text-body font-bold outline-none focus:ring-2 focus:ring-brand-primary transition-all"
                    >
                      <option value="" disabled>
                        {t('ae.selectActionFlow')}
                      </option>
                      {ACTION_FLOW_OPTIONS.map(flow => (
                        <option key={flow} value={flow} disabled={selectedActionFlows.includes(flow)}>
                          {flow}
                        </option>
                      ))}
                    </select>

                    {selectedActionFlows.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {selectedActionFlows.map(flow => (
                          <button
                            key={flow}
                            onClick={() => toggleActionFlow(flow)}
                            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-brand-primary/30 bg-brand-primary/10 text-brand-primary text-caption font-medium transition-all hover:opacity-90 dark:bg-[color:var(--bg-input)] dark:border-[color:var(--border-main)] dark:text-[color:var(--accent)]"
                          >
                            <span>{flow}</span>
                            <X className="w-3 h-3" />
                          </button>
                        ))}
                      </div>
                    )}

                  </div>
                </div>

                <div className="space-y-4">
                  <label className="text-label font-medium text-slate-400 ml-1">{t('ae.aktieApps')}</label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <label className={`flex items-center justify-between p-4 rounded-xl border cursor-pointer transition-all ${hasAppCondicionais ? 'bg-brand-primary/5 border-brand-primary' : 'bg-slate-50 border-slate-200 opacity-60 hover:border-brand-primary/30'}`}>
                      <div className="flex items-center space-x-3">
                        <Box className={`w-4 h-4 ${hasAppCondicionais ? 'text-brand-primary' : 'text-slate-400'}`} />
                        <span className={`text-caption font-medium ${hasAppCondicionais ? 'text-brand-dark' : 'text-slate-500'}`}>{t('ae.advancedConditionals')}</span>
                      </div>
                      <input type="checkbox" checked={hasAppCondicionais} onChange={(e) => setHasAppCondicionais(e.target.checked)} className="w-5 h-5 rounded border-slate-300 text-brand-primary focus:ring-brand-primary" />
                    </label>
                    <label className={`flex items-center justify-between p-4 rounded-xl border cursor-pointer transition-all ${hasAppTicketManager ? 'bg-brand-primary/5 border-brand-primary' : 'bg-slate-50 border-slate-200 opacity-60 hover:border-brand-primary/30'}`}>
                      <div className="flex items-center space-x-3">
                        <Box className={`w-4 h-4 ${hasAppTicketManager ? 'text-brand-primary' : 'text-slate-400'}`} />
                        <span className={`text-caption font-medium ${hasAppTicketManager ? 'text-brand-dark' : 'text-slate-500'}`}>{t('ae.ticketManager')}</span>
                      </div>
                      <input type="checkbox" checked={hasAppTicketManager} onChange={(e) => setHasAppTicketManager(e.target.checked)} className="w-5 h-5 rounded border-slate-300 text-brand-primary focus:ring-brand-primary" />
                    </label>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <label className="text-label font-medium text-slate-400 ml-1">{t('ae.marketplaceApps')}</label>
                    {!hasAppsMarketplace && (
                      <button
                        type="button"
                        onClick={() => setHasAppsMarketplace(true)}
                        className="text-caption font-medium text-brand-primary hover:opacity-70 transition-all"
                      >
                        {t('ae.enableSelection')}
                      </button>
                    )}
                  </div>
                  {hasAppsMarketplace && (
                    <div className="p-6 bg-slate-50 rounded-3xl border border-slate-200 space-y-4 animate-in fade-in slide-in-from-top-2">
                      <div className="flex flex-wrap gap-2">
                        {marketplaceOptions.map(({ value: app, label: appLabel }) => (
                          <div key={app} className="flex items-center space-x-2">
                            <button
                              onClick={() => toggleApp(app)}
                              className={`px-4 py-2 rounded-xl border text-caption font-medium transition-all ${
                                selectedApps.includes(app) ? 'bg-brand-primary border-brand-primary text-brand-ink shadow-lg' : 'bg-white border-slate-200 text-slate-400 hover:border-brand-primary/30'
                              }`}
                            >
                              {appLabel}
                            </button>
                            {selectedApps.includes(app) && (app === 'SweetHawk' || app === 'Outros') && (
                              <div className="flex items-center space-x-2 animate-in zoom-in-90 duration-300">
                                <span className="text-caption font-medium text-slate-300 ">{t('common.qtyShort')}</span>
                                <input 
                                  type="number" 
                                  min="0"
                                  value={appQuantities[app] ?? 1} 
                                  onChange={(e) => handleAppQtyChange(app, parseInt(e.target.value) ?? 0)}
                                  className="w-12 bg-white border border-slate-200 rounded-lg px-2 py-1 text-label font-medium text-center text-brand-dark focus:ring-1 focus:ring-brand-primary outline-none"
                                />
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                      {selectedApps.includes('Outros') && (
                        <input type="text" value={otherApp} onChange={(e) => setOtherApp(e.target.value)} placeholder={t('ae.otherAppsPlaceholder')} className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-label font-bold" />
                      )}
                    </div>
                  )}
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <label className="text-label font-medium text-slate-400 ml-1">{t('ae.nativeConnections')}</label>
                    {!hasNativeConnections && (
                      <button
                        type="button"
                        onClick={() => setHasNativeConnections(true)}
                        className="text-caption font-medium text-brand-primary hover:opacity-70 transition-all"
                      >
                        {t('ae.enableSelection')}
                      </button>
                    )}
                  </div>
                  {hasNativeConnections && (
                    <div className="p-6 bg-slate-50 rounded-3xl border border-slate-200 space-y-4 animate-in fade-in slide-in-from-top-2">
                      <div className="flex flex-wrap gap-2">
                        {nativeConnectionOptions.map(({ value: conn, label: connLabel }) => (
                          <button
                            key={conn}
                            onClick={() => toggleNativeConnection(conn)}
                            className={`px-4 py-2 rounded-xl border text-caption font-medium transition-all ${
                              selectedNativeConnections.includes(conn) ? 'bg-brand-primary border-brand-primary text-brand-ink shadow-lg' : 'bg-white border-slate-200 text-slate-400 hover:border-brand-primary/30'
                            }`}
                          >
                            {connLabel}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="bg-brand-dark dark:bg-[color:var(--bg-card)] rounded-3xl p-10 space-y-8 text-[color:var(--bg-main)] shadow-2xl dark:border dark:border-[color:var(--border-main)] dark:text-[color:var(--text-main)]">
              <div className="flex items-center space-x-4 border-b border-white/10 dark:border-[color:var(--border-main)] pb-6">
                <div className="brand-bg-primary p-3 rounded-2xl text-brand-ink">
                  <Zap className="w-6 h-6" />
                </div>
                <h2 className="text-xl font-bold tracking-tight dark:text-[color:var(--text-main)]">{t('ae.finishEstimate')}</h2>
              </div>

              {!validation.valid && (validation.issues || []).length > 0 && (
                <div className="space-y-2">
                  <p className="text-caption font-medium text-amber-400 ">{t('ae.beforeCalculating')}</p>
                  <ul className="space-y-1">
                    {/* As mensagens vêm do engine como CÓDIGO + parâmetros, não
                        como frase pronta — antes apareciam sempre em inglês,
                        mesmo com a interface em português. */}
                    {(validation.issues || []).map((issue, i) => (
                      <li key={issue.code + i} className="text-caption font-bold text-slate-300 dark:text-[color:var(--text-muted)] leading-relaxed">
                        • {t(`aeValidation.${issue.code}`, { ...(issue.params || {}), defaultValue: issue.message })}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              
              <p className="text-label font-medium text-slate-400 dark:text-[color:var(--text-muted)] leading-relaxed">
                {t('ae.reviewNotice')}
              </p>

              <button
                onClick={handleCalculate}
                disabled={!clientName || isPending || !validation.valid}
                className="w-full brand-bg-primary text-brand-ink p-6 rounded-2xl font-medium text-label shadow-xl hover:opacity-90 active:scale-95 transition-all flex items-center justify-center space-x-4 disabled:opacity-50 disabled:active:scale-100"
              >
                {isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Zap className="w-5 h-5" />}
                <span>{t('ae.generateEstimate')}</span>
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="animate-in zoom-in-95 fade-in duration-500 max-w-4xl mx-auto">
          <div className={`rounded-[4rem] p-16 shadow-2xl relative overflow-hidden text-center space-y-12 ${
            shown.needsSC
              ? 'bg-amber-50 border-4 border-amber-200 text-amber-900 dark:bg-[color:var(--bg-card)] dark:text-[color:var(--text-main)] dark:border-[color:var(--accent)]'
              : 'bg-brand-dark text-[color:var(--bg-main)] dark:bg-[color:var(--bg-card)] dark:text-[color:var(--text-main)] dark:border dark:border-[color:var(--border-main)]'
          }`}>
            <div className="absolute top-0 right-0 p-12 opacity-5 pointer-events-none">
              {shown.needsSC ? <AlertTriangle className="w-64 h-64 text-amber-500 dark:text-[color:var(--accent)]" /> : <ShieldCheck className="w-64 h-64 text-white dark:text-[color:var(--accent)]" />}
            </div>

            <div className="relative z-10 space-y-8">
              <div className="flex flex-col items-center space-y-4">
                <div className={`w-20 h-20 rounded-3xl flex items-center justify-center shadow-2xl ${
                  shown.needsSC
                    ? 'bg-amber-200 text-amber-700 dark:bg-[color:var(--accent)]/20 dark:text-[color:var(--accent)]'
                    : 'brand-bg-primary text-brand-ink dark:bg-[color:var(--primary)] dark:text-brand-ink'
                }`}>
                  {shown.needsSC ? <AlertTriangle className="w-10 h-10" /> : <CheckCircle2 className="w-10 h-10" />}
                </div>
                <div>
                  <h3 className={`text-body font-bold ${
                    shown.needsSC
                      ? 'text-amber-600 dark:text-[color:var(--accent)]'
                      : 'text-slate-400 dark:text-[color:var(--text-muted)]'
                  }`}>
                    {t('ae.resultFor', { name: shown.clientName })}
                  </h3>
                </div>
              </div>

              <div className="space-y-2">
                <div className={`text-8xl font-bold ${
                  shown.needsSC
                    ? 'text-amber-700 dark:text-[color:var(--accent)]'
                    : 'text-brand-accent dark:text-[color:var(--accent)]'
                }`}>
                  {shown.needsSC ? t('ae.consultSC') : `${shown.total.toFixed(0)}H`}
                </div>
                <p className={`text-lg font-bold ${
                  shown.needsSC
                    ? 'text-amber-600 dark:text-[color:var(--accent)]'
                    : 'text-slate-400 dark:text-[color:var(--text-muted)]'
                }`}>
                  {shown.needsSC ? t('ae.effortNeedsSC') : t('ae.estimatedEffort')}
                </p>
              </div>

              {!shown.needsSC && (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-6 max-w-2xl mx-auto pt-8 border-t border-white/10 dark:border-[color:var(--border-main)]">
                  <div className="text-center p-4 bg-white/5 dark:bg-[color:var(--bg-input)] rounded-2xl">
                    <span className="text-caption font-medium text-slate-500 dark:text-[color:var(--text-muted)] block mb-1">{t('editor.skillImplementation')}</span>
                    <span className="text-xl font-bold tracking-tight dark:text-[color:var(--text-main)]">{shown.techHours.toFixed(1)}H</span>
                  </div>
                  <div className="text-center p-4 bg-white/5 dark:bg-[color:var(--bg-input)] rounded-2xl">
                    <span className="text-caption font-medium text-slate-500 dark:text-[color:var(--text-muted)] block mb-1">{t('ae.gp')}</span>
                    <span className="text-xl font-bold tracking-tight text-brand-secondary dark:text-[color:var(--secondary)]">{shownVar('gp').toFixed(1)}H</span>
                  </div>
                  <div className="text-center p-4 bg-white/5 dark:bg-[color:var(--bg-input)] rounded-2xl">
                    <span className="text-caption font-medium text-slate-500 dark:text-[color:var(--text-muted)] block mb-1">{t('ae.discovery')}</span>
                    <span className="text-xl font-bold tracking-tight text-amber-500 dark:text-[color:var(--accent)]">{shownVar('discovery').toFixed(1)}H</span>
                  </div>
                  <div className="text-center p-4 bg-white/5 dark:bg-[color:var(--bg-input)] rounded-2xl">
                    <span className="text-caption font-medium text-slate-500 dark:text-[color:var(--text-muted)] block mb-1">{t('ae.validation')}</span>
                    <span className="text-xl font-bold tracking-tight text-brand-dark dark:text-[color:var(--text-main)]">{shownVar('validation').toFixed(1)}H</span>
                  </div>
                  <div className="text-center p-4 bg-white/5 dark:bg-[color:var(--bg-input)] rounded-2xl">
                    <span className="text-caption font-medium text-slate-500 dark:text-[color:var(--text-muted)] block mb-1">{t('ae.techComm')}</span>
                    <span className="text-xl font-bold tracking-tight text-brand-dark dark:text-[color:var(--text-main)]">{shownVar('comunicacao_tecnica').toFixed(1)}H</span>
                  </div>
                  <div className="text-center p-4 bg-white/5 dark:bg-[color:var(--bg-input)] rounded-2xl">
                    <span className="text-caption font-medium text-slate-500 dark:text-[color:var(--text-muted)] block mb-1">{t('ae.goLive')}</span>
                    <span className="text-xl font-bold tracking-tight text-green-500 dark:text-[color:var(--text-main)]">{shownVar('go_live').toFixed(1)}H</span>
                  </div>
                </div>
              )}
            </div>

            <div className="relative z-10 pt-10">
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                {saveState.status === 'saving' && (
                  <div className="flex items-center space-x-3 text-label font-medium text-slate-400 dark:text-[color:var(--text-muted)]">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>{t('ae.savingRecord')}</span>
                  </div>
                )}
                {saveState.status === 'saved' && (
                  <div className="flex items-center space-x-3 text-label font-medium text-brand-primary dark:text-[color:var(--primary)]">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>{t('ae.recordSavedVersion', { version: saveState.version })}</span>
                  </div>
                )}
              </div>
              {/* Erro de salvamento: explicado por inteiro, para o usuário poder reportar. */}
              {saveState.status === 'error' && saveState.error && (
                <div role="alert" className="mt-2 text-left rounded-3xl border-2 border-red-300 bg-red-50 text-red-900 dark:bg-red-950/40 dark:text-red-100 dark:border-red-800 p-6 space-y-4 max-w-2xl mx-auto">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5 text-red-600" />
                    <div className="space-y-1">
                      <h4 className="text-body font-bold">{t('ae.saveErrorTitle')}</h4>
                      <p className="text-label">{t('ae.saveErrorExplanation')}</p>
                    </div>
                  </div>
                  <dl className="text-label grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
                    <dt className="font-bold">{t('ae.saveErrorMessage')}</dt>
                    <dd>{saveState.error.message}</dd>
                    {saveState.error.code && (<><dt className="font-bold">{t('ae.saveErrorCode')}</dt><dd className="font-mono">{saveState.error.code}</dd></>)}
                    <dt className="font-bold">{t('ae.saveErrorStep')}</dt>
                    <dd className="font-mono">{saveState.error.step}</dd>
                    <dt className="font-bold">{t('ae.saveErrorAt')}</dt>
                    <dd className="font-mono">{new Date(saveState.error.at).toLocaleString(dateLocale)}</dd>
                  </dl>
                  {saveState.error.details && (
                    <details className="text-caption">
                      <summary className="cursor-pointer font-bold">{t('ae.saveErrorDetails')}</summary>
                      <pre className="mt-2 whitespace-pre-wrap break-all font-mono bg-white/70 dark:bg-black/30 rounded-xl p-3 max-h-48 overflow-auto">{saveState.error.details}</pre>
                    </details>
                  )}
                  <div className="flex flex-wrap gap-3">
                    <button type="button" onClick={retrySave} disabled={isPending} className="px-4 py-2 rounded-xl bg-red-600 text-white text-label font-medium hover:bg-red-700 disabled:opacity-50">
                      {t('ae.saveErrorRetry')}
                    </button>
                    <button type="button" onClick={copySaveErrorDetails} className="px-4 py-2 rounded-xl border border-red-300 text-label font-medium hover:bg-red-100 dark:hover:bg-red-900/40">
                      {saveErrorCopied ? t('ae.saveErrorCopied') : t('ae.saveErrorCopy')}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Tabela de itens considerados — detalhe conforme o segmento do LEITOR */}
          <div className="mt-12">
            <div className="bg-white dark:bg-[color:var(--bg-card)] dark:border dark:border-[color:var(--border-main)] rounded-3xl border border-slate-200 p-8 md:p-10 shadow-xl">
              <AEResultTable estimation={shown.engineResult} inputs={shown.engineInputs} />

              {/* Escopo Padrão: mesmo envelope do framework, template menor.
                  Cópia manual por decisão de projeto — sem chamada de API. */}
              <div className="mt-8 pt-8 border-t border-slate-100 dark:border-[color:var(--border-main)] flex flex-wrap items-center justify-between gap-4">
                <p className="text-caption font-bold text-slate-400 dark:text-[color:var(--text-muted)] max-w-md leading-relaxed">
                  {t('editor.copyScopePromptHint')}
                </p>
                <button
                  type="button"
                  onClick={handleCopyScopePrompt}
                  disabled={!scopePrompt || scopePromptLoading}
                  title={scopePrompt ? undefined : t('ae.scopePromptNeedsSave')}
                  className={`shrink-0 px-6 py-3 rounded-2xl text-label font-medium transition-all flex items-center gap-2 disabled:opacity-50 ${
                    scopePromptCopied
                      ? 'brand-bg-primary text-brand-ink'
                      : 'bg-slate-50 dark:bg-[color:var(--bg-input)] border border-slate-200 dark:border-[color:var(--border-main)] text-slate-500 dark:text-[color:var(--text-muted)] hover:border-brand-primary hover:text-brand-primary'
                  }`}
                >
                  {scopePromptLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : scopePromptCopied ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{scopePromptLoading ? t('editor.scopePromptLoadingZoho') : scopePromptCopied ? t('editor.scopePromptCopied') : t('editor.copyScopePrompt')}</span>
                </button>
              </div>
            </div>
          </div>


          <div className="mt-12 text-center">
          </div>
        </div>
      )}
    </div>
  );
}
