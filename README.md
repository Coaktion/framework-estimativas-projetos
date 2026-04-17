# Pre-Sales WebApp (Python Version)

Framework para o time de pré-vendas construído com FastAPI, SQLModel e Jinja2.

## Requisitos
- Python 3.9+
- Pip

## Instalação

1.  Crie um ambiente virtual:
    ```bash
    python -m venv venv
    ```

2.  Ative o ambiente virtual:
    - Windows: `venv\Scripts\activate`
    - Linux/Mac: `source venv/bin/activate`

3.  Instale as dependências:
    ```bash
    pip install -r requirements.txt
    ```

4.  Configure as variáveis de ambiente:
    - Copie `.env.example` para `.env`
    - Preencha suas credenciais do Google SSO.

## Execução
Opção 1 (via módulo):
```bash
python -m uvicorn main:app --reload
```

Opção 2 (direta):
```bash
python main.py
```

Acesse `http://localhost:8000`.

## Funcionalidades
- **Admin**: Gestão de pacotes, variáveis e savestates (rollback).
- **SC + Implantação**: Checklist de escopo e cálculo de horas.
- **AE**: Verificação de viabilidade de pacotes baseada em horas e categoria.
- **SSO Google**: Autenticação integrada.
- **Exportação**: Exportar pacotes para CSV.
- **Planilhas**: Salvar conteúdo de planilhas CSV diretamente no sistema.

## Escopo de Serviços Suportados

### Zendesk Support
- Configurações gerais e de segurança (2FA, Restrição IP, etc.)
- Aparência, Localização e Eventos de perfil
- Conexão de redes sociais (Facebook, X)
- Interface do agente, Painel de Contexto e Conversas Paralelas
- Single Sign-On (SAML / JWT / OpenID)
- Gestão de Marcas, Funções, Grupos e Membros de Equipe
- Campos de Usuário e Organização, Importação de dados

### Canais
- **Ticket**: Email, Formulário, Facebook, X, Microsoft Teams
- **Messaging**: Web Widget, Facebook Messenger, Instagram, Android, iOS, Unity, LINE, Apple Messages, Slack, WeChat, Google RCS, KakaoTalk, Telegram
- **Voz**: Zendesk Talk, CallWe, Integrações Marketplace

### Funcionalidades Avançadas
- **AI Agents**: Essential e Advanced (Droz, etc.)
- **Workspace**: Macros, Conteúdo Dinâmico, Layouts, Objetos Personalizados
- **Roteamento**: Omnichannel, Filas, Regras de Capacidade
- **Automação**: Gatilhos (Simples/Complexos), Webhooks, Metas de Mensagens
- **Marketplace**: Integração com lista infinita de aplicativos (Nome, Link, Horas)
- **Integrações Nativas**: Salesforce, Shopify, Slack, Workday, Google Agenda, Jira, MS 365 Copilot
- **Asset Management**: Sincronização nativa (Intune/Jamf), Tipos de ativos, Registros

### Módulos Adicionais
- Knowledge, Analytics, Copilot, QA, WFM, Solution Design, ADPP.
