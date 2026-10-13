'use client';

/**
 * Abas do módulo. Não usa <nav>: o globals.scss do portal estiliza todo <nav>
 * como a barra superior (fundo translúcido, blur e sombra).
 */
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslation } from 'react-i18next';

const ABAS = [
  { href: '/pre-sales-ops/triagem', chave: 'psops.abas.triagem' },
  { href: '/pre-sales-ops/backlog', chave: 'psops.abas.backlog' },
  { href: '/pre-sales-ops/artefatos', chave: 'psops.abas.artefatos' },
  { href: '/pre-sales-ops/radar', chave: 'psops.abas.radar' },
];

export function AbasModulo() {
  const pathname = usePathname();
  const { t } = useTranslation();

  return (
    <div
      role="navigation"
      aria-label={t('psops.abas.aria')}
      className="inline-flex flex-wrap gap-1 rounded-2xl border border-psops-linha bg-psops-surf2 p-1"
    >
      {ABAS.map((aba) => {
        const ativa = pathname.startsWith(aba.href);
        return (
          <Link
            key={aba.href}
            href={aba.href}
            aria-current={ativa ? 'page' : undefined}
            className={`rounded-xl px-4 py-2.5 text-[10px] font-black uppercase tracking-widest transition-all ${
              ativa
                ? 'bg-psops-surf1 text-psops-tinta ring-1 ring-psops-linha'
                : 'text-psops-muted hover:text-psops-texto'
            }`}
          >
            {t(aba.chave)}
          </Link>
        );
      })}
    </div>
  );
}
