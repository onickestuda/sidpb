# Ativação local — 12/11/2026

Ambiente local atualizado a pedido do usuário. Não houve push nem publicação em ambiente remoto.

## Alterações ativadas

- API e frontend reconstruídos e recriados com `docker compose up -d --no-deps api frontend`. Banco e Keycloak existentes não foram recriados; nenhum seed foi executado.
- O Dockerfile da API compila o código fonte com Maven dentro da imagem. A imagem final usa JRE 21 e deixa de depender de um JAR antigo em `backend/target`.
- Flyway aplicou V005 e V006. A primeira inicialização manteve a limpeza desativada; a comparação com o backup confirmou preservação de todos os registros anteriores após as migrations.
- Credenciais administrativas atualizadas pelo usuário foram validadas. Apenas as URLs do cliente `sidpb-web` foram ajustadas: callback `http://localhost:7080/sidpb/api/auth/callback/` e retorno de logout `http://localhost:7080/sidpb/`, preservando PKCE S256 e secrets.
- `ACCOUNT_RECONCILIATION_ENABLED=true` e `AUTH_SESSION_MAINTENANCE_ENABLED=true` ativam os processos no `.env` central. Compose encaminha ambos aos respectivos serviços.
- A reconciliação confirmou 41 identidades já ausentes no Keycloak e anonimizou seus registros locais. Na prévia, 38 tinham endereços de fixtures e 3 não estavam identificadas como fixtures. Nenhuma identidade ainda existente no Keycloak foi excluída.
- Estado final observado: 41 pedidos concluídos, zero pendentes, uma identidade local ainda vinculada e três registros sem subject preservados, sem inferência de propriedade por e-mail.

## Backup e preservação

Backup completo, incluindo os schemas público e Keycloak:

`.local-backups/2026-11-12T13-51-27-667Z-f7aefd/database.dump`

O diretório está ignorado pelo Git. O arquivo contém dados sensíveis e deve permanecer privado. O inventário foi validado com `pg_restore --list` antes da atualização. `manifest.json` registra imagens anteriores e hashes das tabelas monitoradas, sem copiar perfis para o relatório.

Após a reconciliação, a comparação dos registros completos confirmou preservação de 17 submissões, 9 fontes/artigos, 44 ocorrências e vínculos ocorrência–fonte, além dos usuários ainda existentes no Keycloak, credenciais, vínculos federados e provedores de identidade.

Os hashes de `usuario`, do histórico privado de associações e do cliente OIDC são excluídos da verificação posterior: anonimização e remoção dos callbacks antigos são alterações esperadas. A verificação anterior à reconciliação comparou também esses registros.

```powershell
node infra/local-activation.mjs backup
node infra/local-activation.mjs verify .local-backups/<diretorio>
node infra/local-activation.mjs verify-after-reconciliation .local-backups/<diretorio>
```

Esses comandos não aplicam migrations, restauram backups ou apagam contas. Um backup futuro representa o estado no momento em que for criado; não substitui o backup anterior à ativação.

## Verificações no runtime

- Build Docker da API e frontend: passou.
- Flyway: V001–V006 concluídas.
- `localhost-urls.e2e.mjs`: passou; cinco ações OIDC, callback/issuer públicos, PKCE, cookies, proteção de origem, URL de logout e navegação dos botões.
- `keycloak-theme.e2e.mjs`: passou; telas de login, cadastro e recuperação, mensagens de erro, apresentação móvel e assets.
- CORS: `http://localhost:7080` aceito, `http://127.0.0.1:7080` rejeitado.
- Credenciais administrativas e configurações nativas de verificação e recuperação: válidas/ativadas.
- SMTP Gmail: TLS com certificado válido e EHLO confirmados a partir de um container. Não foi enviado e-mail real; autenticação SMTP e entrega a uma caixa postal real não foram comprovadas por essa sondagem.

Login, verificação/reenvio, recuperação com troca de senha, logout, exclusão e recadastro com nova identidade foram exercitados em Keycloak descartável com SMTP em memória na etapa anterior. Os testes no ambiente atual não criaram nem excluíram contas reais para simular esses fluxos. As anonimizações descritas acima são a execução operacional da política solicitada sobre identidades já excluídas, após o backup e a ativação.
