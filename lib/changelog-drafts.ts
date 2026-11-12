/**
 * Rascunhos do changelog escritos junto com o código.
 *
 * Toda mudança de código acrescenta aqui um rascunho (pt, en, es) descrevendo
 * as novidades, melhorias e correções. Ao abrir /changelog, um SE ou admin
 * importa os rascunhos novos como RASCUNHO — nada aqui é publicado sozinho:
 * alguém revisa, ajusta e publica pela tela. A `key` nunca muda (é ela que
 * impede importar o mesmo rascunho duas vezes); rascunho descartado na tela
 * não volta.
 */
import type { CodeChangelogDraft } from './changelog';

export const CODE_CHANGELOG_DRAFTS: CodeChangelogDraft[] = [
  {
    key: '2026-11-tool-center-v3',
    release: 'V3 · 2026-11',
    title: {
      pt: 'Prompt de escopo v3, atalhos configuráveis, relatos e changelog',
      en: 'Scope prompt v3, configurable shortcuts, reports and changelog',
      es: 'Prompt de alcance v3, atajos configurables, reportes y changelog',
    },
    summary: {
      pt: 'O "Copiar como prompt" ficou mais completo e sai no idioma da tela; os atalhos do editor viraram regras editáveis no Admin; a Calculadora AE gera estimativas; dá para excluir e restaurar estimativas; bugs e sugestões agora são enviados pelo próprio Tool Center.',
      en: '"Copy as prompt" is more complete and follows the screen language; editor shortcuts became rules you can edit in Admin; the AE Calculator can create estimates; estimates can be deleted and restored; bugs and suggestions are now sent from inside the Tool Center.',
      es: '"Copiar como prompt" es más completo y sale en el idioma de la pantalla; los atajos del editor se volvieron reglas editables en el Admin; la Calculadora AE genera estimaciones; las estimaciones se pueden eliminar y restaurar; los bugs y sugerencias ahora se envían desde el propio Tool Center.',
    },
    items: [
      {
        kind: 'new', feature: 'estimates',
        text: {
          pt: 'Copiar como prompt (v3): sai no idioma da tela (pt, en ou es) e traz canais, integrações, descrição de cada item, horas por fase, bases dos percentuais, outras versões, itens que não contam e as notas do Zoho (só como contexto interno).',
          en: 'Copy as prompt (v3): follows the screen language (pt, en or es) and includes channels, integrations, each item\'s description, hours by phase, percentage bases, other versions, items that do not count and Zoho notes (as internal context only).',
          es: 'Copiar como prompt (v3): sale en el idioma de la pantalla (pt, en o es) e incluye canales, integraciones, la descripción de cada ítem, horas por fase, bases de los porcentajes, otras versiones, ítems que no cuentan y las notas de Zoho (solo como contexto interno).',
        },
      },
      {
        kind: 'fixed', feature: 'estimates',
        text: {
          pt: 'As flags de supressão do prompt agora batem com os itens (Action Flow, integrações nativas, conversas paralelas, ITAM, CSAT...), e canais e integrações deixaram de sair vazios.',
          en: 'The prompt\'s suppression flags now match the items (Action Flow, native integrations, side conversations, ITAM, CSAT...), and channels and integrations are no longer empty.',
          es: 'Las flags de supresión del prompt ahora coinciden con los ítems (Action Flow, integraciones nativas, conversaciones paralelas, ITAM, CSAT...), y los canales e integraciones ya no salen vacíos.',
        },
      },
      {
        kind: 'new', feature: 'estimates',
        text: {
          pt: 'Botão na barra inferior para ocultar ou mostrar as linhas vazias (quantidade 0 ou em branco).',
          en: 'A button in the bottom bar hides or shows empty lines (quantity 0 or blank).',
          es: 'Botón en la barra inferior para ocultar o mostrar las líneas vacías (cantidad 0 o en blanco).',
        },
      },
      {
        kind: 'improved', feature: 'estimates',
        text: {
          pt: 'A identificação da versão pode ser editada a qualquer momento, sem criar versão nova.',
          en: 'The version identification can be edited at any time, without creating a new version.',
          es: 'La identificación de la versión se puede editar en cualquier momento, sin crear una versión nueva.',
        },
      },
      {
        kind: 'new', feature: 'admin',
        text: {
          pt: 'Atalhos configuráveis (Admin › Biblioteca › Atalhos): crie, renomeie e desative atalhos e escolha os itens que cada um preenche, com condições por módulo, item, subcategoria, tipo de projeto, plano e SKU (combinadas com E e OU).',
          en: 'Configurable shortcuts (Admin › Library › Shortcuts): create, rename and deactivate shortcuts and choose the items each one fills in, with conditions on module, item, subcategory, project type, plan and SKU (combined with AND and OR).',
          es: 'Atajos configurables (Admin › Biblioteca › Atajos): crea, renombra y desactiva atajos y elige los ítems que cada uno completa, con condiciones por módulo, ítem, subcategoría, tipo de proyecto, plan y SKU (combinadas con Y y O).',
        },
      },
      {
        kind: 'new', feature: 'aeCalculator',
        text: {
          pt: 'Criar estimativa a partir da Calculadora AE (SE e admin): leva as quantidades para um projeto novo ou uma versão nova de um projeto existente.',
          en: 'Create an estimate from the AE Calculator (SE and admin): the quantities go into a new project or a new version of an existing one.',
          es: 'Crear estimación desde la Calculadora AE (SE y admin): las cantidades van a un proyecto nuevo o a una versión nueva de un proyecto existente.',
        },
      },
      {
        kind: 'improved', feature: 'aeCalculator',
        text: {
          pt: '"Intents" passou a se chamar "Tópicos", como na Zendesk, e os fatores de plano agora têm valores próprios para Customer Service e Employee Service.',
          en: '"Intents" is now "Topics", as in Zendesk, and plan factors now have separate values for Customer Service and Employee Service.',
          es: '"Intents" ahora se llama "Temas", como en Zendesk, y los factores de plan ahora tienen valores propios para Customer Service y Employee Service.',
        },
      },
      {
        kind: 'new', feature: 'estimates',
        text: {
          pt: 'Quem criou uma estimativa (ou um admin) pode excluí-la, inteira ou só uma versão, nas Estimativas e na Calculadora AE. Os admins veem e restauram tudo em Admin › Estimativas excluídas.',
          en: 'Whoever created an estimate (or an admin) can delete it, whole or just one version, in Estimates and the AE Calculator. Admins see and restore everything in Admin › Deleted estimates.',
          es: 'Quien creó una estimación (o un admin) puede eliminarla, completa o solo una versión, en Estimaciones y en la Calculadora AE. Los admins ven y restauran todo en Admin › Estimaciones eliminadas.',
        },
      },
      {
        kind: 'fixed', feature: 'booking',
        text: {
          pt: 'A regra de eventos tratados como espaço livre agora ignora maiúsculas, espaços extras e variações de emoji, inclusive em títulos só com emoji; e a tela de agendar não mostra mais os limites de duração nem a dica sobre a agenda de quem agenda.',
          en: 'The free-time events rule now ignores letter case, extra spaces and emoji variations, including emoji-only titles; the booking screen no longer shows the duration limits or the hint about the booker\'s calendar.',
          es: 'La regla de eventos tratados como tiempo libre ahora ignora mayúsculas, espacios extra y variaciones de emoji, incluso en títulos solo con emoji; la pantalla de agendar ya no muestra los límites de duración ni la sugerencia sobre la agenda de quien agenda.',
        },
      },
      {
        kind: 'new', feature: 'website',
        text: {
          pt: 'Bugs e sugestões agora são enviados por uma janela no próprio Tool Center (com anexos), e SE e admin acompanham em Relatos, com status.',
          en: 'Bugs and suggestions are now sent from a window inside the Tool Center (with attachments), and SEs and admins follow them up in Reports, with a status.',
          es: 'Los bugs y sugerencias ahora se envían desde una ventana en el propio Tool Center (con adjuntos), y los SE y admins los siguen en Reportes, con estado.',
        },
      },
      {
        kind: 'new', feature: 'changelog',
        text: {
          pt: 'Esta página: o changelog do Tool Center, com rascunhos revisados antes de publicar e o registro das alterações feitas no Admin.',
          en: 'This page: the Tool Center changelog, with drafts reviewed before publishing and a log of the changes made in Admin.',
          es: 'Esta página: el changelog del Tool Center, con borradores revisados antes de publicar y el registro de los cambios hechos en el Admin.',
        },
      },
    ],
  },
];
