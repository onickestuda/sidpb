> Atualizacao operacional em 12/11/2026: ambiente local ativado. Consulte [LOCAL_ACTIVATION.md](LOCAL_ACTIVATION.md) para migrations, backup e resultados atuais. Os bloqueios e pendencias descritos abaixo pertencem a etapa anterior.

# Endere?os do desenvolvimento local

A fonte ? o `.env` da raiz, com modelo em `.env.example`. Preserve suas credenciais atuais; n?o sobrescreva o arquivo inteiro com o exemplo. Para outro ambiente, forne?a as mesmas vari?veis com os valores daquele ambiente. Vari?veis expl?citas do processo t?m preced?ncia nos processos Node; Compose l? seu ambiente e o arquivo escolhido por `--env-file`.

| Vari?vel | Desenvolvimento local | Consumo |
|---|---|---|
| `AUTH_ORIGIN` | `http://localhost:7080` | Origem permitida, redirects e CORS |
| `NEXT_PUBLIC_BASE_PATH` | `/sidpb` | Next, assets, BFF, callback e caminho dos cookies |
| `API_PUBLIC_URL` | `http://localhost:8080` | API acessada pelo navegador/host |
| `KEYCLOAK_PUBLIC_URL` | `http://localhost:8081` | Hostname p?blico e origem do issuer |
| `AUTH_ALLOW_HTTP` | `true` | Opt-in HTTP exclusivamente no desenvolvimento local |

Origens sem barra final. SIDPB abre em `http://localhost:7080/sidpb/`. O issuer ? derivado como `${KEYCLOAK_PUBLIC_URL}/realms/sidpb`; n?o mantenha outra c?pia no `.env`. O realm continua `sidpb`.

Compose deriva `KEYCLOAK_ISSUER` e `NEXT_PUBLIC_API_URL`. No host, `next.config.mjs` l? o `.env` raiz e faz a mesma deriva??o; Spring, executado de `backend/`, importa `../.env`. Remova defini??es antigas de URLs de `frontend/.env.local` e de vari?veis exportadas no terminal. Segredos continuam apenas no servidor. `frontend/.env.local` n?o precisa duplicar os segredos do arquivo raiz.

Dentro dos containers, `INTERNAL_API_URL=http://api:8080` e `KEYCLOAK_INTERNAL_URL=http://keycloak:8080` s?o transportes internos. No host, s?o derivados das URLs p?blicas. Nomes Docker nunca v?o para callbacks, navegador ou claims JWT. Os bindings num?ricos/healthchecks em `127.0.0.1` s?o endere?os de escuta internos, n?o URLs p?blicas.

O Keycloak mant?m `KC_HOSTNAME_STRICT=true` e `KC_HOSTNAME_BACKCHANNEL_DYNAMIC=false`: discovery anuncia endpoints p?blicos est?veis. O BFF valida que cada endpoint pertence ? origem p?blica antes de reescrever apenas o transporte para Docker. Spring busca JWKS/introspec??o pelo endere?o interno e mant?m valida??o de assinatura, issuer p?blico, audience e demais claims. N?o se desabilitou valida??o do issuer. Refer?ncia: https://www.keycloak.org/server/hostname

Callback exato: `${AUTH_ORIGIN}${NEXT_PUBLIC_BASE_PATH}/api/auth/callback/`. Logout exato: `${AUTH_ORIGIN}${NEXT_PUBLIC_BASE_PATH}/`. Sem wildcards. O cliente BFF mant?m `webOrigins=[]`, pois a troca de tokens ocorre no servidor. CORS da API aceita apenas `AUTH_ORIGIN`. Cookies continuam HttpOnly, SameSite=Lax, sem Domain, caminho do basePath e Secure quando a origem ? HTTPS. POST exige Origin exata e rejeita Sec-Fetch-Site cross-site. PKCE/state/nonce permanecem ativos.

## Aplica??o local, quando desejada

Nenhum push ou deploy foi executado. Os containers em execu??o n?o foram substitu?dos. Para atualizar somente as URLs do cliente j? existente, usando credenciais administrativas v?lidas no `.env`:

```powershell
node infra/keycloak/configure-local.mjs --urls-only
```

Esse modo exige `sidpb-web` existente e preserva realm, usu?rios, roles, SMTP, Google, segredos, IDs e hist?rico. N?o use reimporta??o/reset do realm para atualizar URLs. O modo geral de configura??o tem escopo maior e n?o ? necess?rio para esta mudan?a.

Reconstru??es necess?rias para ativar o c?digo nos containers locais (comandos documentados, n?o executados):

```powershell
docker compose --profile auth build frontend api
docker compose --profile auth up -d --no-deps keycloak api frontend
```

`NEXT_PUBLIC_*` e basePath entram no build; s? reiniciar a imagem antiga n?o basta. N?o execute `down -v`, n?o recrie o banco e n?o execute seed. O comando acima seleciona somente os tr?s servi?os e preserva os volumes existentes. As portas publicadas do Compose permanecem 7080/8081/8080.

No host: `cd frontend; npm.cmd run dev` deriva a porta de `AUTH_ORIGIN`. Libere a porta 7080 antes de iniciar um segundo frontend. No container, `npm start` continua ouvindo na porta interna 3000.

## Valida??o realizada

- `docker compose config --quiet`: passou.
- Frontend: typecheck, build e dois testes de armazenamento/sess?es passaram.
- Backend: compila??o e `AuthServiceTest` passaram, incluindo valida??es de claims.
- Processo Next tempor?rio na porta 17080, com URLs p?blicas oficiais preservadas: quatro a??es OIDC geraram 303 com callback correto, PKCE/state/nonce; cookie HttpOnly/SameSite/path/host-only; logout retornou 200 com URL p?blica correta; origens inv?lidas/ausentes/cross-site foram rejeitadas.
- Navegador: bot?o do mapa passou. E-mail, Google, cadastro e recupera??o chegaram ao Keycloak, que rejeitou `redirect_uri` ainda n?o cadastrado.
- Container frontend antigo: a??es com Origin `localhost:7080` retornam 403, confirmando que ainda executa a configura??o anterior.
- Tentativa de atualiza??o incremental das URLs n?o alterou o cliente: Keycloak rejeitou o login administrativo do `.env` com `Invalid username or password`. ? necess?rio corrigir as credenciais localmente. N?o houve redefini??o de senha nem altera??o de contas.
- Login completo, cadastro com confirma??o de e-mail, recupera??o por SMTP e encerramento de sess?o autenticada ainda n?o est?o validados. Google consent e entrega de e-mails tamb?m exigem os servi?os externos configurados. N?o confundir gera??o do redirect de logout com encerramento comprovado de uma sess?o autenticada.

Regress?o sem muta??es de contas/dados:

```powershell
cd frontend
npm.cmd run test:auth:urls
```

Para testar um build isolado mantendo os endere?os p?blicos oficiais, `SIDPB_TEST_TRANSPORT=http://localhost:17080` faz o teste transportar as requisi??es para esse processo; callbacks/origens no navegador continuam oficiais. O teste falha explicitamente enquanto o Keycloak rejeitar o callback. Os testes existentes `test:auth:e2e` e `test:auth:theme` agora usam a fonte central por padr?o; o primeiro cria fixtures e deve ser executado em ambiente de teste apropriado.
