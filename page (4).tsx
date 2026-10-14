import Link from "next/link";
import Image from "next/image";
import { getServerSession } from "next-auth";
import { ChevronRight, FolderKanban, Calculator, WandSparkles, Radar, SlidersHorizontal, type LucideIcon } from "lucide-react";
import { authOptions } from "@/lib/auth";
import { getServerT } from "@/app/i18n/server";
import { canAccessScopes, canAccessAE, canAccessZdAutoConfig, canAccessPreSalesOps } from "@/lib/segments";
import HomeClient from "./HomeClient";

const EXTERNAL_LINKS = {
  SCOPE_TEMPLATES: {
    pacote_horas:    "https://drive.google.com/drive/folders/1lOjcJwhnhIWX9BpzNWNAaYKai7cVNyMV",
    time_materials:  "https://drive.google.com/drive/folders/1kpjvc5AVKVYUmuiroqY3zo-8v70PQXU4",
    pacote_horas_ae: "https://drive.google.com/drive/folders/15U7l3i5ODWHWy_x38-o72BOoFs7kEM6K",
    escopo_fechado:  "",
  },
  DEMOS: {
    PT: "https://pdi-aktienowbr.zendesk.com/",
    EN: "https://pdi-aktienowusa.zendesk.com/",
    ES: "",
  },
} as const;

type ToolCard = {
  key: string;
  href: string;
  title: string;
  description: string;
  meta: string;
  Icon: LucideIcon;
  big?: boolean;
};

export default async function Home() {
  const t = getServerT();
  const session = await getServerSession(authOptions);
  const user = session?.user as any;
  const isAdmin = user?.isAdmin || false;

  const tools: ToolCard[] = [
    canAccessScopes(user) && { key: 'sc', href: '/sc', title: t('home.newProject'), description: t('home.newProjectDesc'), meta: t('home.newProjectSubtitle'), Icon: FolderKanban, big: true },
    canAccessAE(user) && { key: 'ae', href: '/ae/history', title: t('home.aeCalculator'), description: t('home.aeCalculatorDesc'), meta: t('home.aeCalculatorSubtitle'), Icon: Calculator, big: true },
    canAccessZdAutoConfig(user) && { key: 'zdcfg', href: '/zd-auto-config', title: t('nav.zdAutoConfig'), description: t('nav.zdAutoConfigTitle'), meta: t('home.zdAutoConfigSubtitle'), Icon: WandSparkles },
    canAccessPreSalesOps(user) && { key: 'psops', href: '/pre-sales-ops', title: t('nav.preSalesOps'), description: t('nav.preSalesOpsTitle'), meta: t('home.preSalesOpsSubtitle'), Icon: Radar },
    isAdmin && { key: 'admin', href: '/admin', title: t('home.admin'), description: t('home.adminDesc'), meta: t('home.adminOnly'), Icon: SlidersHorizontal },
  ].filter(Boolean) as ToolCard[];

  // Grade de 6 colunas: os cards grandes ocupam metade da linha, os pequenos um terço.
  // Se sobrar um card pequeno sozinho na última linha, ele ocupa a linha inteira.
  const bigCount = tools.filter((c) => c.big).length;
  const smallCount = tools.length - bigCount;
  const spanFor = (card: ToolCard, index: number) => {
    if (card.big) return bigCount === 1 ? 'md:col-span-6' : 'md:col-span-3';
    const smallIndex = index - bigCount;
    const lastRowStart = smallCount - (smallCount % 3 || 3);
    const lastRowSize = smallCount - lastRowStart;
    if (smallIndex >= lastRowStart && lastRowSize === 1) return 'md:col-span-6';
    if (smallIndex >= lastRowStart && lastRowSize === 2) return 'md:col-span-3';
    return 'md:col-span-2';
  };

  return (
    <div className="flex flex-col gap-14">
      {/* Abertura: título da ferramenta + objeto 3D (engrenagem = ferramentas/operação) */}
      <section className="relative isolate grid grid-cols-1 md:grid-cols-[minmax(0,7fr)_minmax(0,4fr)] items-center gap-6 pt-4">
        {/* Grid claro oficial, só no tema claro; esmaece nas bordas */}
        <div
          aria-hidden
          className="pointer-events-none absolute -z-10 left-[calc(50%-50vw)] right-[calc(50%-50vw)] -top-12 -bottom-10 bg-[url('/brand/bg/light-grid-floor.png')] bg-cover bg-bottom dark:hidden [mask-image:linear-gradient(to_bottom,transparent,black_30%,black_70%,transparent)]"
        />
        <div className="min-w-0">
          <p className="inline-flex items-center gap-2 text-label font-bold uppercase tracking-[0.08em] text-slate-500">
            <span aria-hidden className="w-0 h-0 border-l-[7px] border-l-[color:var(--primary)] border-y-[5px] border-y-transparent" />
            {t('home.tagline')}
          </p>
          <h1 className="font-heading text-[clamp(56px,8vw,88px)] leading-[0.92] text-brand-dark mt-4">
            Tool <span className="text-brand-primary">Center</span>
          </h1>
          <p className="mt-3 max-w-[62ch] text-[18px] font-light text-slate-500">{t('home.subtitle')}</p>
        </div>
        <Image
          src="/brand/3d/gear.png"
          alt=""
          width={520}
          height={567}
          priority
          unoptimized
          className="hidden md:block justify-self-end w-[240px] h-auto"
        />
      </section>

      {tools.length > 0 && (
        <section>
          <div className="flex flex-wrap items-baseline justify-between gap-4 mb-4">
            <h2 className="font-heading text-section text-brand-dark">{t('home.toolsTitle')}</h2>
            <span className="text-label text-slate-500">{t('home.toolsHint')}</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-6 gap-6">
            {tools.map((card, index) => (
              <Link
                key={card.key}
                href={card.href}
                className={`group ${spanFor(card, index)} bg-white border border-slate-200 rounded-2xl shadow-sm p-7 flex flex-col gap-3.5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xl hover:border-slate-300`}
              >
                <span className="w-11 h-11 rounded-xl bg-brand-soft text-brand-soft-fg flex items-center justify-center">
                  <card.Icon className="w-[22px] h-[22px]" />
                </span>
                <h3 className="text-title font-bold text-brand-dark">{card.title}</h3>
                <p className="text-body text-slate-500">{card.description}</p>
                <span className="mt-auto flex items-center justify-between text-label font-medium">
                  <span className="text-slate-500">{card.meta}</span>
                  <ChevronRight className="w-4 h-4 text-brand-dark transition-transform duration-200 group-hover:translate-x-1" />
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section>
        <div className="flex flex-wrap items-baseline justify-between gap-4 mb-4">
          <h2 className="font-heading text-section text-brand-dark">{t('home.resourcesTitle')}</h2>
          <span className="text-label text-slate-500">{t('home.resourcesHint')}</span>
        </div>
        <HomeClient
          templateLinks={EXTERNAL_LINKS.SCOPE_TEMPLATES}
          demoLinks={EXTERNAL_LINKS.DEMOS}
        />
      </section>
    </div>
  );
}
