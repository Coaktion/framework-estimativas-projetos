/**
 * ============================================================================
 *  CRIADOR DE ESTRUTURA DE PASTAS DE CLIENTES  —  Aktie Now
 * ============================================================================
 *  Lê uma lista de clientes na planilha e cria, dentro de uma pasta pai,
 *  a estrutura padrão:
 *
 *      Nome do Cliente
 *        ├── 0 - SALES
 *        ├── 1 - PRESALES
 *        ├── 2 - DELIVERY
 *        └── 3 - CUSTOMER SUCCESS
 *
 *  É IDEMPOTENTE: se a pasta do cliente já existe, não recria — apenas
 *  cria as subpastas que estiverem faltando. Pode rodar quantas vezes quiser.
 *
 *  Funciona com Shared Drives (Drives Compartilhados) e com Meu Drive.
 *
 *  Também atende o Tool Center ("Criador de Pastas"): publicado como App da
 *  Web, recebe { token, cliente, regiao, solicitante } por POST, cria a
 *  estrutura na pasta pai da região e devolve o link. Ver doPost() no fim.
 * ============================================================================
 *
 *  >>> ÚNICA COISA QUE VOCÊ PRECISA CONFIGURAR: cole o ID da pasta pai abaixo. <<<
 *
 *  Como pegar o ID: abra a pasta pai no Google Drive e copie o trecho da URL
 *  depois de /folders/ .
 *  Ex.: https://drive.google.com/drive/folders/1AbCdEfGhIjKlMnOpQrStUvWxYz
 *                                              └──────────── ID ────────────┘
 */

// ============================ CONFIGURAÇÃO ============================

// Cole aqui o ID da pasta pai onde os clientes serão criados.
// (Pode deixar em branco e definir depois pelo menu: "Definir pasta pai".)
var PARENT_FOLDER_ID = "1VLLtpz6HJx9OOX9TQ6WnBLHhdrLSTJCr";

// Pasta pai de cada região, usada pelo Tool Center: a região escolhida na
// tela decide onde a pasta do cliente é criada. Aceita o ID ou a URL.
// Enquanto uma região estiver com o placeholder, os pedidos dela são recusados
// (nada é criado em outra pasta por engano).
var PLACEHOLDER_PASTA = "COLE_AQUI_O_ID_DA_PASTA";
var PASTAS_POR_REGIAO = {
  BRASIL:    "1VLLtpz6HJx9OOX9TQ6WnBLHhdrLSTJCr",
  AMER_EMEA: "12TvSiiplC1s9J0VqHcNpqlc9_6aNtF_X",
  SSAC:      "1YGw2hCkkQyleW0Ly_Ldq8Q9hZsszGD7p"
};

// Subpastas padrão criadas dentro de cada cliente. Edite se o padrão mudar.
var SUBPASTAS = [
  "0 - SALES",
  "1 - PRESALES",
  "2 - DELIVERY",
  "3 - CUSTOMER SUCCESS"
];

// Estrutura da planilha
var LINHA_CABECALHO = 1;   // linha do cabeçalho
var COL_CLIENTE     = 1;   // A = Nome do Cliente
var COL_STATUS      = 2;   // B = Status (preenchido pelo script)
var COL_LINK        = 3;   // C = Link da pasta (preenchido pelo script)

// Aba onde ficam registrados os pedidos feitos pelo Tool Center.
var ABA_LOG_TOOL_CENTER = "Log Tool Center";

// =====================================================================


/**
 * Cria o menu "Estrutura de Clientes" ao abrir a planilha.
 */
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu("📁 Estrutura de Clientes")
    .addItem("▶ Criar estrutura para todos os clientes", "criarEstruturas")
    .addSeparator()
    .addItem("⚙ Definir pasta pai (ID)", "definirPastaPai")
    .addItem("✔ Testar acesso à pasta pai", "testarPastaPai")
    .addToUi();
}


/**
 * Função principal: percorre a planilha e cria a estrutura de cada cliente.
 */
function criarEstruturas() {
  var ui = SpreadsheetApp.getUi();
  var parentId = getParentFolderId_();

  if (!parentId) {
    ui.alert("Pasta pai não definida",
      "Configure o ID da pasta pai primeiro:\n" +
      "Menu → Estrutura de Clientes → Definir pasta pai (ID).",
      ui.ButtonSet.OK);
    return;
  }

  var parent;
  try {
    parent = DriveApp.getFolderById(parentId);
  } catch (e) {
    ui.alert("Pasta pai inválida",
      "Não consegui acessar a pasta com esse ID.\n\n" +
      "Verifique se:\n" +
      "• o ID está correto;\n" +
      "• você tem permissão de edição nessa pasta/Drive.\n\n" +
      "Detalhe: " + e.message, ui.ButtonSet.OK);
    return;
  }

  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  var ultimaLinha = sheet.getLastRow();

  if (ultimaLinha <= LINHA_CABECALHO) {
    ui.alert("Nenhum cliente encontrado",
      "Adicione os nomes dos clientes na coluna A, a partir da linha " +
      (LINHA_CABECALHO + 1) + ".", ui.ButtonSet.OK);
    return;
  }

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var criados = 0, completados = 0, jaOk = 0, erros = 0;

  for (var linha = LINHA_CABECALHO + 1; linha <= ultimaLinha; linha++) {
    var nome = String(sheet.getRange(linha, COL_CLIENTE).getValue()).trim();
    if (!nome) continue; // pula linhas vazias

    ss.toast("Processando: " + nome, "Criando estrutura...", 5);

    try {
      var res = criarEstruturaCliente_(parent, nome);

      var statusTxt;
      if (res.pastaClienteCriada && res.subpastasCriadas === SUBPASTAS.length) {
        statusTxt = "✅ Criado";
        criados++;
      } else if (res.subpastasCriadas > 0 || res.pastaClienteCriada) {
        statusTxt = "🔧 Completado (" + res.subpastasCriadas + " subpasta(s) adicionada(s))";
        completados++;
      } else {
        statusTxt = "✔ Já existia (nada a fazer)";
        jaOk++;
      }

      sheet.getRange(linha, COL_STATUS).setValue(
        statusTxt + " — " + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "dd/MM/yyyy HH:mm"));
      sheet.getRange(linha, COL_LINK).setValue(res.url);

    } catch (e) {
      sheet.getRange(linha, COL_STATUS).setValue("❌ ERRO: " + e.message);
      erros++;
    }

    SpreadsheetApp.flush();
  }

  ui.alert("Concluído!",
    "Resumo:\n\n" +
    "✅ Criados do zero: " + criados + "\n" +
    "🔧 Completados (faltavam subpastas): " + completados + "\n" +
    "✔ Já estavam OK: " + jaOk + "\n" +
    "❌ Erros: " + erros + "\n\n" +
    "Confira a coluna Status para os detalhes.", ui.ButtonSet.OK);
}


/**
 * Cria (ou completa) a estrutura de um único cliente dentro da pasta pai.
 * Retorna { url, pastaClienteCriada, subpastasCriadas }.
 */
function criarEstruturaCliente_(parent, nome) {
  var pastaClienteCriada = false;

  var pastaCliente = pegarOuCriarSubpasta_(parent, nome);
  if (pastaCliente.criada) pastaClienteCriada = true;

  var subpastasCriadas = 0;
  for (var i = 0; i < SUBPASTAS.length; i++) {
    var r = pegarOuCriarSubpasta_(pastaCliente.folder, SUBPASTAS[i]);
    if (r.criada) subpastasCriadas++;
  }

  return {
    url: pastaCliente.folder.getUrl(),
    pastaClienteCriada: pastaClienteCriada,
    subpastasCriadas: subpastasCriadas
  };
}


/**
 * Procura uma subpasta pelo nome dentro de "pai".
 * Se existir, retorna a existente; se não, cria. (idempotente)
 * Retorna { folder, criada }.
 */
function pegarOuCriarSubpasta_(pai, nome) {
  var it = pai.getFoldersByName(nome);
  if (it.hasNext()) {
    return { folder: it.next(), criada: false };
  }
  return { folder: pai.createFolder(nome), criada: true };
}


/**
 * Retorna o ID da pasta pai: usa o salvo nas propriedades (via menu) ou a
 * constante PARENT_FOLDER_ID no topo do arquivo.
 */
function getParentFolderId_() {
  var salvo = PropertiesService.getDocumentProperties().getProperty("PARENT_FOLDER_ID");
  return (salvo && salvo.trim()) ? salvo.trim() : (PARENT_FOLDER_ID || "").trim();
}


/**
 * Permite definir/atualizar o ID da pasta pai sem editar o código.
 * O valor fica salvo na planilha (Document Properties).
 */
function definirPastaPai() {
  var ui = SpreadsheetApp.getUi();
  var atual = getParentFolderId_();
  var resp = ui.prompt(
    "Definir pasta pai",
    "Cole o ID (ou a URL) da pasta pai onde os clientes serão criados." +
    (atual ? "\n\nAtual: " + atual : ""),
    ui.ButtonSet.OK_CANCEL);

  if (resp.getSelectedButton() !== ui.Button.OK) return;

  var texto = resp.getResponseText().trim();
  if (!texto) return;

  // Se colaram a URL inteira, extrai o ID de /folders/<ID>
  var m = texto.match(/[-\w]{25,}/);
  var id = m ? m[0] : texto;

  PropertiesService.getDocumentProperties().setProperty("PARENT_FOLDER_ID", id);
  ui.alert("Pronto!", "Pasta pai definida:\n" + id, ui.ButtonSet.OK);
}


/**
 * Testa se o script consegue acessar a pasta pai configurada.
 */
function testarPastaPai() {
  var ui = SpreadsheetApp.getUi();
  var id = getParentFolderId_();
  if (!id) {
    ui.alert("Sem pasta pai", "Defina o ID da pasta pai primeiro.", ui.ButtonSet.OK);
    return;
  }
  try {
    var f = DriveApp.getFolderById(id);
    ui.alert("Acesso OK ✅",
      "Pasta pai: " + f.getName() + "\nURL: " + f.getUrl(), ui.ButtonSet.OK);
  } catch (e) {
    ui.alert("Falha no acesso ❌",
      "Não consegui abrir essa pasta.\nVerifique o ID e suas permissões.\n\n" +
      e.message, ui.ButtonSet.OK);
  }
}


// ======================= INTEGRAÇÃO COM O TOOL CENTER =======================
//
//  Como publicar (uma vez):
//   1. Configurações do projeto (engrenagem) → Propriedades do script →
//      adicione TOOL_CENTER_TOKEN com um valor secreto. O mesmo valor vai na
//      variável FOLDERS_SCRIPT_TOKEN do Tool Center.
//   2. Implantar → Nova implantação → tipo "App da Web":
//        Executar como: Eu (dono do script)
//        Quem pode acessar: Qualquer pessoa
//      Copie a URL (termina em /exec) para FOLDERS_SCRIPT_URL do Tool Center.
//   3. Ao mudar o código: Implantar → Gerenciar implantações → editar →
//      Versão "Nova versão". Assim a URL continua a mesma.
//
//  "Qualquer pessoa" só deixa a URL acessível: sem o token, o pedido é recusado.
// ===========================================================================

/**
 * Recebe o pedido do Tool Center e cria (ou completa) a estrutura do cliente.
 * Responde { ok, status: created|completed|existing, url, subpastasCriadas }
 * ou { ok: false, erro }.
 */
function doPost(e) {
  try {
    var body = JSON.parse((e && e.postData && e.postData.contents) || "{}");

    var esperado = PropertiesService.getScriptProperties().getProperty("TOOL_CENTER_TOKEN");
    if (!esperado || body.token !== esperado) return respostaJson_({ ok: false, erro: "token inválido" });

    var nome = String(body.cliente || "").replace(/\s+/g, " ").trim();
    if (!nome || nome.length > 120) return respostaJson_({ ok: false, erro: "nome do cliente inválido" });

    var regiao = String(body.regiao || "");
    if (!PASTAS_POR_REGIAO.hasOwnProperty(regiao)) return respostaJson_({ ok: false, erro: "região inválida" });

    var configurada = String(PASTAS_POR_REGIAO[regiao] || "").trim();
    if (!configurada || configurada === PLACEHOLDER_PASTA) {
      return respostaJson_({ ok: false, erro: "a pasta pai da região " + regiao + " ainda não foi configurada no script" });
    }
    var parentId = extrairId_(configurada);

    // Dois pedidos simultâneos para o mesmo cliente criariam pastas duplicadas.
    var lock = LockService.getScriptLock();
    lock.waitLock(20000);
    var res;
    try {
      res = criarEstruturaCliente_(DriveApp.getFolderById(parentId), nome);
    } finally {
      lock.releaseLock();
    }

    var status = res.pastaClienteCriada ? "created" : (res.subpastasCriadas > 0 ? "completed" : "existing");
    registrarLog_(nome, regiao, String(body.solicitante || ""), status, res.url);

    return respostaJson_({ ok: true, status: status, url: res.url, subpastasCriadas: res.subpastasCriadas });
  } catch (err) {
    return respostaJson_({ ok: false, erro: err.message });
  }
}

function respostaJson_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

/** Aceita o ID puro ou a URL da pasta. */
function extrairId_(texto) {
  var t = String(texto || "").trim();
  if (!t) return "";
  var m = t.match(/[-\w]{25,}/);
  return m ? m[0] : t;
}

/** Anota o pedido numa aba da planilha. Falha aqui não impede a criação. */
function registrarLog_(cliente, regiao, solicitante, status, url) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    if (!ss) return;
    var aba = ss.getSheetByName(ABA_LOG_TOOL_CENTER);
    if (!aba) {
      aba = ss.insertSheet(ABA_LOG_TOOL_CENTER);
      aba.appendRow(["Data", "Cliente", "Região", "Solicitante", "Resultado", "Link"]);
    }
    aba.appendRow([new Date(), cliente, regiao, solicitante, status, url]);
  } catch (e) {
    console.warn("Log do Tool Center falhou: " + e.message);
  }
}
