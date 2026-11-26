> Politica vigente de exclusao e novos cadastros: [docs/autenticacao/ciclo-de-vida-da-conta.md](docs/autenticacao/ciclo-de-vida-da-conta.md). Relatos antigos de bloqueio/reassociacao de contas historicas foram substituidos.

> Endere?os locais e comandos atualizados: [docs/desenvolvimento/enderecos-locais.md](docs/desenvolvimento/enderecos-locais.md). Exemplos antigos com 127.0.0.1 ou porta 3000 n?o s?o mais os endere?os p?blicos oficiais.

# SIDPB — autenticação e autorização com Keycloak

## Arquivos desta etapa

Arquivos novos principais: `backend/src/main/resources/db/migration/V004__KeycloakIdentity.sql`,
`backend/src/main/java/com/nca/sistema_miiase_app/config/SecurityConfig.java`,
`backend/src/main/java/com/nca/sistema_miiase_app/service/auth/KeycloakGateway.java`,
`backend/src/main/java/com/nca/sistema_miiase_app/controller/AdminUsersController.java`,
`backend/src/main/java/com/nca/sistema_miiase_app/controller/AdminExceptionHandler.java`,
`frontend/src/server/auth/{config,store,session,guard}.ts`,
`frontend/src/app/api/auth/[action]/route.ts`,
`frontend/src/app/api/bff/[...path]/route.ts`, layouts protegidos em
`frontend/src/app/{admin,curador,usuario,conta}/layout.tsx`,
`frontend/src/modules/auth/components/AdminUsers.tsx`,
`infra/keycloak/{configure-auth.mjs,configure-local.mjs,realm-auth-settings.json,link-legacy-user.sql}`
e este guia. Também foram acrescentados
`backend/src/test/java/com/nca/sistema_miiase_app/service/auth/IdentityIntegrationTest.java`,
`frontend/tests/{auth-store.test.cjs,keycloak-auth.e2e.mjs}`.

Arquivos alterados: `backend/pom.xml`, `backend/src/main/resources/application.properties`,
`backend/src/main/java/com/nca/sistema_miiase_app/{controller/AuthController.java,controller/SubmissionController.java,controller/CurationController.java,domain/entity/Usuario.java,service/auth/AuthService.java,service/curation/CurationService.java,service/submission/SubmissionService.java,dto/curation/ApproveRequestDto.java,dto/curation/RejectRequestDto.java,dto/submission/SubmissionRequestDto.java}`,
`docker-compose.yaml`, `.env.example`, `frontend/.env.example`,
`frontend/{Dockerfile,.dockerignore,package.json,package-lock.json}`,
`frontend/src/{app/admin/page.tsx,app/providers.tsx,modules/auth/auth.permissions.ts,modules/auth/components/AccountSettings.tsx,modules/auth/hooks/useAuth.ts,modules/auth/services/auth.service.ts,modules/auth/store/authStore.ts,modules/curation/services/curation.service.ts,modules/submissions/services/submissions.service.ts,sections/login-wall/LoginWallCard.tsx,services/apiClient.ts}`
e testes afetados. `frontend/src/modules/auth/services/auth.persistence.ts` foi
removido. O `.env` local e `frontend/.env.local` receberam segredos novos,
continuam ignorados pelo Git e não foram sobrescritos. Os arquivos da etapa 1
permanecem no projeto; apenas o guia inicial recebeu uma referência a este.

## Estado e arquitetura

A autenticação usa Keycloak 26.8.1 no realm `sidpb`. O navegador inicia Authorization
Code com PKCE S256 e state/nonce. Login, cadastro, recuperação e Google passam pelo
Keycloak. O SIDPB não recebe senhas. O pacote `openid-client` 6.8.8 implementa as
verificações OIDC e a troca de código; os Route Handlers do Next.js 16 cuidam da
sessão. Esta escolha segue as recomendações oficiais de
[Next.js](https://nextjs.org/docs/app/guides/authentication),
[openid-client](https://github.com/panva/openid-client) e
[Spring Security](https://docs.spring.io/spring-security/reference/servlet/oauth2/resource-server/jwt.html).

O servidor Next.js guarda access, refresh e ID tokens em arquivos AES-256-GCM no
volume `auth_sessions`. O cookie contém apenas um identificador opaco, com
`HttpOnly`, `SameSite=Lax`, caminho `/sidpb/` e `Secure` sob HTTPS. Cada sessão
tem limite absoluto de oito horas. Refresh tokens são rotacionados e as
requisições concorrentes são serializadas por sessão. Logout remove a sessão
local, tenta revogar o refresh token e redireciona ao endpoint de logout OIDC.
A API/BFF exige `Origin` exata em POST/PUT/PATCH/DELETE; state e PKCE protegem o
callback. O frontend antigo armazenava perfis em `localStorage`; esses dados
agora são ignorados e removidos. Tokens não são expostos ao JavaScript do navegador.

O BFF encaminha chamadas privadas para a API com Bearer token no servidor. A API
valida assinatura JWT pelo JWKS, issuer, audiência `sidpb-api`, expiração, `nbf`,
`iat`, e-mail verificado e sessão ativa por introspecção no Keycloak. Falha no
serviço de identidade bloqueia o acesso privado. `realm_access.roles` é mapeado
explicitamente para authorities; ADMIN inclui CURATOR e USER, CURATOR inclui USER.
O dashboard, mapa e ocorrências seguem públicos. A API retorna 401 sem token
válido e 403 com token válido sem a role necessária. O frontend não é a camada
de segurança das operações de negócio.

Esta configuração de sessões com arquivos é adequada a **uma instância** Next.js
com volume persistente. Para múltiplas réplicas, use um armazenamento de sessão
compartilhado com locks distribuídos antes de escalar. Um bloqueio de sessão
remanescente após queda abrupta pode exigir manutenção do diretório de sessões
com o processo parado. Não remova o volume do PostgreSQL.

## URLs e clientes

O issuer canônico é sempre `http://localhost:8081/realms/sidpb` no ambiente
local. Navegador e API comparam exatamente esse valor. Dentro dos containers,
somente as chamadas HTTP de servidor ao Keycloak usam `http://keycloak:8080`.
O BFF usa `http://api:8080` internamente. O `openid-client` reescreve apenas o
transporte de saída e mantém issuer, redirect e URLs públicas canônicas.

Clientes configurados por `infra/keycloak/configure-auth.mjs`:

| Cliente | Uso | Redirects/Post logout locais | Credencial |
| --- | --- | --- | --- |
| `sidpb-web` | Code + PKCE S256; público para o navegador, cliente OIDC confidencial no BFF | `http://localhost:3000/sidpb/api/auth/callback/`, `http://127.0.0.1:7080/sidpb/api/auth/callback/`; saída nas raízes `/sidpb/` | `KEYCLOAK_WEB_SECRET` somente no Next.js |
| `sidpb-api` | Audiência e introspecção | Nenhum | `KEYCLOAK_API_SECRET` somente no Spring |
| `sidpb-admin-service` | `client_credentials` para Admin REST | Nenhum | `KEYCLOAK_SERVICE_SECRET` somente no Spring |

Não há redirect amplo, password grant ou Web Origin liberada para clientes
privados. O cliente web inclui `sidpb-api` em `aud` e as roles efetivas em
`realm_access.roles`. O cliente de serviço recebe apenas `manage-users`,
`query-users` e `view-realm` de `realm-management`; no código, somente as
operações de usuário descritas abaixo são expostas. Os segredos permanecem
fora do Git. Ao portar para homologação ou produção, use origens e redirect
URIs exatos do ambiente via `AUTH_REDIRECT_ORIGINS`, `NEXT_PUBLIC_BASE_PATH`,
`AUTH_ORIGIN`, `KEYCLOAK_ISSUER` e `KEYCLOAK_INTERNAL_URL`. Use HTTPS fora do
ambiente local e remova `AUTH_ALLOW_HTTP=true`.

`localhost:3000` e `127.0.0.1:7080` são origens distintas: cookies e sessões
não são compartilhados entre elas. Entre novamente ao alternar. Para Docker,
acesse exatamente **http://127.0.0.1:7080/sidpb/**. Para Next.js local, acesse
**http://localhost:3000/sidpb/**. O painel fica em
**http://localhost:8081/admin/**.

## Configuração reproduzível do realm

O arquivo `infra/keycloak/realm-auth-settings.json` registra os ajustes
não sensíveis de login/cadastro e rotatividade de refresh token. O script
`infra/keycloak/configure-auth.mjs` usa Admin REST para criar ou atualizar
roles USER/CURATOR/ADMIN, composites ADMIN→CURATOR→USER, USER como default,
clientes, audiência e mappers. Ele é incremental; não importa nem substitui o
realm atual, não apaga usuários e não altera Google nem SMTP. O
`sidpb-realm.json` inicial só é usado ao criar um realm novo. Execute o script
de configuração após o primeiro start desse realm em cada ambiente.

Neste ambiente local, `node infra/keycloak/configure-local.mjs` obtém a sessão
administrativa pelo navegador com Authorization Code; ele não usa password grant.
Lê o `.env` ignorado pelo Git, cria segredos aleatórios se faltarem e aplica a
configuração. Reexecutar mantém usuários e identidades. Para inspecionar as
opções não sensíveis: `node infra/keycloak/configure-local.mjs --inspect`.
Em outros ambientes, obtenha um access token de operador por login OIDC e
execute `node infra/keycloak/configure-auth.mjs` com `KC_ADMIN_TOKEN` apenas
no processo; passe URLs e segredos do ambiente pelas variáveis. Não coloque
esse token em arquivos ou logs.

Google IdP e SMTP dependem das configurações do próprio ambiente. O script os
preserva no realm existente. O tema de login `sidpb` está versionado em
`infra/keycloak/themes/sidpb`; consulte `docs/autenticacao/tema-de-login.md` para montagem,
ativação, desenvolvimento e rollback. Para criar um
ambiente novo, configure o alias Google como `google`, registro, verificação de
e-mail e SMTP pelo painel/segredos do ambiente, sem versionar Client Secret,
senha SMTP ou credenciais de operador.

## Variáveis e execução

O `.env.example` da raiz inclui as cinco variáveis novas da etapa 3:
`KEYCLOAK_ISSUER`, `KEYCLOAK_WEB_SECRET`, `KEYCLOAK_API_SECRET`,
`KEYCLOAK_SERVICE_SECRET` e `AUTH_SESSION_KEY`. A última deve ser 32 bytes
aleatórios codificados em base64; trocá-la invalida as sessões locais.
Credenciais de cliente são diferentes entre si. Para Next.js local, copie
esses dois últimos valores aplicáveis (`KEYCLOAK_WEB_SECRET` e
`AUTH_SESSION_KEY`) para `frontend/.env.local`, junto às URLs do exemplo
`frontend/.env.example`. Não sobrescreva os valores já existentes do arquivo.

Na raiz do repositório, com o banco e Keycloak ativos:

```powershell
docker compose config --quiet
docker compose build api frontend
docker compose up -d --no-deps api frontend
docker compose ps
```

O primeiro start da API aplica a migration Flyway V004. O frontend usa o volume
`auth_sessions`; reiniciar containers conserva sessões. Para Next.js local:

```powershell
cd frontend
npm.cmd ci
npm.cmd run dev
```

O projeto usa `npm.cmd` em PowerShell quando a política local bloqueia `npm.ps1`.
Não rode Docker frontend e o dev server na mesma porta. A API Spring continua
em 8080 e o Keycloak em 8081.

## Contas antigas e operações de negócio

V004 adiciona `public.usuario.keycloak_id` único e preserva IDs, submissões,
avaliações e chaves estrangeiras. Desativa as senhas temporárias da aplicação
(`password_hash=NULL` e CHECK de nulidade); Keycloak passa a ser a única fonte
de credenciais. Um novo login verificado cria ou atualiza por `sub` com um upsert
atômico. Alterar nome ou e-mail no Keycloak mantém o mesmo ID local. A role na
tabela é apenas cache de exibição; a API usa exclusivamente a role do token
validado.

O ciclo de identidade agora segue [docs/autenticacao/ciclo-de-vida-da-conta.md](docs/autenticacao/ciclo-de-vida-da-conta.md).
Um novo subject sempre recebe uma identidade local nova, mesmo com e-mail anteriormente usado.
O bloqueio 409/legacy e o procedimento de reassociacao foram removidos.
O script link-legacy-user.sql esta desativado e nao deve ser usado.

Submissão, leitura própria e PDFs usam a identidade autenticada; IDs antigos
na URL são conferidos e IDs enviados no corpo de POST são ignorados. Uma
tentativa de consultar outro usuário retorna 403. CURATOR e ADMIN podem
avaliar, com o curador registrado pelo ID local ligado ao `sub`. A avaliação
de uma submissão do próprio curador retorna 403. Essa regra foi adotada por
segurança porque o fluxo anterior não tinha uma decisão explícita de negócio;
se a equipe permitir autoavaliação, formalize a regra antes de mudar o código.

Administração permite busca paginada, atualização de nome/e-mail, ativação,
desativação e atribuição de USER/CURATOR/ADMIN. O serviço nunca disponibiliza
credenciais administrativas ao navegador. Um administrador não pode mudar a
própria role nem desativar sua própria conta pela interface. Mudança de e-mail
marca a conta como não verificada. Mudanças de perfil e estado encerram as
sessões da pessoa no Keycloak, e cada requisição privada usa introspecção,
impedindo acesso com tokens antigos. A interface exibe permissões efetivas
e diretas. Contas de serviço não são administráveis por essa interface.

## Testes e limites da validação

Automatizados no ambiente local em 21–22/10/2026:

- Backend: 84 testes passando em PostgreSQL/PostGIS temporário separado, além
  do novo teste de autoavaliação que também passou. Cobrem permissões USER/CURATOR/ADMIN,
  assinatura/issuer/audience/expiração e verificação de e-mail, ausência de
  password login, concorrência no primeiro login, conflito de e-mail legado,
  IDs forjados e manutenção de vínculo após mudança de perfil.
- Frontend: typecheck, build Next.js, testes de criptografia/integridade/
  expiração e serialização de sessões.
- Integração real: navegador com usuários temporários no Keycloak confirmou
  login, recarga da página, roles compostas no JWT, audiência/issuer, rejeição
  de token adulterado, mapa público, bloqueio de visitante, submissão, curadoria,
  administração, revogação ao mudar role/desativar, logout, sessão preservada
  após reiniciar apenas API e frontend, e renovação após
  o limite do access token com 12 requisições simultâneas. As contas de teste
  foram desativadas depois. Foram criadas submissões de teste identificáveis
  como `OIDC integration test`; não removemos dados do banco existente.
- O código original (`git archive HEAD`) reproduziu exatamente 11 falhas no
  teste `map-user-location-and-filters.test.cjs`; elas não foram introduzidas
  pela autenticação. O mapa público foi verificado via API/navegador.

Para repetir os testes de integração local depois de configurar o ambiente:

```powershell
cd backend
$env:TEST_DB_URL='jdbc:postgresql://localhost:55432/sidpb_test'
$env:TEST_DB_USERNAME='postgres'
$env:TEST_DB_PASSWORD='sidpb_test_only'
.\mvnw.cmd test
cd ..\frontend
npm.cmd run typecheck
npm.cmd run test:auth
npm.cmd run test:auth:e2e
```

Crie um banco **temporário separado** para `TEST_DB_URL` ou use uma instância
dedicada de testes; jamais aponte os testes ao `sidpb_db` populado. Para
testar persistência após restart, use `AUTH_TEST_RESTART=true` ao rodar o E2E;
para testar renovação real, `AUTH_TEST_EXTENDED=true`. No PowerShell, defina
essas variáveis com `$env:AUTH_TEST_RESTART='true'` e
`$env:AUTH_TEST_EXTENDED='true'`. Rode `node infra/keycloak/configure-local.mjs
--disable-test-fixtures` na raiz para desativar fixtures antigas sem apagar
usuários. A auditoria npm não pôde ser concluída nesta máquina porque o
endpoint de advisories do registry expirou por timeout; repita `npm.cmd audit`
quando a rede estiver disponível.

Ainda exigem validação externa com contas e caixa postal autorizadas: fluxo
Google completo/primeiro acesso e consentimento, entrega SMTP, cadastro
end-to-end e clique no link de verificação/recuperação. O fluxo OIDC do SIDPB
já encaminha esses caminhos ao Keycloak, mas não enviamos mensagens de teste
para contas reais nem modificamos Google Cloud. O tema visual do Keycloak e a
reassociação de contas antigas não fazem parte do fluxo vigente.
