> Politica vigente de exclusao e novos cadastros: [docs/autenticacao/ciclo-de-vida-da-conta.md](docs/autenticacao/ciclo-de-vida-da-conta.md). Relatos antigos de bloqueio/reassociacao de contas historicas foram substituidos.

# Administração de usuários e pré-login — 9 de novembro de 2026

## 1. Resultado e arquitetura

Trabalho local na branch `feature/keycloak-auth`, sem push ou deploy. A área
`/sidpb/admin/usuarios/` usa o layout existente e as abas Usuários, Curadoria e
Histórico. Oferece busca por nome/e-mail, perfil e status, paginação no servidor,
detalhes, um seletor de perfil, confirmação das consequências e ativação de contas.
A curadoria mostra contagens reais de avaliações e um link para a área existente.

O caminho continua navegador → BFF Next.js → Spring Boot → Keycloak Admin REST.
O cliente de serviço existente `sidpb-api` continua responsável pela comunicação
administrativa; a aplicação não usa o administrador de bootstrap. Credenciais,
roles, provedores e habilitação pertencem ao Keycloak. A tabela `public.usuario`
mantém os IDs e vínculos históricos pelo `sub`; seu perfil é uma projeção de login,
não a fonte de autorização administrativa.

## 2. Arquivos desta entrega

| Área | Arquivos principais |
| --- | --- |
| Interface | `frontend/src/modules/auth/components/AdminUsers.tsx`, `AuthUserMenu.tsx`, `frontend/src/app/admin/page.tsx`, `admin/usuarios/page.tsx` |
| Administração | `backend/src/main/java/com/nca/sistema_miiase_app/controller/AdminUsersController.java`, `AdminExceptionHandler.java`, `service/auth/AdminUsersService.java`, `AdminAuditService.java` |
| Segurança e transporte | `config/SecurityConfig.java`, `service/auth/KeycloakGateway.java`, `backend/src/main/resources/application.properties` |
| Banco | `backend/src/main/resources/db/migration/V005__AdministrativeAudit.sql` |
| Entrada pública | `frontend/src/modules/login-wall/components/LoginWallCard.tsx`, `LoginWallPage.tsx`, `LoginWallMapBackground.tsx`; removido `LoginWallReadOnlyMap.tsx` |
| Recursos compartilhados | `frontend/public/auth/login-map.png`, `prelogin.css`, `frontend/scripts/sync-auth-assets.mjs`, `frontend/package.json`, `infra/keycloak/sync-theme-assets.mjs` |
| Tema | `infra/keycloak/themes/sidpb/login/theme.properties`, `resources/css/sidpb.css`, `resources/js/sidpb.js`, `resources/auth/*`; removidos Leaflet e pontos antes distribuídos pelo tema |
| Testes | `AuthControllerTest.java`, `AdminUsersIntegrationTest.java`, `infra/keycloak/test-admin-db.mjs`, `frontend/tests/keycloak-auth.e2e.mjs`, `keycloak-theme.e2e.mjs`, `run-admin-local.mjs` |

As demais alterações já existentes no workspace pertencem à integração anterior;
não foram descartadas. V004 e os fluxos de associação de identidade foram preservados.

## 3. Endpoints reaproveitados

O BFF genérico `/sidpb/api/bff/...` continua autenticando a sessão e verificando a
origem das mutações. O Spring valida o JWT e exige ADMIN em `/api/admin/**`.

| Endpoint Spring | Contrato atual |
| --- | --- |
| `GET /api/admin/users` | `first`, `max` (1–50), `search`, `profile`, `enabled`, `team`; retorna `{items,nextFirst}` |
| `PUT /api/admin/users/{id}/roles` | `{profile: "USER" ou "CURATOR" ou "ADMIN", confirmed: true}`; aceita também o formato anterior `roles`, limitado às três roles de negócio |
| `PUT /api/admin/users/{id}` | Edição existente de nome, sobrenome, e-mail e habilitação, com confirmação para desativar |

A listagem mudou de array para envelope paginado e seu consumidor foi atualizado.
Busca/status são enviados ao Keycloak. O filtro de perfil examina no máximo 60
candidatos por chamada; pode devolver uma página vazia com continuação. O cursor
avança apenas pelos candidatos examinados, sem carregar todo o realm. A paginação
por offset não representa um snapshot se outras contas forem alteradas durante a busca.

## 4. Endpoints adicionados

| Endpoint Spring | Função |
| --- | --- |
| `GET /api/admin/users/{id}` | Conta, data disponível, contagem de avaliações e nomes seguros dos métodos de acesso |
| `PUT /api/admin/users/{id}/status` | `{enabled: boolean, confirmed: true}` |
| `GET /api/admin/users/history` | Histórico, filtro opcional `target`, cursor `before` e limite `max` |

Objetos de credenciais e identificadores federados não são devolvidos ao navegador.
Contas de serviço não são gerenciadas nessa interface. Roles internas são mantidas;
somente atribuições diretas USER/CURATOR/ADMIN são ajustadas. Permissões herdadas
externamente podem impedir o resultado solicitado: nesse caso há erro e auditoria
do estado observado, sem simular sucesso.

## 5. Migration, auditoria e proteção administrativa

V005 cria apenas `public.admin_user_audit` e seu índice. Não altera ou apaga usuários,
submissões, avaliações ou vínculos. Registra ator/alvo por `sub`, nomes para leitura,
operação, estado anterior/posterior, data e resultado; não guarda tokens ou senhas.
Nesta validação V005 foi aplicada somente em bancos descartáveis. O banco principal
receberá a migration no próximo início normal da API atualizada.

O registro PENDING é confirmado em transação independente antes da chamada remota.
SUCCESS só é gravado após releitura e confirmação do resultado e logout no Keycloak.
Falhas ficam FAILED, PARTIAL ou UNKNOWN; uma interrupção abrupta pode deixar PENDING.
Não há transação distribuída entre PostgreSQL e Keycloak. Resultados pendentes ou
parciais exigem conferência do estado atual e nova operação pelo responsável técnico;
não devem ser convertidos manualmente em sucesso sem evidência.

Todas as alterações usam o mesmo advisory lock transacional PostgreSQL entre
instâncias da API. Depois de adquiri-lo, a API relê o ator no Keycloak e exige um
ADMIN habilitado. É proibido rebaixar ou desativar a própria conta. Assim, cada
redução deixa outro ADMIN ativo (o ator); duas reduções concorrentes não conseguem
remover os dois administradores. Alterações externas feitas pelo console técnico
não participam desse lock; a recuperação continua disponível pela identidade
técnica separada, sem criar outra role de negócio.

A API solicita logout das sessões do alvo e consulta a introspecção dos tokens.
Uma barreira adicional na auditoria rejeita tokens emitidos antes da conclusão da
operação, inclusive se o logout remoto falhar. Como `iat` tem precisão de segundos,
um login no mesmo segundo pode exigir nova tentativa. O banco indisponível não
libera acesso com permissões antigas.

## 6. Login wall e tema

A entrada apresenta “Acessar o mapa”, a indicação de acesso público, “Entre na sua
conta”, e-mail, Google e “Ainda não tem uma conta? Cadastre-se”. Somente Cadastre-se
é clicável na última linha; conserva o POST de início OIDC, com aparência e semântica
de link. Recuperação permanece no formulário nativo de senha do Keycloak.

O tema herda os templates oficiais, mantendo PKCE, required actions e verificações
de identidade. Logo, tipografia, cores, card, inputs e botões primários/secundários
continuam compartilhando a apresentação SIDPB. O script do tema só insere o fundo
e a atribuição; não intercepta senhas ou formulários. O Account Console continua
com sua apresentação nativa; ele não é uma página de pré-login do tema `login`.

## 7. Fundo estático: origem, distribuição e atualização

Fonte única: `frontend/public/auth/login-map.png` (1440 × 900). É uma captura de
um único viewport do mapa original, feita em 05/11/2026 com centro
`[-14.235,-51.925]`, zoom 4 e os pontos originais, sem o card ou controles.
Foi usado o carregamento normal da página, sem mosaicos em massa, scraping,
alteração de cabeçalhos ou contorno de bloqueios. A imagem é um trabalho produzido
a partir da cartografia OpenStreetMap; os créditos permanecem visíveis nas duas UIs.
Veja [copyright e atribuição OSM](https://www.openstreetmap.org/copyright),
[FAQ sobre screenshots](https://osmfoundation.org/wiki/Licence/Licence_and_Legal_FAQ)
e [política de tiles](https://operations.osmfoundation.org/policies/tiles/).

`prelogin.css` define o mesmo `center/cover`, escala 1.02, opacidade .9, blur 1px,
overlay e backdrop blur 2px. Em telas estreitas a imagem é recortada igualmente
nos dois serviços; o fundo não recalcula um mapa por viewport. O dashboard continua
interativo e não usa esse recurso como substituto de seu mapa.

Para atualizar, substitua apenas a imagem-fonte por uma captura autorizada e atualize
a proveniência acima. Execute na raiz:

```powershell
node infra/keycloak/sync-theme-assets.mjs
node infra/keycloak/sync-theme-assets.mjs --check
```

O script copia imagem, CSS e logo para `themes/sidpb/login/resources/`, gera hashes
SHA-256 em `auth/manifest.json` e não acessa rede. `--check` compara as cópias byte a
byte. Os hooks predev/prebuild do frontend sincronizam quando a pasta infra existe;
o build Docker do frontend usa os arquivos canônicos já incluídos no contexto.
Não edite manualmente as cópias geradas. O E2E também compara os bytes efetivamente
servidos por HTTP, propriedades CSS e ausência de solicitações de tiles.

## 8. Validação executada

- `npm.cmd run typecheck` e `npm.cmd run build`: aprovados. O build ainda informa
  o aviso preexistente de rastreamento dinâmico de arquivos em `server/auth/store.ts`.
- `npm.cmd run test:auth`: 2 testes de sessões aprovados; cópias dos recursos
  verificadas byte a byte por `sync-theme-assets.mjs --check`.
- Suite Java: 16 testes, zero falhas. PostgreSQL/PostGIS real e descartável;
  Keycloak simulado nessa suite. Inclui concorrência, último ADMIN, proteção própria,
  falha remota parcial, persistência da auditoria, roles internas, identidade e
  retorno HTTP para confirmação ausente/JSON malformado.
- E2E com Next.js compilado, Spring, Keycloak e PostGIS reais: acesso público,
  USER/CURATOR/ADMIN, ownership, submissão e avaliação, JWT adulterado, CSRF, PKCE,
  detalhes, promoções USER→CURATOR→ADMIN, rebaixamento, status, auditoria com ator,
  bloqueio de login desativado, invalidação de sessões antigas e logout aprovados.
  Também exercita paginação, filtros e contagem da avaliação recém-criada na curadoria.
- Tema automatizado: login, erro, abertura do cadastro e recuperação, teclado,
  desktop/mobile, igualdade do fundo servido e ausência de tiles. O teste dos
  botões secundários usa uma fixture CSS, não executa associação real de contas.
- Inspeção visual das capturas locais de administração e pré-login. Não equivale
  a uma validação manual completa de todos os fluxos de autenticação.

## 9. Limites e pendências

Consentimento Google, entrega SMTP, confirmação por caixa postal, cadastro completo,
redefinição por link recebido e associação real de contas precisam de validação
externa/manual. As telas secundárias herdam o tema, mas nem todas foram percorridas
com uma transação real. A concorrência do último ADMIN foi exercitada no teste com
Keycloak simulado, evitando modificar administradores reais do realm.

Os testes criam contas identificadas por `oidc-test-`, desativadas e desconectadas
ao final; não são apagadas. Os dados de negócio de teste ficam no banco descartável.
Não foi feita uma nova comparação completa do banco principal antes/depois nesta
etapa; os testes de identidade cobrem a preservação dos IDs e relacionamentos.

Durante o diagnóstico, o nível DEBUG herdado do cliente HTTP exibiu a credencial
de serviço em um log temporário. Esse arquivo foi removido e os loggers do cliente
HTTP foram limitados a WARN. Recomenda-se rotação coordenada do segredo de
`sidpb-api` no Keycloak e na configuração local; ela não foi executada automaticamente
para não interromper a integração existente. Nenhum valor é reproduzido aqui.

## 10. Passos de validação local

Pré-requisitos: dependências instaladas, Java/Maven, Node, Chromium do Playwright,
Docker e Keycloak local existente em 8081; `.env` preenchido sem expor seus valores.
Execute na raiz:

```powershell
node infra/keycloak/sync-theme-assets.mjs --check
npm.cmd --prefix frontend run typecheck
npm.cmd --prefix frontend run build
Push-Location backend
.\mvnw.cmd -DskipTests package
Pop-Location
node infra/keycloak/test-admin-db.mjs
node frontend/tests/run-admin-local.mjs
```

O último comando usa portas 3100, 8082 e 55434, cria banco descartável, adiciona
temporariamente apenas o callback/logout local de teste ao cliente existente e
remove essas adições ao terminar. Encerra somente os processos/contêiner criados
pelo próprio teste. Precisa das credenciais técnicas locais para preparar fixtures;
elas não são a identidade de serviço da aplicação.

Para revisar na instalação normal, inicie a API e o frontend atualizados pelo fluxo
local usual (a API aplica V005 via Flyway). Não é necessário recriar o realm ou o
banco. Entre com ADMIN operacional, abra `/sidpb/admin/usuarios/`, confira as três
abas e use uma conta de teste diferente da sua para alterar perfil/status. Confira
histórico, novo login e role no Keycloak. Abra o pré-login em desktop e celular e
compare login/cadastro/recuperação; no painel Network não deve haver tiles nessas
telas. Execute os fluxos externos pendentes com contas e caixas postais autorizadas.
