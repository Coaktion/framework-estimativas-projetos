'use client';
import { useTranslation } from 'react-i18next';
import { useSession } from 'next-auth/react';
import { useLanguage } from '@/components/LanguageProvider';
import { packageName } from '@/lib/localized-names';
import { canViewExecutiveReport } from '@/lib/segments';
import {
  buildScopePrompt, detectSuppressionFlags,
  type ScopeExportItem, type ScopeExportChannel, type ScopeExportIntegration,
} from '@/lib/scope-export';
import AEResultTable from '@/components/AEResultTable';

import { useState, useMemo, useEffect, useRef } from 'react';
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
  x: 'x_dm', // legado: estimativas salvas antes da separação DM / público
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
    if (['Analytics', 'Community', 'Copilot', 'QA', 'WFM'].includes(m)) return planRank >= PLAN_RANK.professional;
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
  const { t } = useTranslation();
  const { language, dateLocale } = useLanguage();
  const { data: session } = useSession();
  const [isPending, setIsPending] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const [markdownReport, setMarkdownReport] = useState('');

  /**
   * O Relatório Executivo é exclusivo de administradores. Os demais segmentos
   * ficam apenas com a tabela de resultado — que já se adapta ao leitor
   * (versão simplificada para o AE, completa para os outros).
   */
  const showExecutiveReport = canViewExecutiveReport(session?.user as any);

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
    setResultSnapshot(null);
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

  const hydratedKeyRef = useRef<string | null>(null);

  useEffect(() => {
    // Já hidratamos exatamente este payload — não sobrescrever o que o usuário
    // editou desde então.
    if (hydratedKeyRef.current === initialDataKey) return;
    hydratedKeyRef.current = initialDataKey;

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
    const baseModules: string[] = ['Support', 'Knowledge', 'Voice', 'AI Agents'];

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

  /**
   * O canal Voice e o módulo Voice são interdependentes no engine: a quantidade de
   * IVR vem de channelQuantities.voice, mas as horas só são faturadas quando o
   * módulo Voice está selecionado. Marcar apenas um dos dois produzia silenciosamente
   * ~0 hora de voz, então ligamos o módulo automaticamente ao escolher o canal.
   */
  useEffect(() => {
    const voiceChannelOn = selectedChannels.includes('voice') && (channelQuantities.voice ?? 1) > 0;
    if (voiceChannelOn && availableModules.includes('Voice')) {
      setSelectedModules(prev => (prev.includes('Voice') ? prev : [...prev, 'Voice']));
    }
  }, [selectedChannels, channelQuantities, availableModules]);

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
    { id: 'whatsapp', label: 'WhatsApp', package: 'Messaging: WhatsApp' },
    { id: 'facebook', label: 'Facebook', package: 'Messaging: Facebook Messenger (por página)' },
    { id: 'instagram', label: 'Instagram', package: 'Messaging: Instagram Direct (por página)' },
    { id: 'voice', label: 'Voice (Zendesk)', package: 'Voz: Configurações gerais (Fila, Espera)' },
    { id: 'teams', label: 'MS Teams', package: 'Ticket: Microsoft Teams integration' },
    { id: 'slack', label: 'Slack', package: 'Messaging: Slack' },
    { id: 'x_dm', label: 'X DMs', package: 'Messaging: X Corp DM (por página)' },
    { id: 'x_pages', label: t('channel.xPublic'), package: 'Ticket: X (Mensagens Públicas)' },
    { id: 'sms', label: 'SMS/Text', package: 'Messaging: Text/SMS (por número)' }
  ];

  const extraChannelOptions = [
    { id: 'ios', label: 'iOS', package: 'Messaging: iOS SDK' },
    { id: 'unity', label: 'Unity', package: 'Messaging: Unity SDK' },
    { id: 'line', label: 'LINE', package: 'Messaging: LINE' },
    { id: 'apple_business', label: 'Apple Messages for Business', package: 'Messaging: Apple Messages for Business' },
    { id: 'wechat', label: 'WeChat', package: 'Messaging: WeChat' },
    { id: 'google_rcs', label: 'Google RCS', package: 'Messaging: Google RCS' },
    { id: 'google_business', label: t('channel.googleBusiness'), package: 'Messaging: Google Business Messages' },
    { id: 'kakaotalk', label: 'KakaoTalk', package: 'Messaging: KakaoTalk' },
    { id: 'facebook_pages', label: t('channel.facebookPage'), package: 'Ticket: Facebook Page (Timeline)' },
    { id: 'instagram_page', label: t('channel.instagramPage'), package: 'Ticket: Instagram Page (Feed)' },
    { id: 'telegram', label: 'Telegram', package: 'Messaging: Telegram' }
  ];

  // `value` é o nome canônico em português — é ele que vai para o banco e para o
  // engine de cálculo. `label` é só exibição e segue o idioma ativo.
  const nativeConnectionOptions = useMemo(() => {
    return packages
      .filter((p: any) => p.categoryName === 'Integrações Nativas')
      .map((p: any) => ({ value: p.name as string, label: packageName(p, language) }));
  }, [packages, language]);

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

  const analyticsTrainingTypeEngine = normalizeAnalyticsTraining(analyticsTrainingType);

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
      [t('cfg.roles'), Number(q.funcoes || 0), 0.25],
      [t('cfg.groups'), Number(q.grupos || 0), 0.05],
      [t('cfg.ticketFields'), Number(q.campos_ticket || 0), 0.08],
      [t('cfg.fieldConditions'), Number(q.condicionais_campos || 0), 0.02],
      [t('cfg.userFields'), Number(q.campos_usuario || 0), 0.05],
      [t('cfg.orgFields'), Number(q.campos_organizacao || 0), 0.05],
      [t('cfg.views'), Number(q.visualizacoes || 0), 0.08],
      [t('cfg.macros'), Number(q.macros || 0), 0.08],
      [t('cfg.simpleTriggers'), Number(q.gatilhos_simples || 0), 0.08],
      [t('cfg.complexTriggers'), Number(q.gatilhos_complexos || 0), 0.33],
      [t('cfg.simpleAutomations'), Number(q.automacoes_simples || 0), 0.08],
      [t('cfg.complexAutomations'), Number(q.automacoes_complexas || 0), 0.33],
      [t('cfg.slaPolicies'), Number(q.politicas_sla || 0), 0.17],
    ];

    const voiceItems: Array<[string, number, number]> = [
      ['IVR', Number(q.ivr || 0), 0.59],
      [t('cfg.greetings'), Number(q.saudacoes || 0), 0.05],
    ];

    const copilotItems: Array<[string, number, number]> = [
      [t('cfg.intents'), Number(q.intencoes || 0), 0.25],
      [t('cfg.entities'), Number(q.entidades || 0), 0.33],
      [t('cfg.procedures'), Number(q.procedimentos || 0), 0.67],
    ];

    const wfmItems: Array<[string, number, number]> = [
      [t('cfg.locations'), Number(q.wfm_localizacoes || 0), 0.25],
      [t('cfg.shifts'), Number(q.wfm_turnos || 0), 0.25],
      [t('cfg.workGroups'), Number(q.wfm_grupos_trabalho || 0), 0.08],
      [t('cfg.teams'), Number(q.wfm_equipes || 0), 0.08],
      [t('cfg.timeOffReasons'), Number(q.wfm_motivos_folga || 0), 0.08],
      [t('cfg.generalTasks'), Number(q.wfm_tarefas_gerais || 0), 0.08],
      [t('cfg.wfmAutomations'), Number(q.wfm_automacoes || 0), 0.25],
      [t('cfg.wfmRoles'), Number(q.wfm_funcoes || 0), 0.17],
    ];

    const qaItems: Array<[string, number, number]> = [
      [t('cfg.highlights'), Number(q.qa_destaques || 0), 0.75],
      [t('cfg.quizzes'), Number(q.qa_quizzes || 0), 0.5],
      [t('cfg.filters'), Number(q.qa_filtros || 0), 0.5],
      [t('cfg.scorecards'), Number(q.qa_tabelas_desempenho || 0), 0.5],
      [t('cfg.manualCategories'), Number(q.qa_categorias_manuais || 0), 0.17],
      [t('cfg.aiCategories'), Number(q.qa_categorias_ia || 0), 0.5],
      [t('cfg.users'), Number(q.qa_usuarios || 0), 0.05],
      [t('cfg.bots'), Number(q.qa_bots || 0), 0.17],
      [t('cfg.workspace'), Number(q.qa_espaco_trabalho || 0), 0.25],
      [t('cfg.assignments'), Number(q.qa_atribuicoes || 0), 0.5],
      [t('cfg.qaGroups'), Number(q.qa_grupos || 0), 0.08],
      [t('cfg.hashtags'), Number(q.qa_hashtags || 0), 0.05],
    ];

    const renderQtyTable = (rows: Array<[string, number, number]>, totalHoras: number) => {
      const lines = rows.map(([label, qtd, uh]) =>
        `| ${label} | ${num(qtd, 2)} | ${uh.toFixed(2)}h | ${num(qtd * uh, 2)}h |`
      ).join('\n');
      return `| ${t('common.item')} | ${t('aeReport.qty')} | ${t('aeReport.hoursPerUnit')} | ${t('common.total')} |
| :--- | ---: | ---: | ---: |
${lines}
| **${t('aeReport.blockSubtotal')}** | — | — | **${num(totalHoras, 2)}h** |`;
    };

    // Generate Markdown Report
    // Só administradores veem o Relatório Executivo, então para os demais o
    // texto nem é montado — não há por que gerar e guardar em estado algo que
    // não será exibido.
    const report = !showExecutiveReport ? '' : `
# ${t('aeReport.title')} — ${clientName}

## ${t('report.section1')}

- **${t('report.client')}:** ${clientName}
${zohoLink ? `- **${t('report.deal')}:** ${zohoLink}` : ''}
- **${t('ae.sku')}:** ${skuType === 'employee_service' ? t('report.employeeService') : t('report.customerService')}
- **${t('aeReport.deploymentType')}:** ${deploymentType === 'new' ? t('report.newDeployment') : t('report.optimizationExisting')}
- **${t('report.zendeskPlan')}:** ${String(zendeskPlan || 'professional').toUpperCase()}
- **${t('report.selectedModules')}:** ${modulesList.length ? modulesList.join(', ') : '—'}
- **${t('aeReport.operations')}:** ${(operationTypes || []).filter(Boolean).join(', ') || '—'}
- **${t('aeReport.operationLanguages')}:** ${opLangs}
- **${t('report.agents')}:** ${agents}
- **${t('aeReport.brandsLabel')}:** ${brands}
- **${t('ae.areas')}:** ${areas}
- **${t('aeReport.knowledgeArticles')}:** ${knowledgeArticles}

---

## ${t('aeReport.section2')}

| ${t('report.group')} | ${t('report.hours')} | ${t('aeReport.note')} |
| :--- | ---: | :--- |
| ${t('aeReport.supportConfig')} | ${num(breakdown.supportConfig, 2)}h | ${t('aeReport.module')} Support |
| ${t('aeReport.voiceConfig')} | ${num(breakdown.voiceConfig, 2)}h | ${t('aeReport.module')} Voice |
| ${t('aeReport.copilotConfig')} | ${num(breakdown.copilotConfig, 2)}h | ${t('aeReport.module')} Copilot |
| ${t('aeReport.wfmConfig')} | ${num(breakdown.wfmConfig, 2)}h | ${t('aeReport.module')} WFM |
| ${t('aeReport.qaConfig')} | ${num(breakdown.qaConfig, 2)}h | ${t('aeReport.module')} QA |
| ${t('aeReport.baseSetupRow')} | ${num(Number(breakdown.agentSetup || 0) + Number(breakdown.brandSetup || 0) + Number(breakdown.channelSetup || 0), 2)}h | ${t('aeReport.baseSetupNote')} |
| ${t('aeReport.aktieAppsRow')} | ${num(Number(breakdown.appCondicionais || 0) + Number(breakdown.appTicketManager || 0), 2)}h | ${t('aeReport.aktieAppsNote')} |
| 2.8 SSO | ${num(breakdown.sso, 2)}h | ${t('aeReport.ssoNote')} |
| ${t('aeReport.generalConfigRow')} | ${num(breakdown.generalConfig, 2)}h | ${t('aeReport.generalConfigNote')} |
| ${t('aeReport.trainingRow')} | ${num(breakdown.training, 2)}h | ${t('aeReport.trainingNote')} |
| ${t('aeReport.fixedPackagesRow')} | ${num(Number(breakdown.supportFixed || 0) + Number(breakdown.wfmFixed || 0) + Number(breakdown.adppFixed || 0), 2)}h | ${t('aeReport.fixedPackagesNote')} |
| ${t('aeReport.nativeRow')} | ${num(breakdown.nativeConnections, 2)}h | ${t('aeReport.flat2hEach')} |
| ${t('aeReport.knowledgeRow')} | ${num(breakdown.knowledge, 2)}h | ${t('aeReport.articles')} |
| ${t('aeReport.sideConvRow')} | ${num(breakdown.sideConversations, 2)}h | ${t('aeReport.sideConvNote')} |
| ${t('aeReport.thirdPartyRow')} | ${num(breakdown.thirdPartyApps, 2)}h | ${t('aeReport.thirdPartyNote')} |
| ${t('aeReport.workshopsRow')} | ${num(breakdown.workshops, 2)}h | ${t('aeReport.workshopsNote')} |
| ${t('aeReport.langRow')} | ${num(breakdown.operationLanguages, 2)}h | ${t('aeReport.langNote')} |
| ${t('aeReport.actionFlowsRow')} | ${num(breakdown.actionFlows, 2)}h | ${t('aeReport.externalServices')} |
| | | |
| **${t('aeReport.totalLineItems')}** | | **${num(estimation.lineItemHours, 2)}h** |

---

## ${t('aeReport.section3')}

### 3.1 Support (${num(breakdown.supportConfig, 2)}h)
${renderQtyTable(supportItems, Number(breakdown.supportConfig || 0))}

### 3.2 Voice (${num(breakdown.voiceConfig, 2)}h)
${modulesList.includes('Voice') || breakdown.voiceConfig ? renderQtyTable(voiceItems, Number(breakdown.voiceConfig || 0)) : t('report.moduleNotSelected', { module: 'Voice' })}

### 3.3 Copilot (${num(breakdown.copilotConfig, 2)}h)
${modulesList.includes('Copilot') || breakdown.copilotConfig ? renderQtyTable(copilotItems, Number(breakdown.copilotConfig || 0)) : t('report.moduleNotSelected', { module: 'Copilot' })}

### 3.4 WFM (${num(breakdown.wfmConfig, 2)}h)
${modulesList.includes('WFM') || breakdown.wfmConfig ? renderQtyTable(wfmItems, Number(breakdown.wfmConfig || 0)) : t('report.moduleNotSelected', { module: 'WFM' })}

### 3.5 QA (${num(breakdown.qaConfig, 2)}h)
${modulesList.includes('QA') || breakdown.qaConfig ? renderQtyTable(qaItems, Number(breakdown.qaConfig || 0)) : t('report.moduleNotSelected', { module: 'QA' })}

---

## ${t('aeReport.section4')}
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
      return `| ${t('common.item')} | ${t('aeReport.qty')} | ${t('aeReport.hoursPerUnit')} | ${t('common.total')} |
| :--- | ---: | ---: | ---: |
| ${t('aeReport.agentSetupRow')} | ${agents} | 0.05h | ${num(Number(breakdown.agentSetup || 0), 2)}h |
| ${t('report.brands')} | ${brands} | 0.25h | ${num(Number(breakdown.brandSetup || 0), 2)}h |
| ${t('aeReport.channelsEmail')} | ${chQty('email')} | 0.17h | ${num(chQty('email') * 0.17, 2)}h |
| ${t('aeReport.channelsWebForm')} | ${chQty('web_form')} | 0.08h | ${num(chQty('web_form') * 0.08, 2)}h |
| ${t('aeReport.channelsWebWidget')} | ${chQty('web_widget')} | 0.42h | ${num(chQty('web_widget') * 0.42, 2)}h |
| ${t('aeReport.otherChannelsRow')} | ${extraChannelsQty} | ${t('aeReport.minIfOver')} | ${num(Number(breakdown.channelSetup || 0) -
  chQty('email') * 0.17 -
  chQty('web_form') * 0.08 -
  chQty('web_widget') * 0.42, 2)}h |
| **${t('common.subtotal')}** | — | — | **${num(Number(breakdown.agentSetup || 0) + Number(breakdown.brandSetup || 0) + Number(breakdown.channelSetup || 0), 2)}h** |`;
    })()}

### ${t('aeReport.selectedChannels')}
| ${t('aeReport.channel')} | ${t('aeReport.qty')} |
| :--- | ---: |
${channelsList.length ? channelsList.map((c) => {
  const qtd = Math.max(0, Number(channelQuantities[c as any] || 1)) || 0;
  return `| ${c} | ${qtd} |`;
}).join('\n') : `| ${t('report.emptyMasc')} | — |`}

---

## ${t('aeReport.section5')}

### ${t('aeReport.section51')}
| App | ${t('report.hours')} |
| :--- | ---: |
| ${t('aeReport.advancedConditionals')} ${hasAppCondicionais ? '(✓)' : '(✗)'} | ${num(breakdown.appCondicionais, 2)}h |
| Ticket Manager ${hasAppTicketManager ? '(✓)' : '(✗)'} | ${num(breakdown.appTicketManager, 2)}h |
| **${t('aeReport.subtotalAktieApps')}** | **${num(Number(breakdown.appCondicionais || 0) + Number(breakdown.appTicketManager || 0), 2)}h** |

### ${t('aeReport.section52')}
| ${t('aeReport.integration')} | ${t('common.total')} |
| :--- | ---: |
${nativeList.length ? nativeList.map((n) => `| ${n} | 2.00h |`).join('\n') : `| ${t('report.emptyFem')} | — |`}
| **${t('aeReport.subtotalNative')}** | **${num(breakdown.nativeConnections, 2)}h** |

### ${t('aeReport.section53')}
| ${t('common.item')} | ${t('aeReport.qty')} | ${t('aeReport.hoursPerUnit')} | ${t('common.total')} |
| :--- | ---: | ---: | ---: |
| ${t('aeReport.teamsSideConv')} | ${hasTeamsSideConv ? 1 : 0} | 0.50h | ${num(hasTeamsSideConv ? 0.5 : 0, 2)}h |
| ${t('aeReport.slackSideConv')} | ${hasSlackSideConv ? 1 : 0} | 0.50h | ${num(hasSlackSideConv ? 0.5 : 0, 2)}h |
| **${t('aeReport.subtotalSideConv')}** | — | — | **${num(breakdown.sideConversations, 2)}h** |

### ${t('aeReport.section54')}
| App | ${t('common.type')} | ${t('aeReport.qty')} | ${t('aeReport.hoursPerUnit')} | ${t('common.total')} |
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
  return `| ${label} | ${t('report.oneOff')} | 1 | ${uh.toFixed(2)}h | ${num(uh, 2)}h |`;
}).join('\n') : ''}
${(sweethawkQty || 0) > 0 || (otherQty || 0) > 0 ? [
  (sweethawkQty > 0 ? `| SweetHawk | ${t('report.count')} | ${sweethawkQty} | 2.00h | ${num(sweethawkQty * 2, 2)}h |` : ''),
  (otherQty > 0 ? `| ${t('report.otherMarketplace')} | ${t('report.count')} | ${otherQty} | 5.00h | ${num(otherQty * 5, 2)}h |` : ''),
].filter(Boolean).join('\n') : ''}
${!(oneOffAppLabels.length || sweethawkQty || otherQty) ? `| ${t('report.emptyMasc')} | — | — | — | — |` : ''}
| **${t('aeReport.subtotalMarketplace')}** | — | — | — | **${num(breakdown.thirdPartyApps, 2)}h** |

### ${t('aeReport.section55')}
| ${t('aeReport.service')} | ${t('aeReport.hoursPerUnit')} | ${t('common.total')} |
| :--- | ---: | ---: |
${actionFlowsQty > 0 ? (selectedActionFlows || []).filter(Boolean).map((name: any) => `| ${ACTION_FLOW_OPTIONS.find((o) => o.value === name)?.label || String(name)} | 4.50h | 4.50h |`).join('\n') : `| ${t('report.emptyMasc')} | — | — |`}
| **${t('aeReport.subtotalActionFlows')} (${actionFlowsQty})** | — | **${num(breakdown.actionFlows, 2)}h** |

---

## ${t('aeReport.section6')}

### ${t('aeReport.section61')}
| ${t('aeReport.module')} | H |
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
| **${t('common.subtotal')}** | **${num(breakdown.generalConfig, 2)}h** |

### ${t('aeReport.section62')}
- Suite (Support / Knowledge / Analytics): ${num(Number(breakdown.training || 0) > 0 ? 3.0 : 0, 2)}h
- ${t('aeReport.advancedAnalyticsTraining', { mode: analyticsTrainingType === 'advanced' ? t('aeReport.trainingFull') : t('aeReport.trainingStandard') })}: ${num(analyticsTrainingType === 'advanced' && modulesList.includes('Analytics') ? 6.0 : 0, 2)}h
- Community: ${num(modulesList.includes('Community') ? 1.5 : 0, 2)}h
- Voice: ${num(modulesList.includes('Voice') ? 2.5 : 0, 2)}h
- Copilot: ${num(modulesList.includes('Copilot') ? 2.5 : 0, 2)}h
- QA: ${num(modulesList.includes('QA') ? 2.0 : 0, 2)}h
- WFM: ${num(modulesList.includes('WFM') ? 3.0 : 0, 2)}h
- AI Agents: ${num(modulesList.includes('AI Agents') ? 4.0 : 0, 2)}h
- ADPP: ${num(modulesList.includes('ADPP') ? 1.0 : 0, 2)}h
- ${t('aeReport.subtotalTraining')} **${num(breakdown.training, 2)}h**

### ${t('aeReport.section63')}
| ${t('aeReport.block')} | ${t('aeReport.qty')} × H | ${t('common.total')} |
| :--- | :--- | ---: |
| ${t('aeReport.supportFixedRow')} | 1.83h | 1.83h |
| ${t('aeReport.supportNonTeamRow')} | ${String(zendeskPlan || 'professional').toLowerCase() !== 'team' ? '0.50h' : '0.00h'} | ${num(Number(breakdown.supportFixed || 0) - 1.83, 2)}h |
| ${t('aeReport.wfmFixedRow')} | — | ${num(breakdown.wfmFixed, 2)}h |
| ${t('aeReport.adppFixedRow')} | — | ${num(breakdown.adppFixed, 2)}h |
| **${t('aeReport.subtotalFixed')}** | — | **${num(Number(breakdown.supportFixed || 0) + Number(breakdown.wfmFixed || 0) + Number(breakdown.adppFixed || 0), 2)}h** |

### ${t('aeReport.section64')}
| ${t('aeReport.module')} | H |
| :--- | ---: |
| ${t('aeReport.suiteWorkshopRow')} | ${(modulesList.includes('Support') || modulesList.includes('Knowledge') || modulesList.includes('Analytics')) ? '1.00h' : '0.00h'} |
| Voice | ${modulesList.includes('Voice') ? '0.50h' : '0.00h'} |
| Copilot | ${modulesList.includes('Copilot') ? '0.50h' : '0.00h'} |
| AI Agents | ${modulesList.includes('AI Agents') ? '0.50h' : '0.00h'} |
| QA | ${modulesList.includes('QA') ? '0.50h' : '0.00h'} |
| WFM | ${modulesList.includes('WFM') ? '0.50h' : '0.00h'} |
| **${t('aeReport.subtotalWorkshops')}** | **${num(breakdown.workshops, 2)}h** |

### ${t('aeReport.section65')}
| ${t('common.item')} | ${t('common.value')} | H |
| :--- | :--- | ---: |
| ${t('aeReport.operationLanguages')} | ${opLangs} | — |
| ${t('aeReport.dynamicContentBase')} | ~${num(dynamicContentBase, 2)} ${t('aeReport.itemsUnit')} | 0.08h/item |
| **${t('common.subtotal')}** | — | **${num(breakdown.operationLanguages, 2)}h** |

### ${t('aeReport.section66')}
- SSO ${hasSSO ? t('aeReport.ssoEnabled') : t('aeReport.ssoDisabled')}: **${num(breakdown.sso, 2)}h** ${t('aeReport.ssoFlatNote')}

### ${t('aeReport.section67')}
- ${t('aeReport.articles')}: ${knowledgeArticles}
- ${t('aeReport.hoursPerArticle')}
- ${t('aeReport.subtotalKnowledge')} **${num(breakdown.knowledge, 2)}h**

---

## ${t('aeReport.section7')}

${t('aeReport.pctBaseNote')} **${num(Math.max(0, Number(estimation.lineItemHours || 0) - Number(breakdown.training || 0) - Number(breakdown.nativeConnections || 0) - Number(breakdown.thirdPartyApps || 0)), 2)}h**

| ${t('report.variable')} | ${t('report.rule')} | ${t('report.hours')} |
| :--- | :--- | ---: |
| ${t('ae.discovery')} | 20% ${t('aeReport.pctOverBaseAbove')} | **${num(estimation.discoveryHours, 2)}h** |
| ${t('ae.validation')} | 15% ${t('aeReport.pctOverBaseAbove')} | **${num(estimation.validationHours, 2)}h** |
| ${t('report.techComm')} | 10% ${t('aeReport.pctOverBaseAbove')} | **${num(estimation.commTechHours, 2)}h** |
| ${t('ae.goLive')} | 5% ${t('aeReport.pctOverBaseAbove')} | **${num(estimation.goLiveHours, 2)}h** |
| ${t('report.projectMgmt')} | ${t('aeReport.gpRule')} | **${num(estimation.gpHours, 2)}h** ${Number(estimation.gpHours || 0) === 0 ? t('report.belowGpThreshold') : ''} |
| **${t('report.variablesSubtotal')}** | | **${num(Number(estimation.discoveryHours || 0) + Number(estimation.validationHours || 0) + Number(estimation.commTechHours || 0) + Number(estimation.goLiveHours || 0) + Number(estimation.gpHours || 0), 2)}h** |

---

## ${t('aeReport.section8')}

| ${t('common.item')} | ${t('report.hours')} |
| :--- | ---: |
| ${t('aeReport.allGroups')} | ${num(estimation.lineItemHours, 2)}h |
| + ${t('ae.discovery')} | ${num(estimation.discoveryHours, 2)}h |
| + ${t('ae.validation')} | ${num(estimation.validationHours, 2)}h |
| + ${t('ae.goLive')} | ${num(estimation.goLiveHours, 2)}h |
| + ${t('report.techComm')} | ${num(estimation.commTechHours, 2)}h |
| + ${t('report.projectMgmt')} | ${num(estimation.gpHours, 2)}h |
| **${t('report.totalEstimatedEffort')}** | **${num(estimation.total, 2)}h** |

---

## ${t('aeReport.section9')}

${estimation.needsSC ? [
  t('report.requiresSC'),
  estimation.escalationMessage ? `- ${String(estimation.escalationMessage)}` : '',
  t('report.triggerCriteria'),
].filter(Boolean).join('\n') : [
  t('report.withinLimits'),
  t('report.reviewAnyway'),
].join('\n')}

${estimation.total > 60 ? t('report.scTriggerNote', { total: num(estimation.total, 2) }) : ''}
`;
    
    setMarkdownReport(report.trim());

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
  const scopePrompt = useMemo(() => {
    if (!resultSnapshot) return '';

    const inputs = resultSnapshot.engineInputs || {};
    const bd = (resultSnapshot.engineResult?.breakdown || {}) as Record<string, number>;

    const modules: string[] = (inputs.selectedModules || []).filter(Boolean);

    const channels: ScopeExportChannel[] = (inputs.selectedChannels || []).map((key: string) => {
      const option = [...channelOptions, ...extraChannelOptions].find((o) => {
        const mapped = CHANNEL_LEGACY_TO_KEY[o.id];
        return mapped === key || o.id === key;
      });
      return {
        label: option?.label || String(key),
        quantity: Math.max(1, Number(inputs.channelQuantities?.[key] ?? 1)),
      };
    });

    const integrations: ScopeExportIntegration[] = [
      ...(selectedNativeConnections || []).filter(Boolean).map((name: string) => ({
        kind: 'Integração nativa', label: name, quantity: 1,
      })),
      ...(selectedApps || []).filter(Boolean).map((name: string) => ({
        kind: 'Marketplace', label: name,
        quantity: Math.max(1, Number(appQuantities[name] ?? 1)),
      })),
      ...(selectedActionFlows || []).filter(Boolean).map((name: string) => ({
        kind: 'Action Flow',
        label: ACTION_FLOW_OPTIONS.find((o) => o.value === name)?.label || String(name),
        quantity: 1,
      })),
      ...(hasAppCondicionais ? [{ kind: 'App AktieNow', label: 'Condicionais Avançadas', quantity: 1 }] : []),
      ...(hasAppTicketManager ? [{ kind: 'App AktieNow', label: 'Ticket Manager', quantity: 1 }] : []),
    ];

    /**
     * A Calculadora AE não tem biblioteca de itens como o framework: o engine
     * devolve grupos de horas. Cada grupo com hora > 0 vira uma linha, o que dá
     * à skill a mesma base para decidir quais bullets do template ficam.
     */
    const groupLabels: Record<string, string> = {
      supportConfig: 'Configuração Support', voiceConfig: 'Configuração Voice',
      copilotConfig: 'Configuração Copilot', wfmConfig: 'Configuração WFM',
      qaConfig: 'Configuração QA', agentSetup: 'Cadastro de agentes',
      brandSetup: 'Configuração de marcas', channelSetup: 'Configuração de canais',
      appCondicionais: 'App Condicionais Avançadas', appTicketManager: 'App Ticket Manager',
      sso: 'Single Sign-On (SSO)', generalConfig: 'Configurações gerais',
      training: 'Treinamento', supportFixed: 'Pacotes fixos Support',
      wfmFixed: 'Pacotes fixos WFM', adppFixed: 'Pacotes fixos ADPP',
      nativeConnections: 'Integrações nativas', knowledge: 'Knowledge / Central de Ajuda',
      sideConversations: 'Conversas paralelas (Side Conversations)',
      thirdPartyApps: 'Apps de Marketplace', workshops: 'Workshop',
      operationLanguages: 'Conteúdo dinâmico / multi-idioma',
      actionFlows: 'Action Flow',
    };

    const items: ScopeExportItem[] = Object.entries(bd)
      .filter(([, hours]) => Number(hours) > 0)
      .map(([key, hours]) => ({
        category: 'Calculadora AE',
        subcategory: 'Grupos de esforço',
        label: groupLabels[key] || key,
        quantity: 1,
        hours: Number(hours) || 0,
      }));

    // Canais e integrações também entram como itens: é deles que as flags de
    // WhatsApp, e-mail e Central de Ajuda são detectadas.
    channels.forEach((c) => items.push({
      category: 'Canais', subcategory: 'Canais',
      label: c.label, quantity: Number(c.quantity) || 1, hours: 0,
    }));
    integrations.forEach((i) => items.push({
      category: i.kind, subcategory: 'Integrações',
      label: i.label, quantity: Number(i.quantity) || 1, hours: 0,
    }));

    const flags = detectSuppressionFlags(items, {
      // A Calculadora nunca contempla desenvolvimento nem design sob medida.
      desenvolvimento: false,
      design: false,
      sso: Boolean(hasSSO),
      'side-conversations': Boolean(hasTeamsSideConv || hasSlackSideConv),
      'action-flow': (selectedActionFlows || []).filter(Boolean).length > 0,
      knowledge: Number(knowledgeArticles) > 0 || modules.includes('Knowledge'),
    });

    return buildScopePrompt({
      origin: 'calculadora-ae',
      template: 'escopo-padrao-60h',
      clientName: resultSnapshot.clientName,
      projectName: resultSnapshot.clientName,
      versionName: initialVersion != null ? `v${initialVersion}` : 'v1',
      generatedAt: new Date(),
      zohoLink,
      preSalesName: (session?.user as any)?.name || null,
      totalHours: resultSnapshot.total,
      // A Calculadora não separa horas por skill; o total técnico é a linha de
      // implantação e as variáveis vêm no bloco de percentuais.
      skillHours: {
        'Implantação': resultSnapshot.techHours,
        'GP': shownVar('gp'),
      },
      percents: null,
      planTierLabel: `Suite ${String(zendeskPlan || 'professional').replace(/^\w/, (c) => c.toUpperCase())}`,
      skuLabel: skuType === 'employee_service' ? t('plans.employeeService') : t('plans.customerService'),
      modules,
      channels,
      integrations,
      flags,
      categories: null,
      items,
      crm: null,
    });
  }, [
    resultSnapshot, selectedNativeConnections, selectedApps, appQuantities,
    selectedActionFlows, hasAppCondicionais, hasAppTicketManager, hasSSO,
    hasTeamsSideConv, hasSlackSideConv, knowledgeArticles, zohoLink,
    zendeskPlan, skuType, initialVersion, session, t,
  ]);

  const [scopePromptCopied, setScopePromptCopied] = useState(false);

  const handleCopyScopePrompt = async () => {
    if (!scopePrompt) return;
    try {
      await navigator.clipboard.writeText(scopePrompt);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = scopePrompt;
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
            <h1 className="text-6xl font-black text-brand-dark tracking-tighter font-heading uppercase leading-none">
              {t('ae.titleCalculator')} <span className="text-brand-primary">{t('ae.titleAE')}</span>
            </h1>
            <p className="text-slate-400 text-xs mt-4 font-bold uppercase tracking-[0.2em]">{t('ae.subtitle')}</p>
            {initialVersion != null && (
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-brand-primary/10 border border-brand-primary/20 rounded-2xl">
                <BookOpen className="w-3.5 h-3.5 text-brand-primary" />
                <span className="text-[10px] font-black uppercase tracking-widest text-brand-primary">
                  {cloneFromId ? t('ae.newVersionFrom', { version: initialVersion }) : t('ae.versionBadge', { version: initialVersion })}
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
              <span>{t('ae.myHistory')}</span>
            </Link>
            {showResult && (
              <button 
                onClick={handleNewSimulation}
                className="text-brand-primary font-black text-[10px] uppercase tracking-widest flex items-center space-x-2 hover:opacity-70 transition-all"
              >
                <Plus className="w-4 h-4 rotate-45" />
                <span>{t('ae.newSimulation')}</span>
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
                <h2 className="text-xl font-black text-brand-dark uppercase tracking-tight">{t('ae.strategicInfo')}</h2>
              </div>
              
              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">{t('ae.clientName')}</label>
                  <input 
                    type="text" 
                    value={clientName}
                    onChange={(e) => setClientName(e.target.value)}
                    placeholder={t('ae.clientNamePlaceholder')}
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 text-sm font-bold focus:ring-2 focus:ring-brand-primary focus:bg-white outline-none transition-all"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">{t('ae.dealLink')}</label>
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
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">{t('ae.clientObjectives')}</label>
                  <textarea 
                    value={clientObjectives}
                    onChange={(e) => setClientObjectives(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 text-sm font-medium focus:ring-2 focus:ring-brand-primary focus:bg-white outline-none transition-all h-24 resize-none"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">{t('ae.successIndicators')}</label>
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
                <h2 className="text-xl font-black text-brand-dark uppercase tracking-tight">{t('ae.modulesSection')}</h2>
              </div>

              <div className="space-y-8">
                <div className="space-y-4">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">{t('ae.modules')}</label>
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
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 block">{t('ae.trainingType')}</label>
                    <div className="flex bg-white p-1 rounded-xl border border-slate-200">
                      <button 
                        onClick={() => setAnalyticsTrainingType('standard')} 
                        className={`flex-1 py-2.5 rounded-lg text-[9px] font-black uppercase transition-all ${analyticsTrainingType === 'standard' ? 'bg-brand-primary text-white shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                      >
                        {t('ae.standardTraining')}
                      </button>
                      <button 
                        onClick={() => setAnalyticsTrainingType('advanced')} 
                        className={`flex-1 py-2.5 rounded-lg text-[9px] font-black uppercase transition-all ${analyticsTrainingType === 'advanced' ? 'bg-brand-primary text-white shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                      >
                        {t('ae.advancedTraining')}
                      </button>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-4">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">{t('ae.operationType')}</label>
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
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">{t('ae.sku')}</label>
                    <div className="flex bg-slate-100 p-1 rounded-xl">
                      <button onClick={() => setSkuType('customer_service')} className={`flex-1 py-2 rounded-lg text-[9px] font-black uppercase transition-all ${skuType === 'customer_service' ? 'bg-white text-brand-dark shadow-sm' : 'text-slate-400'}`}>{t('ae.skuCustomer')}</button>
                      <button onClick={() => setSkuType('employee_service')} className={`flex-1 py-2 rounded-lg text-[9px] font-black uppercase transition-all ${skuType === 'employee_service' ? 'bg-white text-brand-dark shadow-sm' : 'text-slate-400'}`}>{t('ae.skuEmployee')}</button>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">{t('ae.deployment')}</label>
                  <div className="flex bg-slate-100 p-1 rounded-xl">
                    <button onClick={() => setDeploymentType('new')} className={`flex-1 py-2 rounded-lg text-[9px] font-black uppercase transition-all ${deploymentType === 'new' ? 'bg-brand-primary text-white shadow-sm' : 'text-slate-400'}`}>{t('ae.deploymentNew')}</button>
                    <button onClick={() => setDeploymentType('optimization')} className={`flex-1 py-2 rounded-lg text-[9px] font-black uppercase transition-all ${deploymentType === 'optimization' ? 'bg-brand-primary text-white shadow-sm' : 'text-slate-400'}`}>{t('ae.deploymentOptimization')}</button>
                  </div>
                </div>

                <div className="space-y-6 pt-6 border-t border-slate-100">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">{t('ae.additionalServices')}</label>
                  
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
                              <span className={`text-[9px] font-black uppercase tracking-widest ${item.state ? 'text-brand-dark' : 'text-slate-500'}`}>{item.label}</span>
                            </div>
                            <input type="checkbox" checked={item.state} onChange={(e) => item.setter(e.target.checked)} className="w-5 h-5 rounded border-slate-300 text-brand-primary focus:ring-brand-primary" />
                          </label>
                        ))}
                      </div>
                      <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <Globe className="w-4 h-4 text-slate-400" />
                          <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">{t('ae.operationLanguages')}</span>
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
                          <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">{t('ae.articleCount')}</span>
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
                      {t('ae.selectSupportHint')}
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
                <h2 className="text-xl font-black text-brand-dark uppercase tracking-tight">{t('ae.volumeAndChannels')}</h2>
              </div>

              <div className="grid grid-cols-3 gap-6">
                <div className="space-y-2">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">{t('ae.agents')}</label>
                  <input type="number" min="1" value={agents} onChange={(e) => setAgents(Math.max(1, parseInt(e.target.value) || 1))} className="w-full bg-white border border-slate-200 rounded-2xl px-6 py-4 text-sm font-black focus:ring-2 focus:ring-brand-primary outline-none" />
                </div>
                <div className="space-y-2">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">{t('ae.brands')}</label>
                  <input type="number" min="1" value={brands} onChange={(e) => setBrands(Math.max(1, parseInt(e.target.value) || 1))} className="w-full bg-white border border-slate-200 rounded-2xl px-6 py-4 text-sm font-black focus:ring-2 focus:ring-brand-primary outline-none" />
                </div>
                <div className="space-y-2">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">{t('ae.areas')}</label>
                  <input type="number" min="1" value={areas} onChange={(e) => setAreas(Math.max(1, parseInt(e.target.value) || 1))} className="w-full bg-white border border-slate-200 rounded-2xl px-6 py-4 text-sm font-black focus:ring-2 focus:ring-brand-primary outline-none" />
                </div>
              </div>

                <div className="space-y-4">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">{t('ae.activeChannels')}</label>
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
                            <span className="text-[8px] font-black text-slate-300 uppercase">{t('common.qtyShort')}</span>
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
                              className={`flex-1 text-left text-[9px] font-black uppercase tracking-tight ${selectedChannels.includes(opt.id) ? 'text-brand-dark' : 'text-slate-400'}`}
                            >
                              {opt.label}
                            </button>
                            {selectedChannels.includes(opt.id) && (
                              <div className="flex items-center space-x-2 animate-in zoom-in-90 duration-300">
                                <span className="text-[8px] font-black text-slate-300 uppercase">{t('common.qtyShort')}</span>
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
                <h2 className="text-xl font-black text-brand-dark uppercase tracking-tight">{t('ae.zendeskEcosystem')}</h2>
              </div>

              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">{t('ae.zendeskPlan')}</label>
                  <select value={zendeskPlan} onChange={(e) => setZendeskPlan(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 text-sm font-black uppercase outline-none focus:ring-2 focus:ring-brand-primary transition-all">
                    <option value="team">{t('ae.planTeam')}</option>
                    <option value="growth">{t('ae.planGrowth')}</option>
                    <option value="professional">{t('ae.planProfessional')}</option>
                    <option value="enterprise">{t('ae.planEnterprise')}</option>
                  </select>
                </div>

                <div className="space-y-4">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">{t('ae.actionFlow')}</label>
                  <div className="p-6 bg-slate-50 rounded-[2rem] border border-slate-200 space-y-4">
                    <select
                      value=""
                      onChange={(e) => addActionFlow(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-2xl px-6 py-4 text-sm font-black outline-none focus:ring-2 focus:ring-brand-primary transition-all"
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
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">{t('ae.aktieApps')}</label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <label className={`flex items-center justify-between p-4 rounded-xl border cursor-pointer transition-all ${hasAppCondicionais ? 'bg-brand-primary/5 border-brand-primary' : 'bg-slate-50 border-slate-200 opacity-60 hover:border-brand-primary/30'}`}>
                      <div className="flex items-center space-x-3">
                        <Box className={`w-4 h-4 ${hasAppCondicionais ? 'text-brand-primary' : 'text-slate-400'}`} />
                        <span className={`text-[9px] font-black uppercase tracking-widest ${hasAppCondicionais ? 'text-brand-dark' : 'text-slate-500'}`}>{t('ae.advancedConditionals')}</span>
                      </div>
                      <input type="checkbox" checked={hasAppCondicionais} onChange={(e) => setHasAppCondicionais(e.target.checked)} className="w-5 h-5 rounded border-slate-300 text-brand-primary focus:ring-brand-primary" />
                    </label>
                    <label className={`flex items-center justify-between p-4 rounded-xl border cursor-pointer transition-all ${hasAppTicketManager ? 'bg-brand-primary/5 border-brand-primary' : 'bg-slate-50 border-slate-200 opacity-60 hover:border-brand-primary/30'}`}>
                      <div className="flex items-center space-x-3">
                        <Box className={`w-4 h-4 ${hasAppTicketManager ? 'text-brand-primary' : 'text-slate-400'}`} />
                        <span className={`text-[9px] font-black uppercase tracking-widest ${hasAppTicketManager ? 'text-brand-dark' : 'text-slate-500'}`}>{t('ae.ticketManager')}</span>
                      </div>
                      <input type="checkbox" checked={hasAppTicketManager} onChange={(e) => setHasAppTicketManager(e.target.checked)} className="w-5 h-5 rounded border-slate-300 text-brand-primary focus:ring-brand-primary" />
                    </label>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">{t('ae.marketplaceApps')}</label>
                    {!hasAppsMarketplace && (
                      <button
                        type="button"
                        onClick={() => setHasAppsMarketplace(true)}
                        className="text-[9px] font-black text-brand-primary uppercase tracking-widest hover:opacity-70 transition-all"
                      >
                        {t('ae.enableSelection')}
                      </button>
                    )}
                  </div>
                  {hasAppsMarketplace && (
                    <div className="p-6 bg-slate-50 rounded-[2rem] border border-slate-200 space-y-4 animate-in fade-in slide-in-from-top-2">
                      <div className="flex flex-wrap gap-2">
                        {marketplaceOptions.map(({ value: app, label: appLabel }) => (
                          <div key={app} className="flex items-center space-x-2">
                            <button
                              onClick={() => toggleApp(app)}
                              className={`px-4 py-2 rounded-xl border text-[9px] font-black uppercase transition-all ${
                                selectedApps.includes(app) ? 'bg-brand-primary border-brand-primary text-white shadow-lg' : 'bg-white border-slate-200 text-slate-400 hover:border-brand-primary/30'
                              }`}
                            >
                              {appLabel}
                            </button>
                            {selectedApps.includes(app) && (app === 'SweetHawk' || app === 'Outros') && (
                              <div className="flex items-center space-x-2 animate-in zoom-in-90 duration-300">
                                <span className="text-[8px] font-black text-slate-300 uppercase">{t('common.qtyShort')}</span>
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
                        <input type="text" value={otherApp} onChange={(e) => setOtherApp(e.target.value)} placeholder={t('ae.otherAppsPlaceholder')} className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-xs font-bold" />
                      )}
                    </div>
                  )}
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">{t('ae.nativeConnections')}</label>
                    {!hasNativeConnections && (
                      <button
                        type="button"
                        onClick={() => setHasNativeConnections(true)}
                        className="text-[9px] font-black text-brand-primary uppercase tracking-widest hover:opacity-70 transition-all"
                      >
                        {t('ae.enableSelection')}
                      </button>
                    )}
                  </div>
                  {hasNativeConnections && (
                    <div className="p-6 bg-slate-50 rounded-[2rem] border border-slate-200 space-y-4 animate-in fade-in slide-in-from-top-2">
                      <div className="flex flex-wrap gap-2">
                        {nativeConnectionOptions.map(({ value: conn, label: connLabel }) => (
                          <button
                            key={conn}
                            onClick={() => toggleNativeConnection(conn)}
                            className={`px-4 py-2 rounded-xl border text-[9px] font-black uppercase transition-all ${
                              selectedNativeConnections.includes(conn) ? 'bg-brand-primary border-brand-primary text-white shadow-lg' : 'bg-white border-slate-200 text-slate-400 hover:border-brand-primary/30'
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

            <div className="bg-brand-dark dark:bg-[color:var(--bg-card)] rounded-[3rem] p-10 space-y-8 text-white shadow-2xl dark:border dark:border-[color:var(--border-main)] dark:text-[color:var(--text-main)]">
              <div className="flex items-center space-x-4 border-b border-white/10 dark:border-[color:var(--border-main)] pb-6">
                <div className="brand-bg-primary p-3 rounded-2xl text-white">
                  <Zap className="w-6 h-6" />
                </div>
                <h2 className="text-xl font-black uppercase tracking-tight dark:text-[color:var(--text-main)]">{t('ae.finishEstimate')}</h2>
              </div>

              {!validation.valid && validation.errors.length > 0 && (
                <div className="space-y-2">
                  <p className="text-[9px] font-black text-amber-400 uppercase tracking-widest">{t('ae.beforeCalculating')}</p>
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
                {t('ae.reviewNotice')}
              </p>

              <button
                onClick={handleCalculate}
                disabled={!clientName || isPending || !validation.valid}
                className="w-full brand-bg-primary text-white p-6 rounded-2xl font-black text-xs uppercase tracking-[0.3em] shadow-xl hover:opacity-90 active:scale-95 transition-all flex items-center justify-center space-x-4 disabled:opacity-50 disabled:active:scale-100"
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
              : 'bg-brand-dark text-white dark:bg-[color:var(--bg-card)] dark:text-[color:var(--text-main)] dark:border dark:border-[color:var(--border-main)]'
          }`}>
            <div className="absolute top-0 right-0 p-12 opacity-5 pointer-events-none">
              {shown.needsSC ? <AlertTriangle className="w-64 h-64 text-amber-500 dark:text-[color:var(--accent)]" /> : <ShieldCheck className="w-64 h-64 text-white dark:text-[color:var(--accent)]" />}
            </div>

            <div className="relative z-10 space-y-8">
              <div className="flex flex-col items-center space-y-4">
                <div className={`w-20 h-20 rounded-3xl flex items-center justify-center shadow-2xl ${
                  shown.needsSC
                    ? 'bg-amber-200 text-amber-700 dark:bg-[color:var(--accent)]/20 dark:text-[color:var(--accent)]'
                    : 'brand-bg-primary text-white dark:bg-[color:var(--primary)] dark:text-white'
                }`}>
                  {shown.needsSC ? <AlertTriangle className="w-10 h-10" /> : <CheckCircle2 className="w-10 h-10" />}
                </div>
                <div>
                  <h3 className={`text-sm font-black uppercase tracking-[0.3em] ${
                    shown.needsSC
                      ? 'text-amber-600 dark:text-[color:var(--accent)]'
                      : 'text-slate-400 dark:text-[color:var(--text-muted)]'
                  }`}>
                    Resultado para {shown.clientName}
                  </h3>
                </div>
              </div>

              <div className="space-y-2">
                <div className={`text-8xl font-black tracking-tighter ${
                  shown.needsSC
                    ? 'text-amber-700 dark:text-[color:var(--accent)]'
                    : 'text-brand-accent dark:text-[color:var(--accent)]'
                }`}>
                  {shown.needsSC ? t('ae.consultSC') : `${shown.total.toFixed(0)}H`}
                </div>
                <p className={`text-lg font-bold uppercase tracking-widest ${
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
                    <span className="text-[8px] font-black text-slate-500 dark:text-[color:var(--text-muted)] uppercase tracking-widest block mb-1">{t('editor.skillImplementation')}</span>
                    <span className="text-xl font-black tracking-tight dark:text-[color:var(--text-main)]">{shown.techHours.toFixed(1)}H</span>
                  </div>
                  <div className="text-center p-4 bg-white/5 dark:bg-[color:var(--bg-input)] rounded-2xl">
                    <span className="text-[8px] font-black text-slate-500 dark:text-[color:var(--text-muted)] uppercase tracking-widest block mb-1">{t('ae.gp')}</span>
                    <span className="text-xl font-black tracking-tight text-brand-secondary dark:text-[color:var(--secondary)]">{shownVar('gp').toFixed(1)}H</span>
                  </div>
                  <div className="text-center p-4 bg-white/5 dark:bg-[color:var(--bg-input)] rounded-2xl">
                    <span className="text-[8px] font-black text-slate-500 dark:text-[color:var(--text-muted)] uppercase tracking-widest block mb-1">{t('ae.discovery')}</span>
                    <span className="text-xl font-black tracking-tight text-amber-500 dark:text-[color:var(--accent)]">{shownVar('discovery').toFixed(1)}H</span>
                  </div>
                  <div className="text-center p-4 bg-white/5 dark:bg-[color:var(--bg-input)] rounded-2xl">
                    <span className="text-[8px] font-black text-slate-500 dark:text-[color:var(--text-muted)] uppercase tracking-widest block mb-1">{t('ae.validation')}</span>
                    <span className="text-xl font-black tracking-tight text-blue-500 dark:text-[color:var(--text-main)]">{shownVar('validation').toFixed(1)}H</span>
                  </div>
                  <div className="text-center p-4 bg-white/5 dark:bg-[color:var(--bg-input)] rounded-2xl">
                    <span className="text-[8px] font-black text-slate-500 dark:text-[color:var(--text-muted)] uppercase tracking-widest block mb-1">{t('ae.techComm')}</span>
                    <span className="text-xl font-black tracking-tight text-purple-500 dark:text-[color:var(--text-main)]">{shownVar('comunicacao_tecnica').toFixed(1)}H</span>
                  </div>
                  <div className="text-center p-4 bg-white/5 dark:bg-[color:var(--bg-input)] rounded-2xl">
                    <span className="text-[8px] font-black text-slate-500 dark:text-[color:var(--text-muted)] uppercase tracking-widest block mb-1">{t('ae.goLive')}</span>
                    <span className="text-xl font-black tracking-tight text-green-500 dark:text-[color:var(--text-main)]">{shownVar('go_live').toFixed(1)}H</span>
                  </div>
                </div>
              )}
            </div>

            <div className="relative z-10 pt-10">
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                {isPending ? (
                  <div className="flex items-center space-x-3 text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-[color:var(--text-muted)]">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>{t('ae.savingRecord')}</span>
                  </div>
                ) : (
                  <div className="flex items-center space-x-3 text-[10px] font-black uppercase tracking-widest text-brand-primary dark:text-[color:var(--primary)]">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>{t('ae.recordSaved')}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Tabela de itens considerados — detalhe conforme o segmento do LEITOR */}
          <div className="mt-12">
            <div className="bg-white dark:bg-[color:var(--bg-card)] dark:border dark:border-[color:var(--border-main)] rounded-[3rem] border border-slate-200 p-8 md:p-10 shadow-xl">
              <AEResultTable estimation={shown.engineResult} inputs={shown.engineInputs} />

              {/* Escopo Padrão: mesmo envelope do framework, template menor.
                  Cópia manual por decisão de projeto — sem chamada de API. */}
              <div className="mt-8 pt-8 border-t border-slate-100 dark:border-[color:var(--border-main)] flex flex-wrap items-center justify-between gap-4">
                <p className="text-[9px] font-bold text-slate-400 dark:text-[color:var(--text-muted)] max-w-md leading-relaxed">
                  {t('editor.copyScopePromptHint')}
                </p>
                <button
                  type="button"
                  onClick={handleCopyScopePrompt}
                  disabled={!scopePrompt}
                  className={`shrink-0 px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 disabled:opacity-50 ${
                    scopePromptCopied
                      ? 'brand-bg-primary text-white'
                      : 'bg-slate-50 dark:bg-[color:var(--bg-input)] border border-slate-200 dark:border-[color:var(--border-main)] text-slate-500 dark:text-[color:var(--text-muted)] hover:border-brand-primary hover:text-brand-primary'
                  }`}
                >
                  {scopePromptCopied ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{scopePromptCopied ? t('editor.scopePromptCopied') : t('editor.copyScopePrompt')}</span>
                </button>
              </div>
            </div>
          </div>

          {/* Relatório Executivo — exclusivo de administradores. Os demais
              segmentos ficam com a tabela de resultado acima. */}
          {showExecutiveReport && (
          <div className="mt-12 space-y-12">
            <div className="bg-white dark:bg-[color:var(--bg-card)] dark:border dark:border-[color:var(--border-main)] rounded-[3rem] border border-slate-200 p-10 shadow-xl overflow-hidden">
              <div className="flex items-center justify-between mb-8 border-b border-slate-50 dark:border-[color:var(--border-main)] pb-6">
                <div className="flex items-center space-x-4">
                  <div className="bg-brand-primary/10 p-3 rounded-2xl text-brand-primary dark:bg-[color:var(--primary)]/15 dark:text-[color:var(--primary)]">
                    <MessageSquare className="w-6 h-6" />
                  </div>
                  <h2 className="text-xl font-black text-brand-dark dark:text-[color:var(--text-main)] uppercase tracking-tight">{t('ae.executiveReport')}</h2>
                </div>
                <button 
                  onClick={() => {
                    navigator.clipboard.writeText(markdownReport);
                    alert(t('ae.reportCopied'));
                  }}
                  className="bg-slate-50 hover:bg-slate-100 text-slate-500 dark:bg-[color:var(--bg-input)] dark:text-[color:var(--text-muted)] dark:hover:opacity-90 dark:border dark:border-[color:var(--border-main)] px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center space-x-2"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>{t('ae.copyMarkdown')}</span>
                </button>
              </div>
              <div className="prose prose-slate max-w-none text-xs font-medium leading-relaxed whitespace-pre-wrap dark:bg-[color:var(--bg-card)] dark:text-[color:var(--text-main)]">
                {markdownReport}
              </div>
            </div>
          </div>
          )}

          <div className="mt-12 text-center">
          </div>
        </div>
      )}
    </div>
  );
}
