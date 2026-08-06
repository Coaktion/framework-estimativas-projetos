'use client';

import { useState, useMemo, useEffect } from 'react';
import { 
  Zap, Plus, X, ShieldCheck, 
  Globe, Layers, 
  Settings, Loader2,
  AlertTriangle, CheckCircle2, 
  MessageSquare, Users, Shield, Clock, Box,
  Copy, BookOpen, Hash, Search
} from 'lucide-react';
import Link from 'next/link';
import { saveAEEstimateAction } from './actions';
import {
  ACTION_FLOW_OPTIONS,
  calculateAEEstimate,
  validateAEInputs,
  type AEInputData,
  type ModuleKey,
  type ChannelKey,
  type ZendeskPlan,
  type SkuType,
  type OperationType,
  type MarketplaceAppKey,
} from '@/lib/ae-engine';

const PLAN_RANK = {
  team: 1,
  growth: 2,
  professional: 3,
  enterprise: 4
} as const;

const MARKETPLACE_APP_LABEL_TO_KEY: Record<string, MarketplaceAppKey> = {
  'WooCommerce': 'woocommerce',
  'Woo Commerce': 'woocommerce',
  'Dialpad': 'dialpad',
  'Aircall': 'aircall',
  'VTEX': 'vtex',
  'Stripe': 'stripe',
  'Pipedrive': 'pipedrive',
  'SweetHawk': 'sweethawk',
  'Outros': 'other_marketplace',
  'App Marketplace': 'other_marketplace',
  'Outro Marketplace': 'other_marketplace',
  'other_marketplace': 'other_marketplace',
};

function isSideConversationEligible(skuType: SkuType, zendeskPlan: ZendeskPlan): boolean {
  const planRank = PLAN_RANK[zendeskPlan] ?? 1;
  if (skuType === 'CS') {
    return planRank >= PLAN_RANK.professional;
  }
  return planRank >= PLAN_RANK.growth;
}

function normalizeSku(raw: string): SkuType {
  const key = String(raw || '').toUpperCase();
  if (key.includes('ES') || key.includes('EMPLOYEE')) return 'ES';
  return 'CS';
}

function normalizeAnalyticsTraining(raw: string): 'basic' | 'advanced' {
  return String(raw || '').toLowerCase() === 'advanced' ? 'advanced' : 'basic';
}

const CHANNEL_LEGACY_TO_KEY: Record<string, ChannelKey> = {
  web_form: 'web_form',
  email: 'email',
  web_widget: 'web_widget',
  whatsapp: 'whatsapp',
  facebook: 'facebook_messenger',
  facebook_messenger: 'facebook_messenger',
  instagram: 'instagram_dm',
  instagram_dm: 'instagram_dm',
  instagram_page: 'instagram_page',
  voice: 'voice',
  teams: 'microsoft_teams',
  microsoft_teams: 'microsoft_teams',
  slack: 'slack',
  x: 'x_dm',
  x_dm: 'x_dm',
  x_pages: 'x_pages',
  sms: 'sms',
  ios: 'ios',
  unity: 'unity',
  line: 'line',
  apple_business: 'apple_messages',
  apple_messages: 'apple_messages',
  wechat: 'wechat',
  google_rcs: 'google_rcs',
  google_business: 'google_business_messages',
  google_business_messages: 'google_business_messages',
  kakaotalk: 'kakaotalk',
  facebook_pages: 'facebook_pages',
  telegram: 'telegram',
};

function buildEngineInputs(formState: any): AEInputData {
  const selectedChannels: ChannelKey[] = (formState.selectedChannels || [])
    .map((c: string) => CHANNEL_LEGACY_TO_KEY[c])
    .filter(Boolean);

  const channelQuantities: Partial<Record<ChannelKey, number>> = {};
  for (const [k, v] of Object.entries<number>(formState.channelQuantities || {})) {
    const key = CHANNEL_LEGACY_TO_KEY[k];
    if (!key) continue;
    channelQuantities[key] = Math.max(0, Number(v) || 0);
  }

  const selectedApps: MarketplaceAppKey[] = [];
  const appQuantities: Partial<Record<MarketplaceAppKey, number>> = {};
  for (const appLabel of formState.selectedApps || []) {
    const key = MARKETPLACE_APP_LABEL_TO_KEY[String(appLabel)];
    if (!key) continue;
    if (!selectedApps.includes(key)) selectedApps.push(key);
    const qtyRaw = formState.appQuantities?.[appLabel];
    if (qtyRaw != null) {
      appQuantities[key] = Math.max(0, Number(qtyRaw) || 0);
    }
  }

  const sku = normalizeSku(formState.skuType);
  const zendeskPlan = (String(formState.zendeskPlan || 'professional').toLowerCase().replace(/^suite\s+/, '').trim() as ZendeskPlan) || 'professional';
  const planRank = PLAN_RANK[zendeskPlan] ?? PLAN_RANK.team;

  const selectedModules = (formState.selectedModules || ['Support']).filter((m: string) => {
    if (['Community', 'Copilot', 'QA', 'WFM'].includes(m)) return planRank >= PLAN_RANK.professional;
    if (m === 'ADPP') return planRank >= PLAN_RANK.enterprise;
    return true;
  }) as ModuleKey[];

  const inputs: AEInputData = {
    agents: Math.max(1, Number(formState.agents) || 1),
    brands: Math.max(1, Number(formState.brands) || 1),
    areas: Math.max(1, Number(formState.areas) || 1),
    skuType: sku,
    zendeskPlan,
    operationTypes: ((formState.operationTypes || []) as OperationType[]).filter(Boolean),
    selectedModules: selectedModules.length ? selectedModules : ['Support'],
    selectedChannels: selectedChannels.length ? selectedChannels : ['web_form'],
    channelQuantities,
    knowledgeArticles: Math.max(0, Number(formState.knowledgeArticles) || 0),
    operationLanguages: Math.max(1, Number(formState.operationLanguages) || 1),
    analyticsTrainingType: normalizeAnalyticsTraining(formState.analyticsTrainingType),
    selectedNativeConnections: formState.selectedNativeConnections || [],
    selectedActionFlows: formState.selectedActionFlows || [],
    selectedApps,
    appQuantities,
    hasAppCondicionais: Boolean(formState.hasAppCondicionais),
    hasAppTicketManager: Boolean(formState.hasAppTicketManager),
    hasSSO: Boolean(formState.hasSSO),
    hasTeamsSideConv: isSideConversationEligible(sku, zendeskPlan) && Boolean(formState.hasTeamsSideConv),
    hasSlackSideConv: isSideConversationEligible(sku, zendeskPlan) && Boolean(formState.hasSlackSideConv),
  };

  return inputs;
}

export default function AEClient({ packages, variables, initialClientName = '', initialData = null, initialVersion = null, cloneFromId = null }: any) {
  const [isPending, setIsPending] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const [markdownReport, setMarkdownReport] = useState('');

  const [clientName, setClientName] = useState(initialClientName);
  const [zohoLink, setZohoLink] = useState('');
  const [clientObjectives, setClientObjectives] = useState('');
  const [successIndicators, setSuccessIndicators] = useState('');
  
  const [selectedModules, setSelectedModules] = useState<string[]>(['Support']);
  const [analyticsTrainingType, setAnalyticsTrainingType] = useState<'standard' | 'advanced'>('standard');
  const [knowledgeArticles, setKnowledgeArticles] = useState(0);
  
  const [operationTypes, setOperationTypes] = useState<string[]>([]);
  const [skuType, setSkuType] = useState<'customer_service' | 'employee_service'>('customer_service');
  const [deploymentType, setDeploymentType] = useState<'new' | 'optimization'>('new');
  
  const [hasAppsMarketplace, setHasAppsMarketplace] = useState(false);
  const [selectedApps, setSelectedApps] = useState<string[]>([]);
  const [appQuantities, setAppQuantities] = useState<Record<string, number>>({});
  const [otherApp, setOtherApp] = useState('');
  
  const [zendeskPlan, setZendeskPlan] = useState<'team' | 'growth' | 'professional' | 'enterprise'>('professional');
  const [hasNativeConnections, setHasNativeConnections] = useState(false);
  const [selectedNativeConnections, setSelectedNativeConnections] = useState<string[]>([]);

  const [agents, setAgents] = useState(1);
  const [brands, setBrands] = useState(1);
  const [selectedChannels, setSelectedChannels] = useState<string[]>(['web_form']);
  const [channelQuantities, setChannelQuantities] = useState<Record<string, number>>({ web_form: 1 });
  const [areas, setAreas] = useState(1);
  const [showExtraChannels, setShowExtraChannels] = useState(false);
  const [selectedActionFlows, setSelectedActionFlows] = useState<string[]>([]);

  const [hasSSO, setHasSSO] = useState(false);
  const [hasTeamsSideConv, setHasTeamsSideConv] = useState(false);
  const [hasSlackSideConv, setHasSlackSideConv] = useState(false);
  const [operationLanguages, setOperationLanguages] = useState(1);

  const [hasAppCondicionais, setHasAppCondicionais] = useState(false);
  const [hasAppTicketManager, setHasAppTicketManager] = useState(false);

  const resetForm = () => {
    setClientName('');
    setZohoLink('');
    setClientObjectives('');
    setSuccessIndicators('');
    setSelectedModules(['Support']);
    setAnalyticsTrainingType('standard');
    setKnowledgeArticles(0);
    setOperationTypes([]);
    setSkuType('customer_service');
    setDeploymentType('new');
    setHasAppsMarketplace(false);
    setSelectedApps([]);
    setAppQuantities({});
    setOtherApp('');
    setZendeskPlan('professional');
    setHasNativeConnections(false);
    setSelectedNativeConnections([]);
    setAgents(1);
    setBrands(1);
    setSelectedChannels(['web_form']);
    setChannelQuantities({ web_form: 1 });
    setAreas(1);
    setSelectedActionFlows([]);
    setHasSSO(false);
    setHasTeamsSideConv(false);
    setHasSlackSideConv(false);
    setOperationLanguages(1);
    setHasAppCondicionais(false);
    setHasAppTicketManager(false);
    setShowResult(false);
    setMarkdownReport('');
  };

  useEffect(() => {
    if (initialData && typeof initialData === 'object') {
      const d = initialData;
      if (typeof d.clientObjectives === 'string') setClientObjectives(d.clientObjectives);
      if (typeof d.successIndicators === 'string') setSuccessIndicators(d.successIndicators);
      if (Array.isArray(d.selectedModules) && d.selectedModules.length) setSelectedModules(d.selectedModules.filter(Boolean));
      if (typeof d.analyticsTrainingType === 'string') setAnalyticsTrainingType(d.analyticsTrainingType === 'advanced' ? 'advanced' : 'standard');
      if (d.knowledgeArticles != null) setKnowledgeArticles(Math.max(0, Number(d.knowledgeArticles) || 0));
      if (Array.isArray(d.operationTypes)) setOperationTypes(d.operationTypes.filter(Boolean));
      if (typeof d.skuType === 'string') {
        const sku = String(d.skuType).toLowerCase();
        setSkuType(sku === 'employee_service' || sku === 'es' ? 'employee_service' : 'customer_service');
      }
      if (typeof d.deploymentType === 'string') {
        setDeploymentType(d.deploymentType === 'optimization' ? 'optimization' : 'new');
      }
      if (Array.isArray(d.selectedApps)) {
        setSelectedApps(d.selectedApps.filter(Boolean));
        if (d.selectedApps.length) setHasAppsMarketplace(true);
      }
      if (d.appQuantities && typeof d.appQuantities === 'object') {
        setAppQuantities({ ...d.appQuantities });
      }
      if (typeof d.otherApp === 'string') setOtherApp(d.otherApp);
      if (typeof d.zendeskPlan === 'string') {
        const plan = String(d.zendeskPlan).toLowerCase().replace(/^suite\s+/, '').trim();
        if (['team','growth','professional','enterprise'].includes(plan)) {
          setZendeskPlan(plan as any);
        }
      }
      if (Array.isArray(d.selectedNativeConnections)) {
        setSelectedNativeConnections(d.selectedNativeConnections.filter(Boolean));
        if (d.selectedNativeConnections.length) setHasNativeConnections(true);
      }
      if (Array.isArray(d.selectedActionFlows)) {
        setSelectedActionFlows(d.selectedActionFlows.filter(Boolean));
      }
      if (d.agents != null) setAgents(Math.max(1, Number(d.agents) || 1));
      if (d.brands != null) setBrands(Math.max(1, Number(d.brands) || 1));
      if (Array.isArray(d.channels) && d.channels.length) {
        setSelectedChannels(d.channels.filter(Boolean));
      } else if (Array.isArray(d.selectedChannels) && d.selectedChannels.length) {
        setSelectedChannels(d.selectedChannels.filter(Boolean));
      }
      if (d.channelQuantities && typeof d.channelQuantities === 'object') {
        setChannelQuantities({ ...d.channelQuantities });
      }
      if (d.areas != null) setAreas(Math.max(1, Number(d.areas) || 1));
      setHasSSO(Boolean(d.hasSSO));
      setHasTeamsSideConv(Boolean(d.hasTeamsSideConv));
      setHasSlackSideConv(Boolean(d.hasSlackSideConv));
      if (d.operationLanguages != null) setOperationLanguages(Math.max(1, Number(d.operationLanguages) || 1));
      setHasAppCondicionais(Boolean(d.hasAppCondicionais));
      setHasAppTicketManager(Boolean(d.hasAppTicketManager));
    } else if (initialClientName) {
      setClientName(initialClientName);
    } else {
      resetForm();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialData, initialClientName]);

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
    const baseModules: string[] = ['Support', 'Knowledge', 'Analytics', 'AI Agents'];

    if (planRank >= PLAN_RANK.professional) {
      baseModules.push('Community', 'QA', 'WFM', 'Copilot');
    }

    if (planRank >= PLAN_RANK.enterprise) {
      baseModules.push('ADPP');
    }

    return baseModules;
  }, [planRank]);

  useEffect(() => {
    if (!selectedModules.includes('Support')) {
      setHasSSO(false);
      setHasTeamsSideConv(false);
      setHasSlackSideConv(false);
      setOperationLanguages(1);
    }

    if (!selectedModules.includes('Knowledge')) {
      setKnowledgeArticles(0);
    }
  }, [selectedModules]);

  useEffect(() => {
    setSelectedModules(prev => {
      const filtered = prev.filter(module => availableModules.includes(module));
      return filtered.length > 0 ? filtered : ['Support'];
    });
  }, [availableModules]);

  const handleNewSimulation = () => {
    resetForm();
    // Recarrega a URL sem parâmetros
    window.history.pushState({}, '', '/ae');
  };
 
  // Channels Checklist
  const channelOptions = [
    { id: 'web_form', label: 'Web Form', package: 'Ticket: Formulários/Catálogos (por form)' },
    { id: 'email', label: 'Email', package: 'Ticket: Email (por endereço)' },
    { id: 'web_widget', label: 'Web Widget', package: 'Messaging: Web Widget (por widget)' },
    { id: 'whatsapp', label: 'WhatsApp', package: 'Messaging: LINE' },
    { id: 'facebook', label: 'Facebook', package: 'Messaging: Facebook Messenger (por página)' },
    { id: 'instagram', label: 'Instagram', package: 'Messaging: Instagram Direct (por página)' },
    { id: 'voice', label: 'Voice (Zendesk)', package: 'Voz: Configurações gerais (Fila, Espera)' },
    { id: 'teams', label: 'MS Teams', package: 'Ticket: Microsoft Teams integration' },
    { id: 'slack', label: 'Slack', package: 'Messaging: Slack' },
    { id: 'x', label: 'X (Twitter)', package: 'Ticket: X (Mensagens Públicas)' },
    { id: 'sms', label: 'SMS/Text', package: 'Messaging: Text/SMS (por número)' }
  ];

  const extraChannelOptions = [
    { id: 'ios', label: 'iOS', package: 'Messaging: iOS SDK' },
    { id: 'unity', label: 'Unity', package: 'Messaging: Unity SDK' },
    { id: 'line', label: 'LINE', package: 'Messaging: LINE' },
    { id: 'apple_business', label: 'Apple Messages for Business', package: 'Messaging: Apple Messages' },
    { id: 'wechat', label: 'WeChat', package: 'Messaging: WeChat' },
    { id: 'google_rcs', label: 'Google RCS', package: 'Messaging: Google RCS' },
    { id: 'google_business', label: 'Business Messages do Google', package: 'Messaging: Google Business' },
    { id: 'kakaotalk', label: 'KakaoTalk', package: 'Messaging: KakaoTalk' }
  ];

  const nativeConnectionOptions = useMemo(() => {
    return packages
      .filter((p: any) => p.categoryName === 'Integrações Nativas')
      .map((p: any) => p.name);
  }, [packages]);

  const marketplaceOptions = useMemo(() => {
    return packages
      .filter((p: any) => p.categoryName === 'Marketplace')
      .map((p: any) => p.name);
  }, [packages]);

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
        if (id === 'SweetHawk' || id === 'Outros' || id === 'App Marketplace') {
          const newQuantities = { ...appQuantities };
          delete newQuantities[id];
          setAppQuantities(newQuantities);
        }
        return newApps;
      } else {
        if (id === 'SweetHawk' || id === 'Outros' || id === 'App Marketplace') {
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

  const analyticsTrainingTypeEngine = normalizeAnalyticsTraining(analyticsTrainingType);

  const { engineInputs, validation, estimation } = useMemo(() => {
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
      analyticsTrainingType: analyticsTrainingTypeEngine,
      hasSSO,
      hasTeamsSideConv,
      hasSlackSideConv,
      operationLanguages,
      hasAppCondicionais,
      hasAppTicketManager,
    };
    const inputs = buildEngineInputs(formState);

    const validation = validateAEInputs(inputs);
    let result: ReturnType<typeof calculateAEEstimate> | null = null;
    if (validation.valid) {
      try {
        result = calculateAEEstimate(inputs);
      } catch {
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
      validation,
      estimation: {
        total: totalHours,
        techHours: db.lineItemHours,
        needsSC: db.requiresSalesEngineer,
        escalationRequired: db.requiresSalesEngineer,
        escalationMessage:
          'Esta estimativa excedeu 60h ou contém módulos/dados que requerem a participação de um Sales Engineer (SC) para validação.',
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
            treinamento: analyticsTrainingTypeEngine,
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
    analyticsTrainingTypeEngine,
    hasSSO,
    hasTeamsSideConv,
    hasSlackSideConv,
    operationLanguages,
    hasAppCondicionais,
    hasAppTicketManager,
  ]);

  const handleCalculate = async () => {
    if (!validation.valid) {
      setIsPending(false);
      return;
    }

    setIsPending(true);
    
    const breakdown = (estimation.breakdown || {}) as Record<string, number>;
    const q = (estimation.quantities || {}) as Record<string, number>;

    const num = (v: any, digits = 2) => {
      const n = Number(v) || 0;
      return Number.isFinite(n) ? n.toFixed(digits) : '0.00';
    };

    const modulesList = (selectedModules || []).filter(Boolean);
    const rawChannelsList = (selectedChannels || []).filter(Boolean);
    const channelsKeyList: ChannelKey[] = rawChannelsList
      .map((c) => CHANNEL_LEGACY_TO_KEY[c])
      .filter(Boolean);
    const channelsList = rawChannelsList;
    const nativeList = (selectedNativeConnections || []).filter(Boolean);
    const appsLabels = (selectedApps || []).filter(Boolean);
    const appsKeys = appsLabels
      .map((label) => MARKETPLACE_APP_LABEL_TO_KEY[label] || null)
      .filter((v): v is MarketplaceAppKey => Boolean(v));

    const sweethawkQty = Number(appQuantities['SweetHawk'] ?? 0);
    const otherQty =
      Number(appQuantities['Outros'] ?? 0) ||
      Number(appQuantities['App Marketplace'] ?? 0) ||
      Number(appQuantities['other_marketplace'] ?? 0) ||
      0;
    const oneOffApps = appsKeys.filter((k) => k !== 'sweethawk' && k !== 'other_marketplace');
    const oneOffAppLabels = appsLabels.filter((label) => {
      const k = MARKETPLACE_APP_LABEL_TO_KEY[label];
      return k && k !== 'sweethawk' && k !== 'other_marketplace';
    });

    const extraChannelsQty = channelsKeyList.reduce((acc, ch) => {
      if (ch === 'email' || ch === 'web_form' || ch === 'web_widget' || ch === 'voice') return acc;
      const legacyKey = (Object.keys(CHANNEL_LEGACY_TO_KEY).find(
        (k) => CHANNEL_LEGACY_TO_KEY[k] === ch
      ) as string) || ch;
      const qtyEntry = Math.max(0, Number(channelQuantities[legacyKey as any] || channelQuantities[ch as any] || 0));
      return acc + qtyEntry || (channelsKeyList.includes(ch) ? 1 : 0);
    }, 0);

    const actionFlowsQty = (selectedActionFlows || []).filter(Boolean).length;
    const opLangs = Math.max(1, Number(operationLanguages) || 1);
    const dynamicContentBase = (Number(q.visualizacoes || 0) +
      Number(q.gatilhos_simples || 0) +
      Number(q.gatilhos_complexos || 0) +
      Number(q.automacoes_simples || 0) +
      Number(q.automacoes_complexas || 0) +
      Number(q.intencoes || 0) +
      Number(q.entidades || 0) +
      (String(zendeskPlan || 'professional').toLowerCase() !== 'team' ? 1 : 0)) * (opLangs - 1);

    const supportItems: Array<[string, number, number]> = [
      ['Funções', Number(q.funcoes || 0), 0.25],
      ['Grupos', Number(q.grupos || 0), 0.05],
      ['Campos de Ticket', Number(q.campos_ticket || 0), 0.08],
      ['Condicionais de Campos', Number(q.condicionais_campos || 0), 0.02],
      ['Campos de Usuário', Number(q.campos_usuario || 0), 0.05],
      ['Campos de Organização', Number(q.campos_organizacao || 0), 0.05],
      ['Visualizações', Number(q.visualizacoes || 0), 0.08],
      ['Macros', Number(q.macros || 0), 0.08],
      ['Gatilhos Simples', Number(q.gatilhos_simples || 0), 0.08],
      ['Gatilhos Complexos', Number(q.gatilhos_complexos || 0), 0.33],
      ['Automações Simples', Number(q.automacoes_simples || 0), 0.08],
      ['Automações Complexas', Number(q.automacoes_complexas || 0), 0.33],
      ['Políticas de SLA', Number(q.politicas_sla || 0), 0.17],
    ];

    const voiceItems: Array<[string, number, number]> = [
      ['IVR', Number(q.ivr || 0), 0.59],
      ['Saudações', Number(q.saudacoes || 0), 0.05],
    ];

    const copilotItems: Array<[string, number, number]> = [
      ['Intenções', Number(q.intencoes || 0), 0.25],
      ['Entidades', Number(q.entidades || 0), 0.33],
      ['Procedimentos', Number(q.procedimentos || 0), 0.67],
    ];

    const wfmItems: Array<[string, number, number]> = [
      ['Localizações', Number(q.wfm_localizacoes || 0), 0.25],
      ['Turnos', Number(q.wfm_turnos || 0), 0.25],
      ['Grupos de Trabalho', Number(q.wfm_grupos_trabalho || 0), 0.08],
      ['Equipes', Number(q.wfm_equipes || 0), 0.08],
      ['Motivos de Folga', Number(q.wfm_motivos_folga || 0), 0.08],
      ['Tarefas Gerais', Number(q.wfm_tarefas_gerais || 0), 0.08],
      ['Automações WFM', Number(q.wfm_automacoes || 0), 0.25],
      ['Funções WFM', Number(q.wfm_funcoes || 0), 0.17],
    ];

    const qaItems: Array<[string, number, number]> = [
      ['Destaques', Number(q.qa_destaques || 0), 0.75],
      ['Quizzes', Number(q.qa_quizzes || 0), 0.5],
      ['Filtros', Number(q.qa_filtros || 0), 0.5],
      ['Tabelas de Desempenho', Number(q.qa_tabelas_desempenho || 0), 0.5],
      ['Categorias Manuais', Number(q.qa_categorias_manuais || 0), 0.17],
      ['Categorias IA', Number(q.qa_categorias_ia || 0), 0.5],
      ['Usuários', Number(q.qa_usuarios || 0), 0.05],
      ['Bots', Number(q.qa_bots || 0), 0.17],
      ['Espaço de Trabalho', Number(q.qa_espaco_trabalho || 0), 0.25],
      ['Atribuições', Number(q.qa_atribuicoes || 0), 0.5],
      ['Grupos QA', Number(q.qa_grupos || 0), 0.08],
      ['Hashtags', Number(q.qa_hashtags || 0), 0.05],
    ];

    const renderQtyTable = (rows: Array<[string, number, number]>, totalHoras: number) => {
      const lines = rows.map(([label, qtd, uh]) =>
        `| ${label} | ${num(qtd, 2)} | ${uh.toFixed(2)}h | ${num(qtd * uh, 2)}h |`
      ).join('\n');
      return `| Item | Qtd | H/Unid | Total |
| :--- | ---: | ---: | ---: |
${lines}
| **Subtotal do bloco** | — | — | **${num(totalHoras, 2)}h** |`;
    };

    // Generate Markdown Report
    const report = `
# Relatório Executivo de Estimativa AE — ${clientName}

## 1. Escopo e premissas

- **Cliente:** ${clientName}
${zohoLink ? `- **Deal (Zoho):** ${zohoLink}` : ''}
- **SKU:** ${skuType === 'employee_service' ? 'Employee Service (ES)' : 'Customer Service (CS)'}
- **Tipo de implantação:** ${deploymentType === 'new' ? 'Nova implantação' : 'Otimização de ambiente existente'}
- **Plano Zendesk:** ${String(zendeskPlan || 'professional').toUpperCase()}
- **Módulos selecionados:** ${modulesList.length ? modulesList.join(', ') : '—'}
- **Operações:** ${(operationTypes || []).filter(Boolean).join(', ') || '—'}
- **Idiomas em operação:** ${opLangs}
- **Agentes:** ${agents}
- **Marcas (Brands):** ${brands}
- **Áreas:** ${areas}
- **Artigos (Knowledge):** ${knowledgeArticles}

---

## 2. Blocos de esforço (hours by line-item group)

| Grupo | Horas | Observação |
| :--- | ---: | :--- |
| 2.1 Configuração de Support | ${num(breakdown.supportConfig, 2)}h | Módulo Support |
| 2.2 Configuração de Voice | ${num(breakdown.voiceConfig, 2)}h | Módulo Voice |
| 2.3 Configuração de Copilot | ${num(breakdown.copilotConfig, 2)}h | Módulo Copilot |
| 2.4 Configuração de WFM | ${num(breakdown.wfmConfig, 2)}h | Módulo WFM |
| 2.5 Configuração de QA | ${num(breakdown.qaConfig, 2)}h | Módulo QA |
| 2.6 Setup base (Agentes / Marcas / Canais) | ${num(Number(breakdown.agentSetup || 0) + Number(breakdown.brandSetup || 0) + Number(breakdown.channelSetup || 0), 2)}h | Agentes + Marcas + Canais |
| 2.7 Apps da Aktie Now | ${num(Number(breakdown.appCondicionais || 0) + Number(breakdown.appTicketManager || 0), 2)}h | Condicionais Avançadas + Ticket Manager |
| 2.8 SSO | ${num(breakdown.sso, 2)}h | SAML/JWT/OIDC, se habilitado |
| 2.9 Configurações Gerais por módulo | ${num(breakdown.generalConfig, 2)}h | Config base de cada módulo |
| 2.10 Treinamentos | ${num(breakdown.training, 2)}h | Suite + módulos + Analytics avançado |
| 2.11 Pacotes fixos | ${num(Number(breakdown.supportFixed || 0) + Number(breakdown.wfmFixed || 0) + Number(breakdown.adppFixed || 0), 2)}h | Itens fixos Support/WFM/ADPP |
| 2.12 Integrações nativas | ${num(breakdown.nativeConnections, 2)}h | Flat 2h cada |
| 2.13 Knowledge | ${num(breakdown.knowledge, 2)}h | Artigos |
| 2.14 Side Conversations | ${num(breakdown.sideConversations, 2)}h | Teams/Slack, se elegível por plano |
| 2.15 Apps de terceiros / Marketplace | ${num(breakdown.thirdPartyApps, 2)}h | One-offs + SweetHawk + Outros |
| 2.16 Workshops | ${num(breakdown.workshops, 2)}h | Por módulo habilitado |
| 2.17 Conteúdo dinâmico / múltiplos idiomas | ${num(breakdown.operationLanguages, 2)}h | Base de conteúdo dinâmico × (idiomas - 1) |
| 2.18 Action Flows | ${num(breakdown.actionFlows, 2)}h | Serviços externos |
| | | |
| **Total de line-items** | | **${num(estimation.lineItemHours, 2)}h** |

---

## 3. Detalhamento por módulo / item

### 3.1 Support (${num(breakdown.supportConfig, 2)}h)
${renderQtyTable(supportItems, Number(breakdown.supportConfig || 0))}

### 3.2 Voice (${num(breakdown.voiceConfig, 2)}h)
${modulesList.includes('Voice') || breakdown.voiceConfig ? renderQtyTable(voiceItems, Number(breakdown.voiceConfig || 0)) : '_Módulo Voice não selecionado._'}

### 3.3 Copilot (${num(breakdown.copilotConfig, 2)}h)
${modulesList.includes('Copilot') || breakdown.copilotConfig ? renderQtyTable(copilotItems, Number(breakdown.copilotConfig || 0)) : '_Módulo Copilot não selecionado._'}

### 3.4 WFM (${num(breakdown.wfmConfig, 2)}h)
${modulesList.includes('WFM') || breakdown.wfmConfig ? renderQtyTable(wfmItems, Number(breakdown.wfmConfig || 0)) : '_Módulo WFM não selecionado._'}

### 3.5 QA (${num(breakdown.qaConfig, 2)}h)
${modulesList.includes('QA') || breakdown.qaConfig ? renderQtyTable(qaItems, Number(breakdown.qaConfig || 0)) : '_Módulo QA não selecionado._'}

---

## 4. Setup base
    ${(() => {
      const chQty = (id: ChannelKey | string) => {
        const k: ChannelKey = (CHANNEL_LEGACY_TO_KEY[id] || id) as ChannelKey;
        const legacyKey = (Object.keys(CHANNEL_LEGACY_TO_KEY).find(
          (lk) => CHANNEL_LEGACY_TO_KEY[lk] === k
        ) as string) || id;
        const v =
          Number(channelQuantities[legacyKey as any] ?? 0) ||
          Number(channelQuantities[k as any] ?? 0) ||
          0;
        const active = channelsKeyList.includes(k) || rawChannelsList.includes(id as any);
        if (!active) return 0;
        return v > 0 ? v : 1;
      };
      return `| Item | Qtd | H/Unid | Total |
| :--- | ---: | ---: | ---: |
| Agentes (membros de equipe / setup por agente) | ${agents} | 0.05h | ${num(Number(breakdown.agentSetup || 0), 2)}h |
| Marcas | ${brands} | 0.25h | ${num(Number(breakdown.brandSetup || 0), 2)}h |
| Canais — Email | ${chQty('email')} | 0.17h | ${num(chQty('email') * 0.17, 2)}h |
| Canais — Web Form | ${chQty('web_form')} | 0.08h | ${num(chQty('web_form') * 0.08, 2)}h |
| Canais — Web Widget | ${chQty('web_widget')} | 0.42h | ${num(chQty('web_widget') * 0.42, 2)}h |
| Demais canais (reunião por canal) | ${extraChannelsQty} | 0.17h (min 0.5h se >0) | ${num(Number(breakdown.channelSetup || 0) -
  chQty('email') * 0.17 -
  chQty('web_form') * 0.08 -
  chQty('web_widget') * 0.42, 2)}h |
| **Subtotal** | — | — | **${num(Number(breakdown.agentSetup || 0) + Number(breakdown.brandSetup || 0) + Number(breakdown.channelSetup || 0), 2)}h** |`;
    })()}

### Canais selecionados e quantidades
| Canal | Qtd |
| :--- | ---: |
${channelsList.length ? channelsList.map((c) => {
  const qtd = Math.max(0, Number(channelQuantities[c as any] || 1)) || 0;
  return `| ${c} | ${qtd} |`;
}).join('\n') : '| _(nenhum)_ | — |'}

---

## 5. Apps Aktie Now / Marketplace / Integrações / SideConv / Action Flows

### 5.1 Apps Aktie Now
| App | Horas |
| :--- | ---: |
| Condicionais Avançadas ${hasAppCondicionais ? '(✓)' : '(✗)'} | ${num(breakdown.appCondicionais, 2)}h |
| Ticket Manager ${hasAppTicketManager ? '(✓)' : '(✗)'} | ${num(breakdown.appTicketManager, 2)}h |
| **Subtotal Apps Aktie Now** | **${num(Number(breakdown.appCondicionais || 0) + Number(breakdown.appTicketManager || 0), 2)}h** |

### 5.2 Integrações nativas (flat 2h cada)
| Integração | Total |
| :--- | ---: |
${nativeList.length ? nativeList.map((n) => `| ${n} | 2.00h |`).join('\n') : '| _(nenhuma)_ | — |'}
| **Subtotal integrações nativas** | **${num(breakdown.nativeConnections, 2)}h** |

### 5.3 Side Conversations (se elegível por plano)
| Item | Qtd | H/Unid | Total |
| :--- | ---: | ---: | ---: |
| Microsoft Teams Side Conv | ${hasTeamsSideConv ? 1 : 0} | 0.50h | ${num(hasTeamsSideConv ? 0.5 : 0, 2)}h |
| Slack Side Conv | ${hasSlackSideConv ? 1 : 0} | 0.50h | ${num(hasSlackSideConv ? 0.5 : 0, 2)}h |
| **Subtotal Side Conversations** | — | — | **${num(breakdown.sideConversations, 2)}h** |

### 5.4 Apps de terceiros / Marketplace
| App | Tipo | Qtd | H/Unid | Total |
| :--- | :--- | ---: | ---: | ---: |
${oneOffAppLabels.length ? oneOffAppLabels.map((label) => {
  const key = MARKETPLACE_APP_LABEL_TO_KEY[label] as any;
  const uh = {
    woocommerce: 1.5,
    dialpad: 1.5,
    aircall: 2.0,
    vtex: 1.0,
    stripe: 1.0,
    pipedrive: 1.0,
  }[key] || 0;
  return `| ${label} | One-off | 1 | ${uh.toFixed(2)}h | ${num(uh, 2)}h |`;
}).join('\n') : ''}
${(sweethawkQty || 0) > 0 || (otherQty || 0) > 0 ? [
  (sweethawkQty > 0 ? `| SweetHawk | Contagem | ${sweethawkQty} | 2.00h | ${num(sweethawkQty * 2, 2)}h |` : ''),
  (otherQty > 0 ? `| Outros Marketplace | Contagem | ${otherQty} | 5.00h | ${num(otherQty * 5, 2)}h |` : ''),
].filter(Boolean).join('\n') : ''}
${!(oneOffAppLabels.length || sweethawkQty || otherQty) ? '| _(nenhum)_ | — | — | — | — |' : ''}
| **Subtotal apps / marketplace** | — | — | — | **${num(breakdown.thirdPartyApps, 2)}h** |

### 5.5 Action Flows (integrações externas com serviço)
| Serviço | H/Unid | Total |
| :--- | ---: | ---: |
${actionFlowsQty > 0 ? (selectedActionFlows || []).filter(Boolean).map((name: any) => `| ${ACTION_FLOW_OPTIONS.find((o) => o.value === name)?.label || String(name)} | 4.50h | 4.50h |`).join('\n') : '| _(nenhum)_ | — | — |'}
| **Subtotal Action Flows (${actionFlowsQty})** | — | **${num(breakdown.actionFlows, 2)}h** |

---

## 6. Configurações Gerais / Treinamentos / Itens Fixos / Workshops / Idiomas / SSO / Knowledge

### 6.1 Configurações gerais por módulo (row 52)
| Módulo | H |
| :--- | ---: |
| Support | ${modulesList.includes('Support') ? '1.00h' : '0.00h'} |
| Knowledge (Guide) | ${modulesList.includes('Knowledge') ? '0.10h' : '0.00h'} |
| Community | ${modulesList.includes('Community') ? '1.00h' : '0.00h'} |
| Analytics (Explore) | ${modulesList.includes('Analytics') ? '3.50h' : '0.00h'} |
| Voice (Talk) | ${modulesList.includes('Voice') ? '0.50h' : '0.00h'} |
| Copilot | ${modulesList.includes('Copilot') ? '0.50h' : '0.00h'} |
| QA | ${modulesList.includes('QA') ? '1.00h' : '0.00h'} |
| WFM | ${modulesList.includes('WFM') ? '0.33h' : '0.00h'} |
| AI Agents | ${modulesList.includes('AI Agents') ? '0.75h' : '0.00h'} |
| ADPP | ${modulesList.includes('ADPP') ? '1.50h' : '0.00h'} |
| **Subtotal** | **${num(breakdown.generalConfig, 2)}h** |

### 6.2 Treinamentos (row 53)
- Suite (Support / Knowledge / Analytics): ${num(Number(breakdown.training || 0) > 0 ? 3.0 : 0, 2)}h
- Analytics avançado (treinamento ${analyticsTrainingType === 'advanced' ? 'completo' : 'padrão'}): ${num(analyticsTrainingType === 'advanced' && modulesList.includes('Analytics') ? 6.0 : 0, 2)}h
- Community: ${num(modulesList.includes('Community') ? 1.5 : 0, 2)}h
- Voice: ${num(modulesList.includes('Voice') ? 2.5 : 0, 2)}h
- Copilot: ${num(modulesList.includes('Copilot') ? 2.5 : 0, 2)}h
- QA: ${num(modulesList.includes('QA') ? 2.0 : 0, 2)}h
- WFM: ${num(modulesList.includes('WFM') ? 3.0 : 0, 2)}h
- AI Agents: ${num(modulesList.includes('AI Agents') ? 4.0 : 0, 2)}h
- ADPP: ${num(modulesList.includes('ADPP') ? 1.0 : 0, 2)}h
- **Subtotal treinamentos:** **${num(breakdown.training, 2)}h**

### 6.3 Itens fixos (rows 54-63)
| Bloco | Qtd × H | Total |
| :--- | :--- | ---: |
| Support fixo (Enc. Omnichannel 1×1.00h; Webhook inst. 1×0.50h; Webhooks 1×0.33h) | 1.83h | 1.83h |
| Support (plano ≠ Team) — Satisfação + Feriados (0.25+0.25) | ${String(zendeskPlan || 'professional').toLowerCase() !== 'team' ? '0.50h' : '0.00h'} | ${num(Number(breakdown.supportFixed || 0) - 1.83, 2)}h |
| WFM fixo (2×0.75 + 1×0.75 + 10×0.05) | — | ${num(breakdown.wfmFixed, 2)}h |
| ADPP fixo (2×0.25 + 5×0.08) | — | ${num(breakdown.adppFixed, 2)}h |
| **Subtotal itens fixos** | — | **${num(Number(breakdown.supportFixed || 0) + Number(breakdown.wfmFixed || 0) + Number(breakdown.adppFixed || 0), 2)}h** |

### 6.4 Workshops
| Módulo | H |
| :--- | ---: |
| Suite (habilita se tem Support/Knowledge/Analytics) | ${(modulesList.includes('Support') || modulesList.includes('Knowledge') || modulesList.includes('Analytics')) ? '1.00h' : '0.00h'} |
| Voice | ${modulesList.includes('Voice') ? '0.50h' : '0.00h'} |
| Copilot | ${modulesList.includes('Copilot') ? '0.50h' : '0.00h'} |
| AI Agents | ${modulesList.includes('AI Agents') ? '0.50h' : '0.00h'} |
| QA | ${modulesList.includes('QA') ? '0.50h' : '0.00h'} |
| WFM | ${modulesList.includes('WFM') ? '0.50h' : '0.00h'} |
| **Subtotal Workshops** | **${num(breakdown.workshops, 2)}h** |

### 6.5 Idiomas / Conteúdo dinâmico
| Item | Valor | H |
| :--- | :--- | ---: |
| Idiomas em operação | ${opLangs} | — |
| Base “conteúdo dinâmico” | ~${num(dynamicContentBase, 2)} itens | 0.08h/item |
| **Subtotal** | — | **${num(breakdown.operationLanguages, 2)}h** |

### 6.6 SSO
- SSO ${hasSSO ? 'habilitado' : 'não habilitado'}: **${num(breakdown.sso, 2)}h** (flat 2h se selecionado).

### 6.7 Knowledge (artigos)
- Artigos: ${knowledgeArticles}
- H por artigo: 0.10h (mínimo 2h se Guide habilitado)
- **Subtotal Knowledge:** **${num(breakdown.knowledge, 2)}h**

---

## 7. Variáveis / camadas adicionais (% calculadas sobre a base correta)

Base de percentual (line-items, subtraindo Treinamentos + Integrações nativas + Apps/Marketplace): **${num(Math.max(0, Number(estimation.lineItemHours || 0) - Number(breakdown.training || 0) - Number(breakdown.nativeConnections || 0) - Number(breakdown.thirdPartyApps || 0)), 2)}h**

| Variável | Regra | Horas |
| :--- | :--- | ---: |
| Discovery | 20% sobre a base acima | **${num(estimation.discoveryHours, 2)}h** |
| Validação | 15% sobre a base acima | **${num(estimation.validationHours, 2)}h** |
| Comunicação Técnica | 10% sobre a base acima | **${num(estimation.commTechHours, 2)}h** |
| Go-live | 5% sobre a base acima | **${num(estimation.goLiveHours, 2)}h** |
| Gestão de Projeto (GP) | 17.647% se (line-items + Comm. Técnica + Discovery + Validação + Go-live) > 30h (sobre base sem Comm. Técnica e sem treinamentos/nativos/apps, incluindo as 4 camadas acima) | **${num(estimation.gpHours, 2)}h** ${Number(estimation.gpHours || 0) === 0 ? '_(abaixo do limite de 30h do gatilho de GP)_' : ''} |
| **Subtotal variáveis** | | **${num(Number(estimation.discoveryHours || 0) + Number(estimation.validationHours || 0) + Number(estimation.commTechHours || 0) + Number(estimation.goLiveHours || 0) + Number(estimation.gpHours || 0), 2)}h** |

---

## 8. Consolidação total

| Item | Horas |
| :--- | ---: |
| Line-items (todos os grupos 2.1–2.18) | ${num(estimation.lineItemHours, 2)}h |
| + Discovery | ${num(estimation.discoveryHours, 2)}h |
| + Validação | ${num(estimation.validationHours, 2)}h |
| + Go-live | ${num(estimation.goLiveHours, 2)}h |
| + Comunicação Técnica | ${num(estimation.commTechHours, 2)}h |
| + Gestão de Projeto (GP) | ${num(estimation.gpHours, 2)}h |
| **Esforço Total Estimado** | **${num(estimation.total, 2)}h** |

---

## 9. Sinalização para pré-vendas / Sales Engineer

${estimation.needsSC ? [
  '- ⚠️ **Requer envolvimento de Sales Engineer (SC).**',
  estimation.escalationMessage ? `- ${String(estimation.escalationMessage)}` : '',
  '- Critérios de trigger (engine): total > 60h OU artigos > 100 OU agentes > 100 OU marcas > 3 OU canais > 10 OU módulo AI Agents selecionado.',
].filter(Boolean).join('\n') : [
  '- ✅ Estimativa dentro dos limites para AE conduzir sem SC obrigatório.',
  '- Ainda assim, recomendamos revisão se houver ADPP, AI Agents ou integrações complexas não capturadas no escopo acima.',
].join('\n')}

${estimation.total > 60 ? `\n> Observação: total (${num(estimation.total, 2)}h) ultrapassou 60h; portanto o gatilho de SC ficou ativo.` : ''}
`;
    
    setMarkdownReport(report.trim());
    setShowResult(true);

    try {
      await saveAEEstimateAction({
        clientName,
        zohoLink,
        clientObjectives,
        successIndicators,
        engineInputs,
        selectedModules,
        analyticsTrainingType,
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
        operationLanguages,
        resultHours: estimation.total,
        needsSC: estimation.needsSC,
        appQuantities,
        parentId: cloneFromId || undefined,
      });
    } catch (error) {
      console.error("Error saving estimate:", error);
    } finally {
      setIsPending(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="space-y-4">
            <h1 className="text-6xl font-black text-brand-dark tracking-tighter font-heading uppercase leading-none">
              Calculadora <span className="text-brand-primary">AE</span>
            </h1>
            <p className="text-slate-400 text-xs mt-4 font-bold uppercase tracking-[0.2em]">Estimativa rápida de esforço técnico para vendas.</p>
            {initialVersion != null && (
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-brand-primary/10 border border-brand-primary/20 rounded-2xl">
                <BookOpen className="w-3.5 h-3.5 text-brand-primary" />
                <span className="text-[10px] font-black uppercase tracking-widest text-brand-primary">
                  {cloneFromId ? `Nova versão a partir da V${initialVersion}` : `Versão ${initialVersion}`}
                </span>
              </div>
            )}
          </div>
          <div className="flex items-center space-x-4">
            <Link 
              href="/ae/history"
              className="bg-white border border-slate-200 text-slate-400 px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center space-x-2 hover:border-brand-primary hover:text-brand-primary transition-all"
            >
              <Clock className="w-4 h-4" />
              <span>Meu Histórico</span>
            </Link>
            {showResult && (
              <button 
                onClick={handleNewSimulation}
                className="text-brand-primary font-black text-[10px] uppercase tracking-widest flex items-center space-x-2 hover:opacity-70 transition-all"
              >
                <Plus className="w-4 h-4 rotate-45" />
                <span>Nova Simulação</span>
              </button>
            )}
          </div>
        </div>

      {!showResult ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
          {/* Left Column: Strategic & Operation */}
          <div className="space-y-8">
            <div className="bg-white rounded-[3rem] border border-slate-200 p-10 shadow-xl shadow-slate-200/50 space-y-8">
              <div className="flex items-center space-x-4 border-b border-slate-50 pb-6">
                <div className="bg-brand-primary/10 p-3 rounded-2xl text-brand-primary">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <h2 className="text-xl font-black text-brand-dark uppercase tracking-tight">Informações Estratégicas</h2>
              </div>
              
              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Nome do Cliente</label>
                  <input 
                    type="text" 
                    value={clientName}
                    onChange={(e) => setClientName(e.target.value)}
                    placeholder="Ex: Aktie Now"
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 text-sm font-bold focus:ring-2 focus:ring-brand-primary focus:bg-white outline-none transition-all"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Link do Deal (Zoho)</label>
                  <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-300 group-focus-within:text-brand-primary transition-colors">
                      <Search className="w-4 h-4" />
                    </div>
                    <input 
                      type="url" 
                      value={zohoLink}
                      onChange={(e) => setZohoLink(e.target.value)}
                      placeholder="https://crm.zoho.com/..." 
                      className="w-full bg-slate-50 border border-slate-200 rounded-2xl pl-10 pr-6 py-4 text-sm font-bold focus:ring-2 focus:ring-brand-primary focus:bg-white outline-none transition-all placeholder:text-slate-300" 
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Objetivos e dores do cliente</label>
                  <textarea 
                    value={clientObjectives}
                    onChange={(e) => setClientObjectives(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 text-sm font-medium focus:ring-2 focus:ring-brand-primary focus:bg-white outline-none transition-all h-24 resize-none"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Indicadores de sucesso</label>
                  <textarea 
                    value={successIndicators}
                    onChange={(e) => setSuccessIndicators(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 text-sm font-medium focus:ring-2 focus:ring-brand-primary focus:bg-white outline-none transition-all h-24 resize-none"
                  />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-[3rem] border border-slate-200 p-10 shadow-xl shadow-slate-200/50 space-y-8">
              <div className="flex items-center space-x-4 border-b border-slate-50 pb-6">
                <div className="bg-brand-primary/10 p-3 rounded-2xl text-brand-primary">
                  <Layers className="w-6 h-6" />
                </div>
                <h2 className="text-xl font-black text-brand-dark uppercase tracking-tight">Módulos, Operação e Serviços</h2>
              </div>

              <div className="space-y-8">
                <div className="space-y-4">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Módulos</label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {availableModules.map(m => (
                      <button
                        key={m}
                        onClick={() => toggleModule(m)}
                        className={`p-3 rounded-xl border text-[9px] font-black uppercase tracking-tight transition-all ${
                          selectedModules.includes(m)
                            ? 'bg-brand-primary border-brand-primary text-white shadow-lg'
                            : 'bg-slate-50 border-slate-200 text-slate-400 hover:border-brand-primary/30'
                        }`}
                      >
                        {m}
                      </button>
                    ))}
                  </div>
                </div>

                {selectedModules.includes('Analytics') && (
                  <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100 space-y-4 animate-in fade-in slide-in-from-top-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 block">Tipo de Treinamento</label>
                    <div className="flex bg-white p-1 rounded-xl border border-slate-200">
                      <button 
                        onClick={() => setAnalyticsTrainingType('standard')} 
                        className={`flex-1 py-2.5 rounded-lg text-[9px] font-black uppercase transition-all ${analyticsTrainingType === 'standard' ? 'bg-brand-primary text-white shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                      >
                        Treinamento Padrão
                      </button>
                      <button 
                        onClick={() => setAnalyticsTrainingType('advanced')} 
                        className={`flex-1 py-2.5 rounded-lg text-[9px] font-black uppercase transition-all ${analyticsTrainingType === 'advanced' ? 'bg-brand-primary text-white shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                      >
                        Treinamento Avançado
                      </button>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-4">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Tipo de Operação</label>
                    <div className="flex flex-wrap gap-2">
                      {['B2C', 'B2B', 'B2E'].map(t => (
                        <button
                          key={t}
                          onClick={() => toggleOperationType(t)}
                          className={`px-4 py-2 rounded-xl border text-[9px] font-black uppercase transition-all ${
                            operationTypes.includes(t)
                              ? 'bg-brand-primary border-brand-primary text-white shadow-lg shadow-brand-primary/20'
                              : 'bg-white border-slate-200 text-slate-400 hover:border-brand-primary/30'
                          }`}
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-4">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">SKU</label>
                    <div className="flex bg-slate-100 p-1 rounded-xl">
                      <button onClick={() => setSkuType('customer_service')} className={`flex-1 py-2 rounded-lg text-[9px] font-black uppercase transition-all ${skuType === 'customer_service' ? 'bg-white text-brand-dark shadow-sm' : 'text-slate-400'}`}>Customer</button>
                      <button onClick={() => setSkuType('employee_service')} className={`flex-1 py-2 rounded-lg text-[9px] font-black uppercase transition-all ${skuType === 'employee_service' ? 'bg-white text-brand-dark shadow-sm' : 'text-slate-400'}`}>Employee</button>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Implantação</label>
                  <div className="flex bg-slate-100 p-1 rounded-xl">
                    <button onClick={() => setDeploymentType('new')} className={`flex-1 py-2 rounded-lg text-[9px] font-black uppercase transition-all ${deploymentType === 'new' ? 'bg-brand-primary text-white shadow-sm' : 'text-slate-400'}`}>Nova</button>
                    <button onClick={() => setDeploymentType('optimization')} className={`flex-1 py-2 rounded-lg text-[9px] font-black uppercase transition-all ${deploymentType === 'optimization' ? 'bg-brand-primary text-white shadow-sm' : 'text-slate-400'}`}>Otimização</button>
                  </div>
                </div>

                <div className="space-y-6 pt-6 border-t border-slate-100">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Serviços Adicionais</label>
                  
                  {/* Support Additional Services */}
                  {selectedModules.includes('Support') && (
                    <div className="space-y-4 animate-in fade-in slide-in-from-top-2">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {[
                          { id: 'sso', label: 'Single Sign On', state: hasSSO, setter: setHasSSO, icon: ShieldCheck },
                          ...(canUseSideConversations
                            ? [
                                { id: 'teams', label: 'Conversas paralelas via Teams', state: hasTeamsSideConv, setter: setHasTeamsSideConv, icon: MessageSquare },
                                { id: 'slack', label: 'Conversas paralelas via Slack', state: hasSlackSideConv, setter: setHasSlackSideConv, icon: Hash }
                              ]
                            : []),
                        ].map(item => (
                          <label key={item.id} className={`flex items-center justify-between p-4 rounded-xl border transition-all cursor-pointer ${item.state ? 'bg-brand-primary/5 border-brand-primary' : 'bg-slate-50 border-slate-200 opacity-60'}`}>
                            <div className="flex items-center space-x-3">
                              <item.icon className={`w-4 h-4 ${item.state ? 'text-brand-primary' : 'text-slate-400'}`} />
                              <span className={`text-[9px] font-black uppercase tracking-widest ${item.state ? 'text-brand-dark' : 'text-slate-500'}`}>{item.label}</span>
                            </div>
                            <input type="checkbox" checked={item.state} onChange={(e) => item.setter(e.target.checked)} className="w-5 h-5 rounded border-slate-300 text-brand-primary focus:ring-brand-primary" />
                          </label>
                        ))}
                      </div>
                      <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <Globe className="w-4 h-4 text-slate-400" />
                          <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">Idiomas da Operação</span>
                        </div>
                        <input 
                          type="number" 
                          min="1" 
                          value={operationLanguages} 
                          onChange={(e) => setOperationLanguages(Math.max(1, parseInt(e.target.value) || 1))}
                          className="w-16 bg-white border border-slate-200 rounded-lg px-2 py-1 text-[10px] font-black text-center"
                        />
                      </div>
                      {!canUseSideConversations && (
                        <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest px-1">
                          Side conversations disponiveis apenas para ES Growth+ ou CS Professional+.
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
                          <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">Quantidade de Artigos</span>
                        </div>
                        <input 
                          type="number" 
                          min="0" 
                          value={knowledgeArticles} 
                          onChange={(e) => setKnowledgeArticles(Math.max(0, parseInt(e.target.value) || 0))}
                          className="w-16 bg-white border border-slate-200 rounded-lg px-2 py-1 text-[10px] font-black text-center"
                        />
                      </div>
                    </div>
                  )}

                  {!selectedModules.includes('Support') && !selectedModules.includes('Knowledge') && (
                    <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest text-center py-4 italic">
                      Selecione Support ou Knowledge para ver serviços adicionais
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Volume, Channels & Zendesk */}
          <div className="space-y-8">
            <div className="bg-slate-50/50 rounded-[3rem] border border-slate-200 p-10 shadow-inner space-y-8">
              <div className="flex items-center space-x-4 border-b border-slate-200/50 pb-6">
                <div className="bg-brand-dark p-3 rounded-2xl text-white">
                  <Users className="w-6 h-6" />
                </div>
                <h2 className="text-xl font-black text-brand-dark uppercase tracking-tight">Volume e Canais</h2>
              </div>

              <div className="grid grid-cols-3 gap-6">
                <div className="space-y-2">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Agentes</label>
                  <input type="number" min="1" value={agents} onChange={(e) => setAgents(Math.max(1, parseInt(e.target.value) || 1))} className="w-full bg-white border border-slate-200 rounded-2xl px-6 py-4 text-sm font-black focus:ring-2 focus:ring-brand-primary outline-none" />
                </div>
                <div className="space-y-2">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Marcas</label>
                  <input type="number" min="1" value={brands} onChange={(e) => setBrands(Math.max(1, parseInt(e.target.value) || 1))} className="w-full bg-white border border-slate-200 rounded-2xl px-6 py-4 text-sm font-black focus:ring-2 focus:ring-brand-primary outline-none" />
                </div>
                <div className="space-y-2">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Áreas</label>
                  <input type="number" min="1" value={areas} onChange={(e) => setAreas(Math.max(1, parseInt(e.target.value) || 1))} className="w-full bg-white border border-slate-200 rounded-2xl px-6 py-4 text-sm font-black focus:ring-2 focus:ring-brand-primary outline-none" />
                </div>
              </div>

                <div className="space-y-4">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Canais Ativos</label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {channelOptions.map((opt) => (
                      <div key={opt.id} className={`flex items-center justify-between p-3 rounded-2xl border transition-all ${
                        selectedChannels.includes(opt.id) ? 'bg-white border-brand-primary shadow-sm' : 'bg-transparent border-slate-200 opacity-60'
                      }`}>
                        <button
                          onClick={() => toggleChannel(opt.id)}
                          className={`flex-1 text-left text-[9px] font-black uppercase tracking-tight ${selectedChannels.includes(opt.id) ? 'text-brand-dark' : 'text-slate-400'}`}
                        >
                          {opt.label}
                        </button>
                        {selectedChannels.includes(opt.id) && (
                          <div className="flex items-center space-x-2 animate-in zoom-in-90 duration-300">
                            <span className="text-[8px] font-black text-slate-300 uppercase">Qtd:</span>
                            <input 
                              type="number" 
                              min="0"
                              value={channelQuantities[opt.id] ?? 1} 
                              onChange={(e) => handleChannelQtyChange(opt.id, parseInt(e.target.value) ?? 0)}
                              className="w-12 bg-slate-50 border border-slate-100 rounded-lg px-2 py-1 text-[10px] font-black text-center"
                            />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Ver mais canais */}
                  <div className="mt-4">
                    <button
                      onClick={() => setShowExtraChannels(!showExtraChannels)}
                      className="text-[9px] font-black text-brand-primary uppercase tracking-widest flex items-center space-x-2 hover:opacity-70 transition-all ml-1"
                    >
                      <Plus className={`w-3 h-3 transition-transform duration-300 ${showExtraChannels ? 'rotate-45' : ''}`} />
                      <span>{showExtraChannels ? 'Ver menos canais' : 'Ver mais canais nativos'}</span>
                    </button>

                    {showExtraChannels && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4 animate-in fade-in slide-in-from-top-2 duration-300">
                        {extraChannelOptions.map((opt) => (
                          <div key={opt.id} className={`flex items-center justify-between p-3 rounded-2xl border transition-all ${
                            selectedChannels.includes(opt.id) ? 'bg-white border-brand-primary shadow-sm' : 'bg-transparent border-slate-200 opacity-60'
                          }`}>
                            <button
                              onClick={() => toggleChannel(opt.id)}
                              className={`flex-1 text-left text-[9px] font-black uppercase tracking-tight ${selectedChannels.includes(opt.id) ? 'text-brand-dark' : 'text-slate-400'}`}
                            >
                              {opt.label}
                            </button>
                            {selectedChannels.includes(opt.id) && (
                              <div className="flex items-center space-x-2 animate-in zoom-in-90 duration-300">
                                <span className="text-[8px] font-black text-slate-300 uppercase">Qtd:</span>
                                <input 
                                  type="number" 
                                  min="0"
                                  value={channelQuantities[opt.id] ?? 1} 
                                  onChange={(e) => handleChannelQtyChange(opt.id, parseInt(e.target.value) ?? 0)}
                                  className="w-12 bg-slate-50 border border-slate-100 rounded-lg px-2 py-1 text-[10px] font-black text-center"
                                />
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
            </div>

            <div className="bg-white rounded-[3rem] border border-slate-200 p-10 shadow-xl shadow-slate-200/50 space-y-8">
              <div className="flex items-center space-x-4 border-b border-slate-50 pb-6">
                <div className="bg-brand-secondary/10 p-3 rounded-2xl text-brand-secondary">
                  <Settings className="w-6 h-6" />
                </div>
                <h2 className="text-xl font-black text-brand-dark uppercase tracking-tight">Zendesk & Ecossistema</h2>
              </div>

              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Plano Zendesk</label>
                  <select value={zendeskPlan} onChange={(e) => setZendeskPlan(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 text-sm font-black uppercase outline-none focus:ring-2 focus:ring-brand-primary transition-all">
                    <option value="team">Suite Team</option>
                    <option value="growth">Suite Growth</option>
                    <option value="professional">Suite Professional</option>
                    <option value="enterprise">Suite Enterprise</option>
                  </select>
                </div>

                <div className="space-y-4">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Action Flow</label>
                  <div className="p-6 bg-slate-50 rounded-[2rem] border border-slate-200 space-y-4">
                    <select
                      value=""
                      onChange={(e) => addActionFlow(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-2xl px-6 py-4 text-sm font-black outline-none focus:ring-2 focus:ring-brand-primary transition-all"
                    >
                      <option value="" disabled>
                        Selecione uma integração do Action Flow
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
                            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-brand-primary/30 bg-brand-primary/10 text-brand-primary text-[9px] font-black uppercase transition-all hover:opacity-90 dark:bg-[color:var(--bg-input)] dark:border-[color:var(--border-main)] dark:text-[color:var(--accent)]"
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
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Apps da Aktie Now</label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <label className={`flex items-center justify-between p-4 rounded-xl border cursor-pointer transition-all ${hasAppCondicionais ? 'bg-brand-primary/5 border-brand-primary' : 'bg-slate-50 border-slate-200 opacity-60 hover:border-brand-primary/30'}`}>
                      <div className="flex items-center space-x-3">
                        <Box className={`w-4 h-4 ${hasAppCondicionais ? 'text-brand-primary' : 'text-slate-400'}`} />
                        <span className={`text-[9px] font-black uppercase tracking-widest ${hasAppCondicionais ? 'text-brand-dark' : 'text-slate-500'}`}>Condicionais Avançadas</span>
                      </div>
                      <input type="checkbox" checked={hasAppCondicionais} onChange={(e) => setHasAppCondicionais(e.target.checked)} className="w-5 h-5 rounded border-slate-300 text-brand-primary focus:ring-brand-primary" />
                    </label>
                    <label className={`flex items-center justify-between p-4 rounded-xl border cursor-pointer transition-all ${hasAppTicketManager ? 'bg-brand-primary/5 border-brand-primary' : 'bg-slate-50 border-slate-200 opacity-60 hover:border-brand-primary/30'}`}>
                      <div className="flex items-center space-x-3">
                        <Box className={`w-4 h-4 ${hasAppTicketManager ? 'text-brand-primary' : 'text-slate-400'}`} />
                        <span className={`text-[9px] font-black uppercase tracking-widest ${hasAppTicketManager ? 'text-brand-dark' : 'text-slate-500'}`}>Ticket Manager</span>
                      </div>
                      <input type="checkbox" checked={hasAppTicketManager} onChange={(e) => setHasAppTicketManager(e.target.checked)} className="w-5 h-5 rounded border-slate-300 text-brand-primary focus:ring-brand-primary" />
                    </label>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Apps Marketplace</label>
                    {!hasAppsMarketplace && (
                      <button
                        type="button"
                        onClick={() => setHasAppsMarketplace(true)}
                        className="text-[9px] font-black text-brand-primary uppercase tracking-widest hover:opacity-70 transition-all"
                      >
                        + Habilitar seleção
                      </button>
                    )}
                  </div>
                  {hasAppsMarketplace && (
                    <div className="p-6 bg-slate-50 rounded-[2rem] border border-slate-200 space-y-4 animate-in fade-in slide-in-from-top-2">
                      <div className="flex flex-wrap gap-2">
                        {marketplaceOptions.map(app => (
                          <div key={app} className="flex items-center space-x-2">
                            <button
                              onClick={() => toggleApp(app)}
                              className={`px-4 py-2 rounded-xl border text-[9px] font-black uppercase transition-all ${
                                selectedApps.includes(app) ? 'bg-brand-primary border-brand-primary text-white shadow-lg' : 'bg-white border-slate-200 text-slate-400 hover:border-brand-primary/30'
                              }`}
                            >
                              {app}
                            </button>
                            {selectedApps.includes(app) && (app === 'SweetHawk' || app === 'Outros' || app === 'App Marketplace') && (
                              <div className="flex items-center space-x-2 animate-in zoom-in-90 duration-300">
                                <span className="text-[8px] font-black text-slate-300 uppercase">Qtd:</span>
                                <input 
                                  type="number" 
                                  min="0"
                                  value={appQuantities[app] ?? 1} 
                                  onChange={(e) => handleAppQtyChange(app, parseInt(e.target.value) ?? 0)}
                                  className="w-12 bg-white border border-slate-200 rounded-lg px-2 py-1 text-[10px] font-black text-center text-brand-dark focus:ring-1 focus:ring-brand-primary outline-none"
                                />
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                      {selectedApps.includes('Outros') && (
                        <input type="text" value={otherApp} onChange={(e) => setOtherApp(e.target.value)} placeholder="Quais outros apps?" className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-xs font-bold" />
                      )}
                    </div>
                  )}
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Conexões Nativas</label>
                    {!hasNativeConnections && (
                      <button
                        type="button"
                        onClick={() => setHasNativeConnections(true)}
                        className="text-[9px] font-black text-brand-primary uppercase tracking-widest hover:opacity-70 transition-all"
                      >
                        + Habilitar seleção
                      </button>
                    )}
                  </div>
                  {hasNativeConnections && (
                    <div className="p-6 bg-slate-50 rounded-[2rem] border border-slate-200 space-y-4 animate-in fade-in slide-in-from-top-2">
                      <div className="flex flex-wrap gap-2">
                        {nativeConnectionOptions.map(conn => (
                          <button
                            key={conn}
                            onClick={() => toggleNativeConnection(conn)}
                            className={`px-4 py-2 rounded-xl border text-[9px] font-black uppercase transition-all ${
                              selectedNativeConnections.includes(conn) ? 'bg-brand-primary border-brand-primary text-white shadow-lg' : 'bg-white border-slate-200 text-slate-400 hover:border-brand-primary/30'
                            }`}
                          >
                            {conn}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="bg-brand-dark dark:bg-[color:var(--bg-card)] rounded-[3rem] p-10 space-y-8 text-white shadow-2xl dark:border dark:border-[color:var(--border-main)] dark:text-[color:var(--text-main)]">
              <div className="flex items-center space-x-4 border-b border-white/10 dark:border-[color:var(--border-main)] pb-6">
                <div className="brand-bg-primary p-3 rounded-2xl text-white">
                  <Zap className="w-6 h-6" />
                </div>
                <h2 className="text-xl font-black uppercase tracking-tight dark:text-[color:var(--text-main)]">Finalizar Estimativa</h2>
              </div>

              {!validation.valid && validation.errors.length > 0 && (
                <div className="space-y-2">
                  <p className="text-[9px] font-black text-amber-400 uppercase tracking-widest">Antes de calcular:</p>
                  <ul className="space-y-1">
                    {validation.errors.map((err, i) => (
                      <li key={i} className="text-[9px] font-bold text-slate-300 dark:text-[color:var(--text-muted)] leading-relaxed">
                        • {err}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              
              <p className="text-[10px] font-bold text-slate-400 dark:text-[color:var(--text-muted)] uppercase tracking-widest leading-relaxed">
                Revise os campos acima. A estimativa considera esforço técnico padrão e margem de GP configurada.
              </p>

              <button
                onClick={handleCalculate}
                disabled={!clientName || isPending || !validation.valid}
                className="w-full brand-bg-primary text-white p-6 rounded-2xl font-black text-xs uppercase tracking-[0.3em] shadow-xl hover:opacity-90 active:scale-95 transition-all flex items-center justify-center space-x-4 disabled:opacity-50 disabled:active:scale-100"
              >
                {isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Zap className="w-5 h-5" />}
                <span>Gerar Estimativa</span>
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="animate-in zoom-in-95 fade-in duration-500 max-w-4xl mx-auto">
          <div className={`rounded-[4rem] p-16 shadow-2xl relative overflow-hidden text-center space-y-12 ${
            estimation.needsSC
              ? 'bg-amber-50 border-4 border-amber-200 text-amber-900 dark:bg-[color:var(--bg-card)] dark:text-[color:var(--text-main)] dark:border-[color:var(--accent)]'
              : 'bg-brand-dark text-white dark:bg-[color:var(--bg-card)] dark:text-[color:var(--text-main)] dark:border dark:border-[color:var(--border-main)]'
          }`}>
            <div className="absolute top-0 right-0 p-12 opacity-5 pointer-events-none">
              {estimation.needsSC ? <AlertTriangle className="w-64 h-64 text-amber-500 dark:text-[color:var(--accent)]" /> : <ShieldCheck className="w-64 h-64 text-white dark:text-[color:var(--accent)]" />}
            </div>

            <div className="relative z-10 space-y-8">
              <div className="flex flex-col items-center space-y-4">
                <div className={`w-20 h-20 rounded-3xl flex items-center justify-center shadow-2xl ${
                  estimation.needsSC
                    ? 'bg-amber-200 text-amber-700 dark:bg-[color:var(--accent)]/20 dark:text-[color:var(--accent)]'
                    : 'brand-bg-primary text-white dark:bg-[color:var(--primary)] dark:text-white'
                }`}>
                  {estimation.needsSC ? <AlertTriangle className="w-10 h-10" /> : <CheckCircle2 className="w-10 h-10" />}
                </div>
                <div>
                  <h3 className={`text-sm font-black uppercase tracking-[0.3em] ${
                    estimation.needsSC
                      ? 'text-amber-600 dark:text-[color:var(--accent)]'
                      : 'text-slate-400 dark:text-[color:var(--text-muted)]'
                  }`}>
                    Resultado para {clientName}
                  </h3>
                </div>
              </div>

              <div className="space-y-2">
                <div className={`text-8xl font-black tracking-tighter ${
                  estimation.needsSC
                    ? 'text-amber-700 dark:text-[color:var(--accent)]'
                    : 'text-brand-accent dark:text-[color:var(--accent)]'
                }`}>
                  {estimation.needsSC ? 'CONSULTAR SC' : `${estimation.total.toFixed(0)}H`}
                </div>
                <p className={`text-lg font-bold uppercase tracking-widest ${
                  estimation.needsSC
                    ? 'text-amber-600 dark:text-[color:var(--accent)]'
                    : 'text-slate-400 dark:text-[color:var(--text-muted)]'
                }`}>
                  {estimation.needsSC ? 'Esforço Necessita de SC' : 'Esforço Estimado'}
                </p>
              </div>

              {!estimation.needsSC && (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-6 max-w-2xl mx-auto pt-8 border-t border-white/10 dark:border-[color:var(--border-main)]">
                  <div className="text-center p-4 bg-white/5 dark:bg-[color:var(--bg-input)] rounded-2xl">
                    <span className="text-[8px] font-black text-slate-500 dark:text-[color:var(--text-muted)] uppercase tracking-widest block mb-1">Implantação</span>
                    <span className="text-xl font-black tracking-tight dark:text-[color:var(--text-main)]">{estimation.techHours.toFixed(1)}H</span>
                  </div>
                  <div className="text-center p-4 bg-white/5 dark:bg-[color:var(--bg-input)] rounded-2xl">
                    <span className="text-[8px] font-black text-slate-500 dark:text-[color:var(--text-muted)] uppercase tracking-widest block mb-1">GP</span>
                    <span className="text-xl font-black tracking-tight text-brand-secondary dark:text-[color:var(--secondary)]">{estimation.calculatedResults.variables.gp.toFixed(1)}H</span>
                  </div>
                  <div className="text-center p-4 bg-white/5 dark:bg-[color:var(--bg-input)] rounded-2xl">
                    <span className="text-[8px] font-black text-slate-500 dark:text-[color:var(--text-muted)] uppercase tracking-widest block mb-1">Discovery</span>
                    <span className="text-xl font-black tracking-tight text-amber-500 dark:text-[color:var(--accent)]">{estimation.calculatedResults.variables.discovery.toFixed(1)}H</span>
                  </div>
                  <div className="text-center p-4 bg-white/5 dark:bg-[color:var(--bg-input)] rounded-2xl">
                    <span className="text-[8px] font-black text-slate-500 dark:text-[color:var(--text-muted)] uppercase tracking-widest block mb-1">Validação</span>
                    <span className="text-xl font-black tracking-tight text-blue-500 dark:text-[color:var(--text-main)]">{estimation.calculatedResults.variables.validation.toFixed(1)}H</span>
                  </div>
                  <div className="text-center p-4 bg-white/5 dark:bg-[color:var(--bg-input)] rounded-2xl">
                    <span className="text-[8px] font-black text-slate-500 dark:text-[color:var(--text-muted)] uppercase tracking-widest block mb-1">Com. Técnica</span>
                    <span className="text-xl font-black tracking-tight text-purple-500 dark:text-[color:var(--text-main)]">{estimation.calculatedResults.variables.comunicacao_tecnica.toFixed(1)}H</span>
                  </div>
                  <div className="text-center p-4 bg-white/5 dark:bg-[color:var(--bg-input)] rounded-2xl">
                    <span className="text-[8px] font-black text-slate-500 dark:text-[color:var(--text-muted)] uppercase tracking-widest block mb-1">Go-live</span>
                    <span className="text-xl font-black tracking-tight text-green-500 dark:text-[color:var(--text-main)]">{estimation.calculatedResults.variables.go_live.toFixed(1)}H</span>
                  </div>
                </div>
              )}
            </div>

            <div className="relative z-10 pt-10">
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                {isPending ? (
                  <div className="flex items-center space-x-3 text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-[color:var(--text-muted)]">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Salvando Registro...</span>
                  </div>
                ) : (
                  <div className="flex items-center space-x-3 text-[10px] font-black uppercase tracking-widest text-brand-primary dark:text-[color:var(--primary)]">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Registro Salvo com Sucesso</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* New Results Section: Markdown & JSON */}
          <div className="mt-12 space-y-12">
            <div className="bg-white dark:bg-[color:var(--bg-card)] dark:border dark:border-[color:var(--border-main)] rounded-[3rem] border border-slate-200 p-10 shadow-xl overflow-hidden">
              <div className="flex items-center justify-between mb-8 border-b border-slate-50 dark:border-[color:var(--border-main)] pb-6">
                <div className="flex items-center space-x-4">
                  <div className="bg-brand-primary/10 p-3 rounded-2xl text-brand-primary dark:bg-[color:var(--primary)]/15 dark:text-[color:var(--primary)]">
                    <MessageSquare className="w-6 h-6" />
                  </div>
                  <h2 className="text-xl font-black text-brand-dark dark:text-[color:var(--text-main)] uppercase tracking-tight">Relatório Executivo</h2>
                </div>
                <button 
                  onClick={() => {
                    navigator.clipboard.writeText(markdownReport);
                    alert('Relatório copiado!');
                  }}
                  className="bg-slate-50 hover:bg-slate-100 text-slate-500 dark:bg-[color:var(--bg-input)] dark:text-[color:var(--text-muted)] dark:hover:opacity-90 dark:border dark:border-[color:var(--border-main)] px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center space-x-2"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copiar Markdown</span>
                </button>
              </div>
              <div className="prose prose-slate max-w-none text-xs font-medium leading-relaxed whitespace-pre-wrap dark:bg-[color:var(--bg-card)] dark:text-[color:var(--text-main)]">
                {markdownReport}
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
