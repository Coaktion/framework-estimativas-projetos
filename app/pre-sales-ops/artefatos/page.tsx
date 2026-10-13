import { MapaArtefatos } from '@/components/psops/MapaArtefatos';
import { usuarioAtual } from '@/lib/psops/lib/auth';
import { getServerT } from '@/app/i18n/server';

export const dynamic = 'force-dynamic';

export default async function Pagina() {
  const t = getServerT();
  // o layout já barrou quem não tem acesso; aqui só interessa se é admin
  const usuario = await usuarioAtual();

  return (
    <>
      <div className="mb-6">
        <div className="mb-1.5 text-[9px] font-black uppercase tracking-widest text-psops-tinta">
          {t('psops.mapa.editoria')}
        </div>
        <h2 className="font-heading text-2xl font-black uppercase tracking-tight text-psops-texto">
          {t('psops.mapa.titulo')}
        </h2>
        <p className="mt-1.5 max-w-[720px] text-[13px] leading-relaxed text-psops-muted">
          {t('psops.mapa.subtitulo')}
        </p>
      </div>
      <MapaArtefatos admin={Boolean(usuario?.admin)} />
    </>
  );
}
