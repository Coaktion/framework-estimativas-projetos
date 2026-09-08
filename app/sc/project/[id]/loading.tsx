import { Loader2 } from 'lucide-react';

export default function Loading() {
  return (
    <div className="min-h-[calc(100vh-8rem)] flex items-center justify-center p-8">
      <div className="flex flex-col items-center justify-center gap-8 py-24">
        <div className="relative">
          <div className="absolute inset-0 brand-bg-primary opacity-20 blur-2xl rounded-full scale-150" />
          <div className="relative brand-bg-primary w-20 h-20 rounded-3xl flex items-center justify-center shadow-2xl">
            <Loader2 className="w-10 h-10 text-white animate-spin shrink-0" />
          </div>
        </div>
        <div className="flex flex-col items-center gap-2 text-center">
          <p className="text-brand-dark text-2xl font-black uppercase tracking-tighter font-heading leading-none">
            Carregando versão
          </p>
          <p className="text-slate-400 text-[11px] font-bold uppercase tracking-[0.22em]">
            Buscando itens e totais do escopo técnico
          </p>
        </div>
      </div>
    </div>
  );
}
