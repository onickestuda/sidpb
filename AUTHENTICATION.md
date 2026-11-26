# Autenticação provisória do SIDPB

O login continua validando e-mail/senha no backend/banco por `POST /api/auth/login`.
A refatoração separa essa fonte de autenticação do cache/estado de UI no Zustand.
O dashboard continua público e compartilhado em `/dashboard`.

## Migration e banco

`backend/src/main/resources/db/migration/V002__CreateUsers.sql` cria `usuario`.
A migration e as anteriores permanecem intactas nesta refatoração. A localização
Flyway continua `classpath:db/migration`.

| Coluna | Tipo/regras |
| --- | --- |
| `id_usuario` | INTEGER, identity, chave primária; segue `id_doenca`, `id_ocorrencia` etc. |
| `nome` | VARCHAR(200), obrigatório |
| `email` | VARCHAR(320), obrigatório, único, minúsculo e sem espaços externos |
| `password_hash` | VARCHAR(255), obrigatório; texto simples **provisório** |
| `role` | VARCHAR(20), obrigatório; CHECK ADMIN/CURATOR/USER |
| `ativo` | BOOLEAN, obrigatório, default TRUE |
| `created_at` | TIMESTAMPTZ, obrigatório, default CURRENT_TIMESTAMP |

Os três usuários são inseridos na própria V002, uma vez pelo Flyway. O INSERT usa
`ON CONFLICT (email) DO NOTHING`, sem duplicar usuários nem sobrescrever alterações.
Os IDs são gerados pelo banco e não são hardcoded no frontend.

| Perfil | Nome | E-mail | Senha de desenvolvimento | Rota |
| --- | --- | --- | --- | --- |
| ADMIN | Administrador | admin@sidpb.local | admin123 | /admin |
| CURATOR | Curador | curador@sidpb.local | curador123 | /curador |
| USER | Usuário | usuario@sidpb.local | usuario123 | /usuario |

Todos começam ativos. O enum Java `UsuarioRole` e o tipo TypeScript `UserRole`
representam os mesmos três valores.

## Endpoint e contrato

`POST /api/auth/login`, com `Content-Type: application/json`:

```json
{"email":"admin@sidpb.local","password":"admin123"}
```

Resposta HTTP 200:

```json
{"id":1,"name":"Administrador","email":"admin@sidpb.local","role":"ADMIN"}
```

O ID acima é um exemplo. Não há token, cookie, senha ou hash na resposta. O
controller usa Bean Validation, e `AuthService` centraliza consulta, normalização
de e-mail e comparação provisória. A senha não é normalizada ou aparada.
Usuário inativo é rejeitado depois de conferir a senha.

Os erros retornam apenas `{"message":"..."}`:

| HTTP | Situação | Mensagem |
| --- | --- | --- |
| 400 | E-mail/senha ausentes ou inválidos, limites excedidos, JSON malformado | Informe um e-mail válido e uma senha não vazia. |
| 401 | Usuário inexistente ou senha incorreta | E-mail ou senha inválidos. |
| 403 | Usuário inativo com senha correta | Usuário inativo. |
| 500 | Falha inesperada | Não foi possível realizar o login. Tente novamente. |

Os erros não incluem valores rejeitados nem informações internas. O frontend
traduz os status 400/401/403 e apresenta uma mensagem de indisponibilidade para
falhas de rede/backend. A senha é limpa assim que o submit começa, inclusive em erro.

## API consumida pelo frontend

`useAuth()` retorna `{ user, isAuthenticated, isInitializing, login, logout,
refreshSession }`. Login wall, guards, perfis, submissões, curadoria e menus usam
esse hook; somente a implementação do hook conhece o store.

`authService` expõe:

- `login(email, password)`: mantém a chamada existente, normaliza o `AuthUser`,
  grava apenas seus quatro campos e devolve o usuário para atualizar a UI.
- `getCurrentUser()`: lê a persistência provisória pelo adaptador isolado e retorna
  `AuthUser | null`. Não faz nova validação de identidade no banco nesta fase.
- `logout()`: remove a persistência provisória; nenhum endpoint novo foi criado.

`AuthBootstrap`, em `app/providers.tsx`, chama `refreshSession()` após a montagem,
dentro do QueryClientProvider. Não há Context de autenticação adicional.
`isInitializing` começa em `true`, inclusive no HTML renderizado no servidor,
e termina após a restauração. Guards aguardam esse estado; o mapa público pode
renderizar enquanto o menu aguarda. Bootstraps concorrentes compartilham uma
consulta, e respostas antigas não restauram uma sessão após login/logout recentes.

## Persistência e logout

**Persistência provisória de frontend. Será substituída por recuperação de sessão
no backend.** O adaptador `auth.persistence.ts`, acessado somente pelo serviço,
usa a chave `sidpb-auth-user` em localStorage. O JSON contém exclusivamente
`id`, `name`, `email` e `role`; `isAuthenticated` é derivado da presença do usuário.
Senha, password_hash, tokens e campos extras da resposta não entram no storage
nem no store. A senha do formulário é transitória e limpa ao enviar o login.

O store não usa `persist`: permanece somente cache de UI, evitando que a
hidratação automática do Zustand se torne uma segunda fonte de autenticação.
O projeto já usa `persist` para filtros; essa persistência não foi alterada.
JSON inválido ou usuário com formato/role inválidos são descartados. Se o browser
bloquear o storage, login/navegação funcionam em memória; refresh exige login.
Não existe expiração nem validação da conta no servidor durante a restauração.

Todos os botões de saída usam `useAuth().logout()`. A função limpa o estado,
remove a persistência pelo serviço, cancela consultas de submissão/curadoria,
remove seus caches e redireciona para `/`, o login wall. Refresh após sair
continua anônimo.

## Permissões, guards e navegação

`can(user, permission)` e `canAccessProfile(user, role)` centralizam as regras:

| Perfil | Permissões de UI | Área | Ação no menu |
| --- | --- | --- | --- |
| USER | submission.create, submission.viewOwn | /usuario | Minhas submissões |
| CURATOR | curation.view, curation.review | /curador | Curadoria |
| ADMIN | admin.access | /admin | Administração |

ADMIN não herda permissões de USER/CURATOR. O guard aguarda a inicialização,
permite o perfil correspondente, manda anônimos para `/` e manda o perfil
incorreto para sua própria área. A mesma regra vale para os detalhes protegidos.

`AuthUserMenu` reutiliza Button/DropdownMenu e aparece no DashboardHeader e no
AppHeader existente. Oferece o nome, **Minha área**, a ação do perfil e **Sair**.
Após a inicialização, anônimos veem apenas a navegação pública atual. A busca,
filtros e mapa permanecem compartilhados, sem rotas de dashboard por perfil.
O login wall também oferece **Voltar para minha área** quando há usuário restaurado.
Links/router continuam usando o basePath do Next sem concatená-lo manualmente.

**Permissões controlam UI; guards controlam UX. localStorage e Zustand não são
segurança.** O backend ainda não protege endpoints nem comprova o ator informado
pelo frontend. `userId`/`curatorId` nas submissões/decisões continuam provisórios.
Nenhum Spring Security, JWT, cookie HttpOnly, CSRF ou autorização real foi adicionado.

## Substituição futura

1. Trocar `getCurrentUser()` pela chamada a `GET /api/auth/me` com a sessão validada
   pelo backend. Remover o adaptador de persistência local, conservando a
   normalização do contrato `AuthUser` no serviço.
2. Ajustar `login()` para o mecanismo seguro e remover a gravação local. Depois
   do login, o serviço pode recuperar a identidade por `/api/auth/me`.
3. Implementar `logout()` com `POST /api/auth/logout` e configurar o transporte
   da sessão no cliente HTTP conforme o contrato real.
4. Ajustar o bootstrap/tratamento de sessão expirada se necessário, mantendo o
   contrato de `useAuth` e o estado de inicialização.
5. Validar identidade e role no servidor, proteger endpoints/PDFs e derivar os
   atores da sessão, substituindo IDs fornecidos pelo cliente.

Dashboard, menus, guards e telas continuam consumindo o mesmo hook e as mesmas
permissões de UI. A proteção real do backend será trabalho separado.

## Como testar

Para executar o frontend atualizado, em `frontend`: `npm.cmd run dev`.
Abra `http://localhost:3000/sidpb/`. As contas abaixo são seeds de desenvolvimento:

| Perfil | E-mail | Senha provisória |
| --- | --- | --- |
| USER | usuario@sidpb.local | usuario123 |
| CURATOR | curador@sidpb.local | curador123 |
| ADMIN | admin@sidpb.local | admin123 |

Para cada conta: entre, use **Ir para o mapa**, atualize a página, abra **Menu do
usuário**, volte por **Minha área** ou pela ação do perfil e confira sua identidade.
USER tentando `/curador` deve voltar para `/usuario`; ADMIN tentando `/usuario`
deve voltar para `/admin`. **Sair** em qualquer área deve voltar ao login wall;
após refresh, acessar uma área protegida exige login. **Acessar o mapa** permanece
disponível para visitantes. No ambiente Docker, reconstrua o serviço `frontend`
para refletir os fontes atualizados em `http://localhost:7080/sidpb/`.

O teste `frontend/tests/auth-session.e2e.cjs` usa o Playwright disponível
externamente, sem novas dependências no projeto. Execute em `frontend`, com a API
e o frontend rodando e as seeds disponíveis:

```powershell
# Se Playwright não estiver no caminho de módulos, indique sua instalação externa.
$env:SIDPB_PLAYWRIGHT_MODULE = 'C:\caminho\node_modules\playwright'
$env:AUTH_TEST_FRONTEND_URL = 'http://localhost:3000/sidpb'
node tests/auth-session.e2e.cjs
```

O navegador padrão é Chrome; `AUTH_TEST_BROWSER_CHANNEL` permite escolher outro
canal instalado. Os testes não criam/alteram submissões ou decisões.

Validação executada nesta refatoração:

- `npx.cmd tsc --noEmit --incremental false`: passou (checagem separada, pois o
  next.config existente ignora erros de tipos no build).
- `npm.cmd run build`: passou, preservando as rotas existentes.
- Chrome headless/Playwright, build de produção local e API real/PostgreSQL:
  login dos três perfis, mapa, persistência no refresh, menus por permissão,
  retorno ao perfil, refresh direto da área protegida, perfil incorreto, logout
  pelo mapa/painel, logout seguido de refresh, guard anônimo e mapa público.
- Senha incorreta, senha limpa após envio, storage inválido descartado, campos
  extras de resposta excluídos e login/logout com storage bloqueado: passaram.

## Testes do backend existente

A refatoração atual não altera o backend. Sua implementação anterior foi validada
com 57 testes sem falhas, Flyway V001/V002 e respostas de login sem Set-Cookie;
essa suíte não foi repetida nesta alteração restrita ao frontend.

Os testes backend exigem PostgreSQL/PostGIS dedicado. Para repetir a suíte, use
uma base separada da aplicação; os testes existentes esperam transações de teste:

```powershell
docker run --detach --name sidpb_auth_test_db --publish 127.0.0.1:55432:5432 --env POSTGRES_USER=postgres --env POSTGRES_PASSWORD=postgres --env POSTGRES_DB=parasitologia_test postgis/postgis:15-3.4-alpine
# Aguarde o banco estar pronto.
cd backend
$env:TEST_DB_URL = 'jdbc:postgresql://127.0.0.1:55432/parasitologia_test'
.\mvnw.cmd package
cd ..
docker rm --force sidpb_auth_test_db
```

Para outro banco, configure também `TEST_DB_USERNAME` e `TEST_DB_PASSWORD`.

## Arquivos desta refatoração

Criados:

- `frontend/src/modules/auth/auth.permissions.ts`
- `frontend/src/modules/auth/hooks/useAuth.ts`
- `frontend/src/modules/auth/services/auth.persistence.ts`
- `frontend/src/modules/auth/components/AuthUserMenu.tsx`
- `frontend/tests/auth-session.e2e.cjs`

Modificados:

- `AUTHENTICATION.md` (documentação existente atualizada)
- `frontend/src/modules/auth/store/authStore.ts`
- `frontend/src/modules/auth/services/auth.service.ts`
- `frontend/src/modules/auth/components/RoleGuard.tsx`
- `frontend/src/modules/auth/components/ProfilePanel.tsx`
- `frontend/src/modules/auth/components/ProfileLayout.tsx`
- `frontend/src/sections/login-wall/LoginWallCard.tsx`
- `frontend/src/app/providers.tsx`
- `frontend/src/components/layout/AppHeader/index.tsx`
- `frontend/src/modules/dashboard/components/DashboardMiddle/DashboardHeader.tsx`
- `frontend/src/modules/submissions/components/UserSubmissions.tsx`
- `frontend/src/modules/submissions/components/UserSubmissionDetail.tsx`
- `frontend/src/modules/submissions/components/SubmissionForm.tsx`
- `frontend/src/modules/curation/components/CurationReview.tsx`

Alterações de backend, Docker, API client e páginas de curadoria/submissão que já
estavam no workspace foram preservadas; não fazem parte desta refatoração.
