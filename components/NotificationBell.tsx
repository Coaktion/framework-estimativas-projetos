'use client';

/**
 * O sininho do cabeçalho: notificações da pessoa logada (hoje, atividade nova
 * no Backlog do Radar). Só aparece para quem tem acesso (SC e ADMIN).
 * Confere a cada minuto e quando a janela volta ao foco.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useTranslation } from 'react-i18next';
import { Bell, CheckCheck } from 'lucide-react';
import { canAccessNotificacoes } from '@/lib/segments';
import { HEADER_ICON_BUTTON } from './Navbar';

type Notificacao = {
  id: string;
  tipo: string;
  titulo: string;
  corpo: string | null;
  link: string | null;
  lidaEm: string | null;
  criadoEm: string;
};

const MINUTO = 60_000;

function haQuanto(iso: string, t: (k: string, o?: Record<string, unknown>) => string) {
  const min = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / MINUTO));
  if (min < 1) return t('notificacoes.agora');
  if (min < 60) return t('notificacoes.minutos', { count: min });
  const h = Math.floor(min / 60);
  if (h < 24) return t('notificacoes.horas', { count: h });
  return t('notificacoes.dias', { count: Math.floor(h / 24) });
}

export default function NotificationBell() {
  const { data: session } = useSession();
  const user = session?.user as { isAdmin?: boolean; role?: string | null } | undefined;
  const pode = canAccessNotificacoes(user);
  const { t } = useTranslation();
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [itens, setItens] = useState<Notificacao[]>([]);
  const [naoLidas, setNaoLidas] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  const carregar = useCallback(async () => {
    try {
      const r = await fetch('/api/notificacoes', { cache: 'no-store' });
      if (!r.ok) return;
      const d = (await r.json()) as { itens: Notificacao[]; naoLidas: number };
      setItens(d.itens);
      setNaoLidas(d.naoLidas);
    } catch {
      // sem rede: tenta de novo no próximo ciclo
    }
  }, []);

  useEffect(() => {
    if (!pode) return;
    void carregar();
    const intervalo = window.setInterval(() => void carregar(), MINUTO);
    const aoFocar = () => void carregar();
    window.addEventListener('focus', aoFocar);
    return () => {
      window.clearInterval(intervalo);
      window.removeEventListener('focus', aoFocar);
    };
  }, [pode, carregar]);

  useEffect(() => {
    if (!aberto) return;
    const fechar = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setAberto(false);
    };
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setAberto(false);
    document.addEventListener('mousedown', fechar);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mousedown', fechar);
      document.removeEventListener('keydown', esc);
    };
  }, [aberto]);

  if (!pode) return null;

  const marcar = async (ids?: string[]) => {
    const agora = new Date().toISOString();
    setItens((l) => l.map((n) => (!ids || ids.includes(n.id) ? { ...n, lidaEm: n.lidaEm ?? agora } : n)));
    setNaoLidas((c) => (ids ? Math.max(0, c - itens.filter((n) => ids.includes(n.id) && !n.lidaEm).length) : 0));
    await fetch('/api/notificacoes/lidas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(ids ? { ids } : {}),
    }).catch(() => undefined);
  };

  const abrir = (n: Notificacao) => {
    if (!n.lidaEm) void marcar([n.id]);
    setAberto(false);
    if (n.link) router.push(n.link);
  };

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setAberto((a) => !a)}
        className={`${HEADER_ICON_BUTTON} relative h-10 min-w-[40px] rounded-full`}
        aria-label={naoLidas ? t('notificacoes.botaoComNaoLidas', { count: naoLidas }) : t('notificacoes.botao')}
        title={t('notificacoes.titulo')}
        aria-expanded={aberto}
        aria-haspopup="dialog"
      >
        <Bell className="w-[18px] h-[18px]" />
        {naoLidas > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-red-600 text-white text-[10.5px] font-bold leading-[18px] text-center">
            {naoLidas > 99 ? '99+' : naoLidas}
          </span>
        )}
      </button>

      {aberto && (
        <div
          role="dialog"
          aria-label={t('notificacoes.titulo')}
          className="absolute right-0 mt-2 w-[min(380px,calc(100vw-2rem))] bg-white rounded-2xl border border-slate-200 shadow-xl z-[60] overflow-hidden"
        >
          <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-slate-200">
            <span className="text-label font-bold text-brand-dark">{t('notificacoes.titulo')}</span>
            {naoLidas > 0 && (
              <button
                type="button"
                onClick={() => void marcar()}
                className="inline-flex items-center gap-1.5 text-caption font-medium text-slate-500 hover:text-brand-dark"
              >
                <CheckCheck className="w-3.5 h-3.5" /> {t('notificacoes.marcarTodas')}
              </button>
            )}
          </div>
          {itens.length === 0 ? (
            <p className="px-4 py-8 text-center text-label text-slate-500">{t('notificacoes.vazio')}</p>
          ) : (
            <ul className="max-h-[420px] overflow-y-auto">
              {itens.map((n) => (
                <li key={n.id}>
                  <button
                    type="button"
                    onClick={() => abrir(n)}
                    className={`w-full text-left px-4 py-3 border-b border-slate-100 last:border-b-0 hover:bg-slate-50 flex gap-3 ${
                      n.lidaEm ? '' : 'bg-[color:var(--accent-tint)]'
                    }`}
                  >
                    <span
                      className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${n.lidaEm ? 'bg-transparent' : 'brand-bg-primary'}`}
                      aria-hidden
                    />
                    <span className="min-w-0 flex-1">
                      <span className={`block text-label text-brand-dark ${n.lidaEm ? 'font-medium' : 'font-bold'}`}>
                        {n.titulo}
                      </span>
                      {n.corpo && <span className="block text-caption text-slate-600 line-clamp-2">{n.corpo}</span>}
                      <span className="block mt-0.5 text-caption text-slate-400">{haQuanto(n.criadoEm, t)}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
