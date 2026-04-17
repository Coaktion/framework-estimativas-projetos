from sqlmodel import Session, select
from models import engine, Package, Variable

def seed_new_requirements():
    with Session(engine) as session:
        # Categorized items based on user input
        new_pkgs = [
            # Zendesk Support
            Package(name="Configurações gerais do Support", hours=2.0, category="Zendesk Support", skill="Implantação"),
            Package(name="Configurações de Segurança (Auth, 2FA, IP)", hours=4.0, category="Zendesk Support", skill="Implantação"),
            Package(name="Aparência (Cor, Nome, Favicon)", hours=1.0, category="Zendesk Support", skill="Implantação"),
            Package(name="Localização (Fuso, Idioma)", hours=1.0, category="Zendesk Support", skill="Implantação"),
            Package(name="Eventos de perfil de usuário", hours=2.0, category="Zendesk Support", skill="Implantação"),
            Package(name="Configuração de usuários finais", hours=2.0, category="Zendesk Support", skill="Implantação"),
            Package(name="Banir IPs", hours=1.0, category="Zendesk Support", skill="Implantação"),
            Package(name="Conexão de páginas Facebook", hours=2.0, category="Zendesk Support", skill="Implantação"),
            Package(name="Conexão de páginas X", hours=2.0, category="Zendesk Support", skill="Implantação"),
            Package(name="Customização do Cartão de usuário", hours=2.0, category="Zendesk Support", skill="Implantação"),
            Package(name="Interface do agente", hours=2.0, category="Zendesk Support", skill="Implantação"),
            Package(name="Painel de Contexto", hours=2.0, category="Zendesk Support", skill="Implantação"),
            Package(name="Configuração de conversas paralelas", hours=3.0, category="Zendesk Support", skill="Implantação"),
            Package(name="Solicitações de aprovação (approvals)", hours=4.0, category="Zendesk Support", skill="Implantação"),
            Package(name="Configurações de ticket", hours=2.0, category="Zendesk Support", skill="Implantação"),
            Package(name="Criação de chaves API", hours=1.0, category="Zendesk Support", skill="Implantação"),
            Package(name="Single Sign-On (SAML / JWT / OpenID)", hours=8.0, category="Zendesk Support", skill="Desenvolvimento"),
            Package(name="Programações de exclusão de dados", hours=2.0, category="Zendesk Support", skill="Implantação"),
            Package(name="Marcas", hours=2.0, category="Zendesk Support", skill="Implantação"),
            Package(name="Membros de equipe (incl. Agentes Light)", hours=2.0, category="Zendesk Support", skill="Implantação"),
            Package(name="Funções e Grupos", hours=3.0, category="Zendesk Support", skill="Implantação"),
            Package(name="Campos do usuário/organização", hours=3.0, category="Zendesk Support", skill="Implantação"),
            Package(name="Importação de usuários/organizações", hours=4.0, category="Zendesk Support", skill="Implantação"),

            # Canais - Ticket
            Package(name="Canal: Email (Configuração Geral)", hours=2.0, category="Canais - Ticket", skill="Implantação"),
            Package(name="Canal: Email (Template HTML)", hours=4.0, category="Canais - Ticket", skill="Design"),
            Package(name="Canal: Formulário", hours=2.0, category="Canais - Ticket", skill="Implantação"),
            Package(name="Canal: Microsoft Teams", hours=3.0, category="Canais - Ticket", skill="Implantação"),

            # Canais - Messaging
            Package(name="Messaging: Web Widget", hours=4.0, category="Canais - Messaging", skill="Implantação"),
            Package(name="Messaging: Facebook Messenger", hours=2.0, category="Canais - Messaging", skill="Implantação"),
            Package(name="Messaging: Instagram Direct", hours=2.0, category="Canais - Messaging", skill="Implantação"),
            Package(name="Messaging: Android/iOS/Unity SDK", hours=8.0, category="Canais - Messaging", skill="Desenvolvimento"),
            Package(name="Messaging: WhatsApp/LINE/Telegram", hours=2.0, category="Canais - Messaging", skill="Implantação"),
            Package(name="Messaging: Apple Messages for Business", hours=4.0, category="Canais - Messaging", skill="Implantação"),
            Package(name="Messaging: Google Business Messages", hours=4.0, category="Canais - Messaging", skill="Implantação"),

            # Canais - Voz
            Package(name="Voz: Zendesk Talk (Config Gerais)", hours=4.0, category="Canais - Voz", skill="Implantação"),
            Package(name="Voz: IVR (Menus e Níveis)", hours=6.0, category="Canais - Voz", skill="Implantação"),
            Package(name="Voz: Linhas e Saudações", hours=2.0, category="Canais - Voz", skill="Implantação"),

            # Automação e Regras
            Package(name="Gatilhos Simples (Sem Webhook)", hours=1.0, category="Automação", skill="Implantação"),
            Package(name="Gatilhos Complexos (Mensagens/Lógica)", hours=3.0, category="Automação", skill="Implantação"),
            Package(name="Gatilhos com Webhook (Interno/Externo)", hours=5.0, category="Automação", skill="Desenvolvimento"),
            Package(name="Automações", hours=2.0, category="Automação", skill="Implantação"),
            Package(name="Políticas de SLA", hours=3.0, category="Automação", skill="Implantação"),
            Package(name="Encaminhamento Omnichannel e Filas", hours=4.0, category="Automação", skill="Implantação"),

            # IA e Advanced
            Package(name="AI Agents Essential (por bot)", hours=8.0, category="IA & Advanced", skill="Solution Design"),
            Package(name="AI Agents Advanced", hours=16.0, category="IA & Advanced", skill="Solution Design"),
            Package(name="Zendesk Copilot", hours=8.0, category="IA & Advanced", skill="Solution Design"),

            # Integrações Nativas
            Package(name="Integração: Salesforce", hours=8.0, category="Integrações Nativas", skill="Desenvolvimento"),
            Package(name="Integração: Jira", hours=6.0, category="Integrações Nativas", skill="Desenvolvimento"),
            Package(name="Integração: Shopify", hours=6.0, category="Integrações Nativas", skill="Desenvolvimento"),
            Package(name="Integração: Slack/Teams", hours=4.0, category="Integrações Nativas", skill="Implantação"),

            # Asset Management
            Package(name="Asset: Sincronização Intune/Jamf", hours=8.0, category="Asset Management", skill="Desenvolvimento"),
            Package(name="Asset: Tipos e Campos de Ativo", hours=4.0, category="Asset Management", skill="Implantação"),
        ]

        for pkg in new_pkgs:
            # Check if exists by name to avoid duplicates
            existing = session.exec(select(Package).where(Package.name == pkg.name)).first()
            if not existing:
                session.add(pkg)
        
        session.commit()
        print("Novos requisitos semeados com sucesso!")

if __name__ == "__main__":
    seed_new_requirements()