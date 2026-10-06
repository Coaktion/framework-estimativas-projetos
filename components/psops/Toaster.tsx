'use client';

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { Portal } from './Portal';

export interface Aviso {
  id: number;
  texto: ReactNode;
  tom: 'ok' | 'neutro' | 'erro';
}

const Ctx = createContext<(texto: ReactNode, tom?: Aviso['tom']) => void>(() => {});

export const useAvisos = () => useContext(Ctx);

let seq = 0;

export function ProvedorDeAvisos({ children }: { children: ReactNode }) {
  const [avisos, setAvisos] = useState<Aviso[]>([]);

  const avisar = useCallback((texto: ReactNode, tom: Aviso['tom'] = 'ok') => {
    const id = ++seq;
    setAvisos((a) => [...a, { id, texto, tom }]);
    // erro fica mais tempo na tela: costuma exigir leitura
    setTimeout(() => setAvisos((a) => a.filter((x) => x.id !== id)), tom === 'erro' ? 8000 : 5000);
  }, []);

  const valor = useMemo(() => avisar, [avisar]);

  return (
    <Ctx.Provider value={valor}>
      {children}
      <Portal>
        <div
          aria-live="polite"
          aria-atomic="false"
          className="psops pointer-events-none fixed bottom-5 right-5 z-[99] flex max-w-[400px] flex-col gap-2.5"
        >
          {avisos.map((a) => (
            <div
              key={a.id}
              className={`animate-[psops-entrada_.22s_ease-out] rounded-2xl border px-4 py-3 text-[12.5px] font-bold leading-snug ${
                a.tom === 'ok'
                  ? 'border-psops-acento bg-psops-acento text-psops-sobre'
                  : a.tom === 'erro'
                    ? 'border-psops-alerta bg-psops-surf1 text-psops-alertatinta'
                    : 'border-psops-forte bg-psops-surf1 text-psops-texto'
              }`}
            >
              {a.texto}
            </div>
          ))}
        </div>
      </Portal>
    </Ctx.Provider>
  );
}
