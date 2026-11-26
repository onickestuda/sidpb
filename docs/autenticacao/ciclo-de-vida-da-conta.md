> Atualizacao operacional em 12/11/2026: ambiente local ativado. Consulte [docs/desenvolvimento/ativacao-local.md](docs/desenvolvimento/ativacao-local.md) para migrations, backup e resultados atuais. Os bloqueios e pendencias descritos abaixo pertencem a etapa anterior.

# Autenticação e exclusão de contas

Esta política substitui o antigo bloqueio `auth_error=legacy` e o procedimento de reassociação de contas históricas. A identidade é exclusivamente o `sub` do realm configurado. E-mail é um atributo mutável, não uma chave de propriedade.

| Situação | Comportamento |
|---|---|
| Conta existente | Login OIDC normal; alterações de senha/nome/e-mail mantêm o mesmo ID local e vínculos. |
| Senha esquecida | Recuperação nativa do Keycloak por e-mail. Não se cria outra identidade. |
| E-mail não verificado | A opção “Verificar meu e-mail” inicia autenticação nativa. Na etapa de verificação, o usuário pode reenviar o e-mail respeitando o cooldown. Nenhum token não verificado recebe acesso ao SIDPB. |
| Conta desativada | Login/introspecção negam acesso. Reconciliação atualiza apenas o cache de ativação; perfil e contribuições são preservados para reativação. |
| Conta excluída | Exclusão da identidade por ID, seguida de anonimização local. Contribuições e autoria bibliográfica permanecem intactas. |
| Mesmo e-mail após exclusão | Novo `sub`, novo ID local, nenhuma contribuição antiga transferida. |
| Registro sem `sub` | Não bloqueia cadastro e nunca é associado por e-mail. Anonimização exige decisão administrativa explícita pelo ID local. |

## Exclusão solicitada no SIDPB

“Configurações da conta” exige digitar `EXCLUIR`. O BFF valida Origin, sessão e confirmação e encaminha somente `DELETE /api/auth/me`; não aceita um ID de vítima vindo do navegador. A API resolve o sujeito autenticado. Contas técnicas são recusadas e administradores devem transferir/remover seu papel administrativo por outro administrador antes de excluir a própria conta.

1. Uma transação independente registra o pedido em `account_deletion`, marca a conta local inativa e faz commit antes do DELETE remoto.
2. O pedido já impede acesso pela API, mesmo se o Keycloak estiver indisponível ou um token ainda não tiver expirado.
3. O serviço exclui o usuário do Keycloak **pelo ID**, nunca pelo e-mail. Confirma ausência via Admin REST, validando também que o realm esperado existe.
4. Uma transação anonimiza nome, e-mail, senha, ID Keycloak e perfil da linha local. Remove o antigo registro privado de associação e os dados pessoais dos snapshots de auditoria relacionados ao usuário. O pedido passa a `COMPLETE`, apaga o subject original e retém somente SHA-256 como barreira contra reutilização da identidade excluída.
5. O BFF remove a sessão atual e cookies. A resposta `202` significa pedido aceito, não uma promessa de que os dois serviços já concluíram o processamento.

São mantidos os IDs locais anonimizados usados pelas FKs das submissões e decisões. Não há DELETE de `usuario`, `submissao_artigo`, `fonte`, `ocorrencia` ou arquivos PDF. JSON bibliográfico, autores dos artigos, dados curados, avaliações e vínculos ocorrência–fonte não são alterados. Uma FK continua impedindo apagar acidentalmente um ator que tenha contribuições.

## Falhas parciais e exclusão pelo console

Não existe transação distribuída entre PostgreSQL e Keycloak. A consistência é eventual, com intenção durável, operações idempotentes e retentativas. Timeout do DELETE pode significar que o Keycloak já excluiu a conta; a próxima tentativa consulta o ID novamente. Falha no commit PostgreSQL após o DELETE deixa o pedido pendente para repetir a anonimização.

`AccountReconciliation` roda com intervalo padrão de 60 segundos após a inicialização. Cada passagem processa até 50 pedidos e verifica até 100 identidades locais, priorizando as menos recentemente verificadas. Exclusão externa é reconhecida apenas por 404 do recurso do usuário depois de validar o realm. Erros de token de serviço, realm errado/ausente, 403, timeout ou erro do servidor nunca são tratados como exclusão. Conta `enabled=false` também não é exclusão.

O serviço de reconciliação e a administração compartilham locks no PostgreSQL. Login e anonimização também compartilham lock por subject, impedindo que requisições concorrentes recriem um registro com a identidade excluída. A introspecção continua rejeitando tokens revogados/desativados antes de autorizar operações.

A varredura inclui identidades presentes apenas na auditoria administrativa ou no antigo registro de associação, mesmo que nunca tenham feito login no SIDPB. A tabela `account_identity_watch` mantém o cursor de verificação por identidade e remove seu subject após a anonimização. Isso evita deixar dados pessoais em auditorias de usuários excluídos pelo console antes do primeiro acesso.

Os processos Next fazem uma varredura periódica das sessões cifradas, em lotes de 100. Introspecção do **refresh token** remove sessões revogadas por exclusão/desativação/logout, inclusive de outros navegadores. Não se confunde expiração de access token com encerramento da sessão. Registros expirados também são removidos. Locks evitam corrida com refresh; falhas de comunicação preservam o arquivo até uma verificação posterior. A limpeza exige o processo BFF ativo e conectividade com o provedor.

Configuração operacional:

- `sidpb.auth.reconciliation-enabled` (padrão `true`); desativado no perfil de testes para que testes controlem cada passagem.
- `sidpb.auth.reconciliation-delay-ms` (padrão `60000`). O prazo total depende do volume de contas, backlog e disponibilidade dos serviços.
- `AUTH_SESSION_MAINTENANCE_ENABLED=false` desativa apenas a varredura BFF para processos de teste; o padrão mantém a varredura ligada.
- O cliente administrativo continua precisando das permissões já existentes de gerenciamento de usuários e leitura do realm.

Consulta operacional sem expor identidade ou perfil:

```sql
SELECT state, count(*), min(requested_at), max(attempts), max(last_attempt_at)
FROM account_deletion GROUP BY state;
```

Pedidos `PENDING` persistentes exigem verificar disponibilidade/permissões, mantendo o pedido para retentativa. Não se deve restaurar perfil por e-mail nem limpar a barreira de exclusão para “corrigir” login.

## Órfãos sem identidade registrada

Não é possível concluir que uma conta foi excluída no Keycloak apenas porque uma linha antiga não tem `keycloak_id`. Esses registros não recebem acesso nem bloqueiam novos cadastros. Após confirmar explicitamente que um registro local deve ser apagado, um administrador pode enviar:

`DELETE /api/admin/users/orphans/{idLocal}`, com `{"confirmation":"EXCLUIR"}`.

O BFF já permite esse caminho administrativo. A API revalida o administrador no Keycloak e exige `keycloak_id IS NULL`; recusa uma conta vinculada. A anonimização e auditoria local são atômicas, idempotentes, sem exclusão remota e sem transferência de contribuições. Não há operação em lote por e-mail. O antigo `infra/keycloak/link-legacy-user.sql` foi removido; não há reassociação de identidades históricas.

## Migration e validação isolada

`V006__AccountLifecycle.sql` altera somente o esquema: remove unicidade global do e-mail, permite e-mail nulo, adiciona marcadores de anonimização/reconciliação e a fila durável. Não apaga, anonimiza ou associa contas existentes durante a migration. As migrations V001–V005 permanecem inalteradas nesta revisão. A migration **não foi aplicada à base atual**, e os serviços atuais não foram substituídos.

Testes:

```powershell
node infra/keycloak/test-admin-db.mjs
node infra/keycloak/test-native-lifecycle.mjs
cd frontend
npm.cmd run typecheck
npm.cmd run test:auth
npm.cmd run build
```

O primeiro cria um PostgreSQL/PostGIS descartável e usa um gateway simulado ou servidor HTTP de contrato. Cobre preservação integral de submissões pendentes/aprovadas/rejeitadas, artigos/autores e ocorrências, exclusão pelo console, órfãos, desativação/reativação, falhas remotas/SQL, concorrência, idempotência, autorização e novo cadastro sem herança de vínculos.

O segundo não lê `.env`: cria um Keycloak descartável sem volumes, credenciais aleatórias e um coletor SMTP em memória. Executa cadastro, e-mail de verificação, proteção de cooldown e reenvio, login verificado, logout, recuperação com troca de senha, desativação e reativação, introspecção de tokens, exclusão pelo console e novo cadastro com o mesmo e-mail/novo subject. Encerra o container ao finalizar; não envia e-mail a pessoas reais.

Testes frontend cobrem confirmação/origem/sessão, impossibilidade de selecionar outra vítima, limpeza de cookies, erros do upstream, armazenamento cifrado, locks e remoção segura de sessões revogadas.

Não foram realizados push, deploy, exclusão de contas reais, alterações no realm existente ou migrations na base atual. Entrega pelo SMTP real e configuração operacional do ambiente existente não fazem parte dos resultados isolados.

Referências: [Admin REST do Keycloak](https://www.keycloak.org/docs-api/latest/rest-api/), [verificação de e-mail e proteção de reenvio na versão utilizada](https://github.com/keycloak/keycloak/blob/26.8.1/services/src/main/java/org/keycloak/authentication/requiredactions/VerifyEmail.java).
