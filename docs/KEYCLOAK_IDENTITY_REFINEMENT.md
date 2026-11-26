> Politica vigente de exclusao e novos cadastros: [ACCOUNT_LIFECYCLE.md](ACCOUNT_LIFECYCLE.md). Relatos antigos de bloqueio/reassociacao de contas historicas foram substituidos.

> Endere?os locais e comandos atualizados: [LOCAL_DEVELOPMENT_URLS.md](LOCAL_DEVELOPMENT_URLS.md). Exemplos antigos com 127.0.0.1 ou porta 3000 n?o s?o mais os endere?os p?blicos oficiais.

# Identidade única e tema — 5 de novembro de 2026

Atualização de 09/11: administração e fundo estático estão descritos em
[Administração e pré-login](ADMINISTRATION_AND_PRELOGIN.md). As evidências abaixo
referem-se à etapa de identidade; consulte o novo documento para a entrega atual.

Trabalho local em `feature/keycloak-auth`, sem push ou deploy. Alterações anteriores
do workspace foram preservadas. O fluxo incremental foi aplicado ao Keycloak local.

## Fluxos

`configure-identity.mjs` copia uma vez o First Broker Login nativo para
`sidpb-first-broker-login`. Desativa somente Review Profile e Confirm Link Existing
Account. Mantém Create User If Unique, Account verification options, verificação
por e-mail, reautenticação e o subfluxo nativo de segundo fator. Antes de associar
Google, confere a hierarquia inteira contra o fluxo nativo. Um fluxo divergente
é rejeitado. A configuração repetida não recria o fluxo nem o provedor.

Google já vinculado não executa First Broker Login de novo. Não há auto-link por
coincidência de e-mail. VERIFY_EMAIL, VERIFY_PROFILE, UPDATE_PASSWORD e idp_link
permanecem disponíveis; nenhuma required action de usuário foi removida. Perfis
incompletos ainda podem exigir os dados obrigatórios pela validação nativa.

Na conta do SIDPB, Configurar senha e Vincular Google exigem sessão BFF válida e
abrem as rotas reais do Account Console 26.8.1 (`account-security/signing-in` e
`account-security/linked-accounts`). O console executa as operações autenticadas,
com suas proteções nativas. Ele mantém seu tema nativo; o tema `sidpb/login`
personaliza os formulários de autenticação e required actions, não o Account Console.

Referência: [First Broker Login e associação de contas, documentação oficial](https://www.keycloak.org/docs/latest/server_admin/).

## Persistência e auditoria

- Keycloak grava no schema `keycloak` do PostgreSQL, no volume `db_data`.
- `start-dev --import-realm` ignora o realm existente; não executa import com override.
  O JSON mínimo serve apenas ao bootstrap de uma instalação vazia.
- Configuração usa PUT incremental e IDs existentes. Não escreve em usuários,
  credenciais ou federated identities. O helper não gera mais segredos implicitamente.
- Sessões BFF usam o volume `auth_sessions`; preservar também `AUTH_SESSION_KEY`.
  Expiração normal da sessão exige login, nunca nova associação.
- Backend associa `public.usuario.keycloak_id` ao `sub`, com restrição UNIQUE e
  upsert pela identidade. Um e-mail conflitante não associa usuários automaticamente.
  O refinamento adiciona lock transacional PostgreSQL por `sub` para impedir que
  primeiros acessos concorrentes produzam um conflito incorreto de e-mail. Os três
  pontos de entrada do serviço mantêm a transação até concluir o upsert.
- Nenhuma migration ou alteração de schema foi adicionada neste refinamento.
  Atenção à V004 preexistente: ela aposenta `password_hash` legado com UPDATE para
  NULL. Não foi alterada nem reaplicada no banco da aplicação. Esse arquivo não é
  um mecanismo de atualização recorrente nem deve ser reutilizado para relink.
- Não remover volumes, realm, usuários, provedor Google ou clientes para atualizar.

`check-persistence.mjs --restart-local` compara hashes em memória de usuários,
federated identities, credenciais, clientes, provedores, roles, `public.usuario`
e submissões antes/depois de reiniciar somente o Keycloak. Não grava dados pessoais.

## Tema

Os formulários e templates de segurança continuam herdados de Keycloak 26.8.1.
O mapa agora usa a imagem estática original compartilhada com Next.js, sem Leaflet
ou tiles nas páginas de pré-login. A fonte, a atribuição e a sincronização estão
documentadas em [Administração e pré-login](ADMINISTRATION_AND_PRELOGIN.md).

Logo, card reto de 420px, fonte Arial e tokens de cores seguem o frontend. Estilos
cobrem ações primárias e secundárias (`btn-default` incluída), controles de senha,
campos, mensagens, foco e estados desabilitados. Mensagens de associação não exibem
o nome da conta localizada. Não há scripts interceptando submissões ou credenciais.

Para sincronizar logo, imagem e CSS a partir do frontend (os comandos seguintes
de configuração de identidade pertencem à etapa anterior):

```powershell
node infra/keycloak/sync-theme-assets.mjs
node --test infra/keycloak/configure-identity.test.mjs
node infra/keycloak/configure-local.mjs --inspect-identity
node infra/keycloak/configure-local.mjs --identity
```

## Evidências e limites

Automatizados executados: testes do configurador (3), sessões cifradas (2),
AuthServiceTest e IdentityIntegrationTest (5 testes, banco PostGIS isolado e
descartável, sem falhas após corrigir a concorrência),
typecheck, build Next.js, suíte E2E com Keycloak/API/PostgreSQL reais, tema em
desktop/mobile e comparação de persistência após restart. E2E inclui USER,
CURATOR e ADMIN, restauração de sessão, permissões, autoria de submissão,
decisão de curadoria, JWT adulterado, CSRF, logout e navegação real nas duas
páginas do Account Console. Fixtures criadas pela suíte são desativadas ao final.

| Caso solicitado | Evidência desta execução |
| --- | --- |
| 1. Criar conta Google | Pendente consentimento Google real |
| 2. Segundo login Google | Pendente login Google real |
| 3. Google após restart | Dados e vínculos preservados por hash; login Google pendente |
| 4. Google após rebuild | Build passou; login Google após rebuild pendente |
| 5. Cadastro com senha | Formulário e campos testados; confirmação por caixa de e-mail pendente |
| 6. Login com senha | E2E real passou para três roles |
| 7. Vincular Google a conta com senha | Navegação autenticada validada; consentimento/vínculo real pendente |
| 8. Vínculo após logout/login | Persistência no banco validada; rodada Google pendente |
| 9. Adicionar senha a conta Google | Navegação para credenciais validada; operação com conta Google pendente |
| 10. Ambos acessam mesma identidade | Arquitetura mantém sub; rodada com ambos os métodos pendente |
| 11. Sem duplicação de usuario | 12 acessos concorrentes resultam no mesmo ID; atualização de perfil mantém ID; novo subject recebe novo ID sem herdar conta histórica |
| 12. Roles e histórico | E2E de autoria/roles e fingerprints passaram |
| 13. Associação indevida | Configurador rejeita bypass; JWT/CSRF rejeitados no E2E; ataque via broker real pendente |
| 14. Todas as telas | Login/cadastro/recuperação/erro reais; botões secundários em fixture CSS; demais telas pendentes |
| 15. Desktop/mobile | Chromium 1440x900 e 390x844 passaram, sem overflow; screenshots inspecionados |

Não foram executados testes manuais com conta Google ou caixa de e-mail. Não
confundir fixture de CSS com execução real do broker. Para concluir a homologação,
usar duas contas de teste autorizadas: Google sem senha e senha com e-mail
verificado. Registrar sub, ID local, roles e submissões; adicionar o outro método
pelo console; repetir login, logout, restart e rebuild e comparar os mesmos IDs.
Tentar também associação com sessão de outra conta e prova inválida: deve falhar
sem novos usuários ou vínculos. Capturar revisão de perfil, confirmação, e-mail,
atualização de senha e erros em desktop/mobile.

O build passa com aviso preexistente do Turbopack sobre tracing de acesso dinâmico
ao diretório de sessões em `store.ts`. A suíte E2E usa os serviços locais; a correção
Java de concorrência foi validada no banco isolado, sem reconstruir/deployar a API
em execução. O teste Java inicialmente falhou por credenciais do banco local e,
no banco isolado, revelou a corrida corrigida acima. O resultado final foi 5/5.
