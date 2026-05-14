# PRE-SALES.AI | Smart Scoping Framework

Framework avançado para o time de pré-vendas (SC e AE), focado em padronização de escopo e estimativa de esforço técnico.

## 🛠️ Tecnologias e Diretrizes

Este projeto foi construído seguindo rigorosos padrões de engenharia de software para garantir escalabilidade e manutenibilidade.

### 📐 Princípios de Design
- **DRY (Don't Repeat Yourself)**: Lógica de cálculo e componentes de UI centralizados para evitar duplicidade.
- **YAGNI (You Ain't Gonna Need It)**: Implementação focada nas funcionalidades reais do time de pré-vendas, sem over-engineering.
- **SOLID (S e D)**:
  - **Single Responsibility Principle (S)**: Componentes e Server Actions com responsabilidades únicas e bem definidas.
  - **Dependency Inversion Principle (D)**: Uso de abstrações para acesso a dados (Prisma Client) e serviços de autenticação.
- **Clean Code**: Nomenclatura semântica, funções pequenas e código autoexplicativo.

### 🚀 Stack Técnica
- **Frontend**: Next.js 14 (App Router), Tailwind CSS, Lucide Icons.
- **Backend**: Next.js Server Actions, Prisma ORM.
- **Banco de Dados**: SQLite (Local) / PostgreSQL (Produção).
- **Autenticação**: NextAuth.js com Credentials Provider.
- **Internacionalização**: i18next para suporte multi-idioma.

### 🔧 Qualidade de Código
- **Linting & Formatting**: ESLint + Prettier configurados para manter a consistência do código.
- **Conventional Commits**: Padrão de mensagens de commit para histórico semântico e legível.
- **Metodologia**: Escrita de código baseada em Clean Code e componentização atômica.

## 📦 Instalação e Setup

1.  **Dependências**:
    ```bash
    npm install
    ```

2.  **Banco de Dados**:
    ```bash
    npx prisma db push
    npx prisma db seed
    ```

3.  **Ambiente**:
    - Renomeie `.env.example` para `.env`
    - Configure a `NEXTAUTH_SECRET`.

4.  **Desenvolvimento**:
    ```bash
    npm run dev
    ```

## 🔐 Estrutura de Acesso (RBAC)

O sistema utiliza um modelo de permissões baseado na flag `isAdmin` do banco de dados:

- **AE (Account Executive)**: Acesso ao Histórico Pessoal e Calculadora de Viabilidade.
- **SC (Solutions Consultant)**: Acesso aos Projetos Técnicos, Checklists de Escopo e Calculadora.
- **Admin**: Gestão total de usuários, pacotes do framework e configurações globais.

---

*Desenvolvido com foco na eficiência do time Aktie Now.*
