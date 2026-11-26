> Atualizacao operacional em 12/11/2026: ambiente local ativado. Consulte [docs/desenvolvimento/ativacao-local.md](docs/desenvolvimento/ativacao-local.md) para migrations, backup e resultados atuais. Os bloqueios e pendencias descritos abaixo pertencem a etapa anterior.

# Endereços do desenvolvimento local

A fonte é o `.env` da raiz, com modelo em `.env.example`. Preserve suas credenciais atuais; não sobrescreva o arquivo inteiro com o exemplo. Para outro ambiente, forneça as mesmas variáveis com os valores daquele ambiente. Variáveis explícitas do processo têm precedência nos processos Node; Compose lê seu ambiente e o arquivo escolhido por `--env-file`.

| Variável | Desenvolvimento local | Consumo |
|---|---|---|
| `AUTH_ORIGIN` | `http://localhost:7080` | Origem permitida, redirects e CORS |
| `NEXT_PUBLIC_BASE_PATH` | `/sidpb` | Next, assets, BFF, callback e caminho dos cookies |
| `API_PUBLIC_URL` | `http://localhost:8080` | API acessada pelo navegador/host |
| `KEYCLOAK_PUBLIC_URL` | `http://localhost:8081` | Hostname público e origem do issuer |
| `AUTH_ALLOW_HTTP` | `true` | Opt-in HTTP exclusivamente no desenvolvimento local |

Origens sem barra final. SIDPB abre em `http://localhost:7080/sidpb/`. O issuer é derivado como `${KEYCLOAK_PUBLIC_URL}/realms/sidpb`; não mantenha outra cópia no `.env`. O realm continua `sidpb`.

Compose deriva `KEYCLOAK_ISSUER` e `NEXT_PUBLIC_API_URL`. No host, `next.config.mjs` lê o `.env` raiz e faz a mesma derivação; Spring, executado de `backend/`, importa `../.env`. Remova definições antigas de URLs de `frontend/.env.local` e de variáveis exportadas no terminal. Segredos continuam apenas no servidor. `frontend/.env.local` não precisa duplicar os segredos do arquivo raiz.

Dentro dos containers, `INTERNAL_API_URL=http://api:8080` e `KEYCLOAK_INTERNAL_URL=http://keycloak:8080` são transportes internos. No host, são derivados das URLs públicas. Nomes Docker nunca vão para callbacks, navegador ou claims JWT. Os bindings numéricos/healthchecks em `127.0.0.1` são endereços de escuta internos, não URLs públicas.

O Keycloak mantém `KC_HOSTNAME_STRICT=true` e `KC_HOSTNAME_BACKCHANNEL_DYNAMIC=false`: discovery anuncia endpoints públicos estáveis. O BFF valida que cada endpoint pertence à origem pública antes de reescrever apenas o transporte para Docker. Spring busca JWKS/introspecção pelo endereço interno e mantém validação de assinatura, issuer público, audience e demais claims. Não se desabilitou validação do issuer. Referência: https://www.keycloak.org/server/hostname

Callback exato: `${AUTH_ORIGIN}${NEXT_PUBLIC_BASE_PATH}/api/auth/callback/`. Logout exato: `${AUTH_ORIGIN}${NEXT_PUBLIC_BASE_PATH}/`. Sem wildcards. O cliente BFF mantém `webOrigins=[]`, pois a troca de tokens ocorre no servidor. CORS da API aceita apenas `AUTH_ORIGIN`. Cookies continuam HttpOnly, SameSite=Lax, sem Domain, caminho do basePath e Secure quando a origem é HTTPS. POST exige Origin exata e rejeita Sec-Fetch-Site cross-site. PKCE/state/nonce permanecem ativos.

## Aplicação local, quando desejada

Nenhum push ou deploy foi executado. Os containers em execução não foram substituídos. Para atualizar somente as URLs do cliente já existente, usando credenciais administrativas válidas no `.env`:

```powershell
node infra/keycloak/configure-local.mjs --urls-only
```

Esse modo exige `sidpb-web` existente e preserva realm, usuários, roles, SMTP, Google, segredos, IDs e histórico. Não use reimportação/reset do realm para atualizar URLs. O modo geral de configuração tem escopo maior e não é necessário para esta mudança.

Reconstruções necessárias para ativar o código nos containers locais (comandos documentados, não executados):

```powershell
docker compose --profile auth build frontend api
docker compose --profile auth up -d --no-deps keycloak api frontend
```

`NEXT_PUBLIC_*` e basePath entram no build; só reiniciar a imagem antiga não basta. Não execute `down -v`, não recrie o banco e não execute seed. O comando acima seleciona somente os três serviços e preserva os volumes existentes. As portas publicadas do Compose permanecem 7080/8081/8080.

No host: `cd frontend; npm.cmd run dev` deriva a porta de `AUTH_ORIGIN`. Libere a porta 7080 antes de iniciar um segundo frontend. No container, `npm start` continua ouvindo na porta interna 3000.

## Validação realizada

- `docker compose config --quiet`: passou.
- Frontend: typecheck, build e dois testes de armazenamento/sessões passaram.
- Backend: compilação e `AuthServiceTest` passaram, incluindo validações de claims.
- Processo Next temporário na porta 17080, com URLs públicas oficiais preservadas: quatro ações OIDC geraram 303 com callback correto, PKCE/state/nonce; cookie HttpOnly/SameSite/path/host-only; logout retornou 200 com URL pública correta; origens inválidas/ausentes/cross-site foram rejeitadas.
- Navegador: botão do mapa passou. E-mail, Google, cadastro e recuperação chegaram ao Keycloak, que rejeitou `redirect_uri` ainda não cadastrado.
- Container frontend antigo: ações com Origin `localhost:7080` retornam 403, confirmando que ainda executa a configuração anterior.
- Tentativa de atualização incremental das URLs não alterou o cliente: Keycloak rejeitou o login administrativo do `.env` com `Invalid username or password`. É necessário corrigir as credenciais localmente. Não houve redefinição de senha nem alteração de contas.
- Login completo, cadastro com confirmação de e-mail, recuperação por SMTP e encerramento de sessão autenticada ainda não estão validados. Google consent e entrega de e-mails também exigem os serviços externos configurados. Não confundir geração do redirect de logout com encerramento comprovado de uma sessão autenticada.

Regressão sem mutações de contas/dados:

```powershell
cd frontend
npm.cmd run test:auth:urls
```

Para testar um build isolado mantendo os endereços públicos oficiais, `SIDPB_TEST_TRANSPORT=http://localhost:17080` faz o teste transportar as requisições para esse processo; callbacks/origens no navegador continuam oficiais. O teste falha explicitamente enquanto o Keycloak rejeitar o callback. Os testes existentes `test:auth:e2e` e `test:auth:theme` agora usam a fonte central por padrão; o primeiro cria fixtures e deve ser executado em ambiente de teste apropriado.
