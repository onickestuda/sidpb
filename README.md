# SIDPB — Sistema de Informação de Doenças Parasitárias do Brasil

Plataforma web para pesquisar, curar e visualizar no mapa a ocorrência de doenças
parasitárias no Brasil, a partir de artigos científicos. A primeira versão cobre a
miíase primária causada por *Cochliomyia hominivorax*, com base na revisão do
prof. dr. Lívio Costa (UFMA).

- **Mapa público**: ocorrências georreferenciadas, filtros, busca e painel de detalhes.
- **Submissões**: usuários com conta enviam artigos (PDF ou link) para curadoria.
- **Curadoria**: curadores aprovam ou reprovam submissões, com histórico.
- **Administração**: gestão de usuários e papéis (`USER`, `CURATOR`, `ADMIN`).

## Tecnologias

| Camada | Stack |
|---|---|
| Frontend | Next.js 16, React 19, TypeScript, Zustand, TanStack Query, React-Leaflet, Tailwind |
| Backend | Spring Boot 4, Java 21, JPA + Hibernate Spatial, Flyway |
| Banco | PostgreSQL 15 + PostGIS 3.4 |
| Autenticação | Keycloak 26 (OIDC, Authorization Code + PKCE, sessão no servidor Next/BFF) |

## Estrutura

```
.
├── docker-compose.yaml     # todos os serviços (db, api, frontend, keycloak, cargas)
├── .env.example            # modelo único de configuração (copie para .env)
├── backend/                # API Spring Boot
│   └── src/main/
│       ├── java/…/         # config, controller, domain, dto, mapper, service
│       └── resources/      # application.properties e migrations Flyway
├── frontend/               # aplicação Next.js
│   ├── src/
│   │   ├── app/            # rotas (páginas, BFF em api/)
│   │   ├── components/     # ui/ (base shadcn) e layout/
│   │   ├── entities/       # tipos e mapeadores de domínio compartilhados
│   │   ├── lib/            # cliente HTTP, configuração e utilitários
│   │   ├── modules/        # funcionalidades: auth, curation, dashboard, map, …
│   │   └── server/auth/    # sessão OIDC no servidor
│   └── tests/              # testes unitários e e2e
├── infra/
│   ├── database/
│   │   ├── ibge/           # carga da base geográfica (shapefiles não versionados)
│   │   └── seed/           # dados de teste de miíase
│   └── keycloak/           # realm, tema de login e scripts de configuração
└── docs/                   # documentação (ver abaixo)
```

## Como rodar localmente

Pré-requisito: Docker Desktop.

```bash
cp .env.example .env                       # preencha senhas e segredos
docker compose --profile auth up -d        # banco, Keycloak, API e frontend
```

- Aplicação: http://localhost:7080/sidpb/
- API: http://localhost:8080
- Painel do Keycloak: http://localhost:8081/admin/

Na primeira vez, com o banco vazio:

```bash
docker compose --profile base_geografica run --rm base_geografica   # regiões, UFs e municípios (IBGE)
docker compose --profile seed run --rm seed_miiase                   # ocorrências de teste
```

Veja [infra/database/README.md](infra/database/README.md) para obter os shapefiles do IBGE.

### Desenvolvimento sem Docker para o app

Com `db` e `keycloak` rodando no Docker:

```bash
cd backend && ./mvnw spring-boot:run      # lê ../.env
cd frontend && npm ci && npm run dev      # lê ../.env
```

### Testes

```bash
cd backend && ./mvnw test                 # testes de integração exigem PostgreSQL local
cd frontend && npm run typecheck && npm run test:auth
```

## Documentação

| Assunto | Arquivo |
|---|---|
| Autenticação e Keycloak (visão geral) | [docs/autenticacao/integracao-keycloak.md](docs/autenticacao/integracao-keycloak.md) |
| Configurar o Keycloak local | [docs/autenticacao/keycloak-configuracao-local.md](docs/autenticacao/keycloak-configuracao-local.md) |
| Tema da tela de login | [docs/autenticacao/tema-de-login.md](docs/autenticacao/tema-de-login.md) |
| Identidade única (e-mail + Google) | [docs/autenticacao/identidade-unica.md](docs/autenticacao/identidade-unica.md) |
| Exclusão e ciclo de vida de contas | [docs/autenticacao/ciclo-de-vida-da-conta.md](docs/autenticacao/ciclo-de-vida-da-conta.md) |
| Administração de usuários e pré-login | [docs/autenticacao/administracao-e-prelogin.md](docs/autenticacao/administracao-e-prelogin.md) |
| Submissão e curadoria de artigos | [docs/curadoria-e-submissoes.md](docs/curadoria-e-submissoes.md) |
| Endereços e variáveis do ambiente local | [docs/desenvolvimento/enderecos-locais.md](docs/desenvolvimento/enderecos-locais.md) |
| Ativação local (registro de 12/11/2026) | [docs/desenvolvimento/ativacao-local.md](docs/desenvolvimento/ativacao-local.md) |
| Design system | [docs/design-system.md](docs/design-system.md) |
| Diagramas C4 e do banco | [docs/diagramas/](docs/diagramas/) |

## Fluxo de branches e versões

Funcionalidades partem de `dev` e seguem `dev → hm → deploy`. O projeto usa
[SemVer](https://semver.org/lang/pt-BR/) na série `0.y.z` até a primeira versão estável.
