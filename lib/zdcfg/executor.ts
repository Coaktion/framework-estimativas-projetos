/**
 * Orquestrador da execução (porte do _run_job do app.py + Runner.run/rollback).
 *
 * Roda no NAVEGADOR: chama o servidor um passo por vez. Não depende de React nem
 * de fetch — recebe as funções de chamada — para poder ser testado no Node
 * contra um Zendesk simulado.
 */
import type { Blueprint } from './blueprint';
import type { Criado, Resultado } from './passos';
import { type Ctx, type Passo, ctxInicial, lotesMembership, modulos, passoPreflight } from './plano';

/** Resposta do servidor para um passo. */
export type RespostaPasso =
  | ({ ok: true } & Resultado)
  | { ok: false; erro: string }
  | { ok: false; tenteEm: number };

export type RespostaRollback = { logs: string[]; resultados: { kind: string; id: number | string; ok: boolean }[] };

export type Status = 'ok' | 'abortado' | 'erro' | 'cancelado';

export type Opcoes = {
  bp: Blueprint; // já com a seleção da tela aplicada
  aplicar: boolean;
  forcar: boolean;
  temaArquivo: string | null;
  chamar: (passo: Passo, ctx: Ctx) => Promise<RespostaPasso>;
  chamarRollback: (itens: Criado[]) => Promise<RespostaRollback>;
  log: (m: string) => void;
  /** Help Center desligado: a tela mostra o link e resolve quando o usuário clicar em Continuar. */
  aguardarHelpCenter: (url: string) => Promise<void>;
  cancelado: () => boolean;
  dormir?: (ms: number) => Promise<void>;
  /** Avisa a tela sempre que algo é criado (para o botão "Desfazer"). */
  aoCriar?: (todos: Criado[]) => void;
};

class Interrompido extends Error {}
class ErroPasso extends Error {}

const dormirPadrao = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export async function rollback(
  criados: Criado[], chamarRollback: Opcoes['chamarRollback'], log: (m: string) => void,
  dormir: (ms: number) => Promise<void> = dormirPadrao,
): Promise<void> {
  log(`ROLLBACK: desfazendo ${criados.length} recursos`);
  const varrer = async (itens: Criado[]) => {
    const pend: Criado[] = [];
    for (let i = 0; i < itens.length; i += 5) {
      const lote = itens.slice(i, i + 5);
      try {
        const r = await chamarRollback(lote);
        r.logs.forEach(log);
        r.resultados.forEach((x) => { if (!x.ok) pend.push([x.kind, x.id]); });
      } catch (e) {
        log(`! falha de comunicacao no rollback: ${(e as Error).message}`);
        pend.push(...lote);
      }
    }
    return pend;
  };
  const pendentes = await varrer([...criados].reverse());
  if (!pendentes.length) return;
  log(`ROLLBACK: ${pendentes.length} pendente(s); nova tentativa em 5s...`);
  await dormir(5000);
  const ainda = await varrer(pendentes);
  if (ainda.length) {
    log(`ATENCAO: nao consegui remover automaticamente: ${ainda.map(([k, r]) => `${k} ${r}`).join(', ')}. `
      + 'Remova manualmente no Zendesk (ou rode LIMPAR_DEMO).');
  } else log('ROLLBACK: pendencias resolvidas na 2a tentativa.');
}

export async function executar(o: Opcoes): Promise<{ status: Status; criados: Criado[] }> {
  const dormir = o.dormir ?? dormirPadrao;
  const criados: Criado[] = [];
  let ctx = ctxInicial();

  /** Um passo, com repetição em rate limit. Devolve o resultado ou lança ErroPasso. */
  const passo = async (p: Passo): Promise<Resultado> => {
    for (let tentativa = 0; ; tentativa++) {
      if (o.cancelado()) throw new Interrompido();
      let r: RespostaPasso;
      try {
        r = await o.chamar(p, ctx);
      } catch (e) {
        throw new ErroPasso(`falha de comunicacao com o servidor: ${(e as Error).message}`);
      }
      if (!r.ok && 'tenteEm' in r) {
        if (tentativa >= 8) throw new ErroPasso('limite de requisicoes do Zendesk persistente');
        o.log(`(limite de requisicoes do Zendesk; aguardando ${r.tenteEm}s)`);
        await dormir(r.tenteEm * 1000);
        continue;
      }
      if (!r.ok) throw new ErroPasso('erro' in r ? r.erro : 'falha desconhecida');
      ctx = r.ctx;
      r.logs.forEach(o.log);
      if (r.criados.length) {
        criados.push(...r.criados);
        o.aoCriar?.([...criados]);
      }
      return r;
    }
  };

  const desfazerSePreciso = async () => {
    if (o.aplicar) await rollback(criados, o.chamarRollback, o.log, dormir);
  };

  if (o.temaArquivo) o.log(`tema: usando ${o.temaArquivo}`);

  try {
    // ---------------------------------------------------------- preflight
    o.log('PREFLIGHT');
    const pre = await passo(passoPreflight(o.bp));
    if (!pre.preflightOk && !o.forcar) {
      o.log('ABORTADO no preflight (marque forcar para prosseguir).');
      return { status: 'abortado', criados };
    }

    o.log(`PROVISIONAMENTO ${o.aplicar ? '(REAL)' : '(dry-run)'}`);

    // ---------------------------------------------------------- fase 1: marca (erro aborta e desfaz)
    try {
      if (o.cancelado()) throw new Interrompido();
      const m = o.bp.marca;
      if (m && m.criar) {
        await passo({ tipo: 'brand', nome: m.nome, subdominio: m.subdominio });
        const hc = await passo({ tipo: 'hc_check' });
        if (hc.pausa) {
          await o.aguardarHelpCenter(hc.pausa.url);
          o.log('Continuando...');
        }
      }
      if (o.cancelado()) throw new Interrompido();
    } catch (e) {
      if (e instanceof ErroPasso) {
        o.log(`ERRO na criacao da marca/base: ${e.message}`);
        await desfazerSePreciso();
        o.log(`FALHA: ${e.message}`);
        return { status: 'erro', criados };
      }
      throw e;
    }

    // ---------------------------------------------------------- fase 2: módulos (falha em um NÃO derruba os demais)
    const falhas: string[] = [];
    for (const mod of modulos(o.bp, o.temaArquivo)) {
      if (o.cancelado()) throw new Interrompido();
      o.log(`== ${mod.nome} ==`);
      const fila: Passo[] = [...mod.passos];
      const views = { ok: 0, falha: 0, pulada: 0 };
      let membCriados = 0;
      let membRodou = false;
      try {
        while (fila.length) {
          const p = fila.shift()!;
          if (p.tipo === 'log') { o.log(p.msg); continue; }
          if (p.tipo === 'theme_poll') {
            // Python: até 30 consultas, 2s entre elas; depois segue para publicar mesmo assim
            let r = await passo(p);
            for (let i = 1; r.denovo && i < 30; i++) {
              await dormir(2000);
              r = await passo(p);
            }
            if (r.fimModulo) break;
            continue;
          }
          const r = await passo(p);
          if (r.view) views[r.view] += 1;
          if (r.membCriados !== undefined) membCriados += r.membCriados;
          if (p.tipo === 'memb_staff' && !r.fimModulo) {
            membRodou = true;
            const n = lotesMembership(ctx.staff || [], Object.values(ctx.groups));
            for (let i = 0; i < n; i++) fila.push({ tipo: 'memb_batch', lote: i });
          }
          if (r.fimModulo) break;
        }
        if (mod.aoFinal === 'views') o.log(`views: ${views.ok} criadas, ${views.falha} rejeitadas, ${views.pulada} puladas`);
        if (mod.aoFinal === 'memberships' && membRodou) {
          o.log(`membership: ${membCriados} vinculos criados (default=false; grupo principal intacto)`);
        }
      } catch (e) {
        if (!(e instanceof ErroPasso)) throw e;
        falhas.push(mod.nome);
        o.log(`ETAPA '${mod.nome}' FALHOU (seguindo; NADA foi desfeito): ${e.message}`);
      }
    }

    if (falhas.length) {
      o.log(`CONCLUIDO COM AVISOS. Etapas com falha: ${falhas.join(', ')}. `
        + `${criados.length} recursos mantidos - use 'Desfazer tudo' se quiser reverter.`);
    } else o.log(`OK: ${criados.length} recursos criados`);
    o.log(`CONCLUIDO. ${criados.length} recursos.`);
    return { status: 'ok', criados };
  } catch (e) {
    if (e instanceof Interrompido) {
      o.log('INTERROMPIDO pelo usuario; desfazendo o que ja foi criado...');
      await desfazerSePreciso();
      o.log('INTERROMPIDO: execucao cancelada e desfeita.');
      return { status: 'cancelado', criados };
    }
    if (e instanceof ErroPasso) {
      // erro no preflight
      o.log(`FALHA: ${e.message}`);
      return { status: 'erro', criados };
    }
    throw e;
  }
}
