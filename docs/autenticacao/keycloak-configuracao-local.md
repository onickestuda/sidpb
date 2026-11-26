> Endere?os locais e comandos atualizados: [docs/desenvolvimento/enderecos-locais.md](docs/desenvolvimento/enderecos-locais.md). Exemplos antigos com 127.0.0.1 ou porta 3000 n?o s?o mais os endere?os p?blicos oficiais.

# Keycloak local — etapa 1

> Este guia descreve o provisionamento inicial. A integração de autenticação
> implementada na etapa 3 está em [docs/autenticacao/integracao-keycloak.md](docs/autenticacao/integracao-keycloak.md).

Infraestrutura de desenvolvimento com `quay.io/keycloak/keycloak:26.8.1`,
`start-dev --import-realm` e PostgreSQL 15/PostGIS já existente. A versão foi
confirmada na [página oficial](https://www.keycloak.org/downloads); PostgreSQL 15
consta nas [configurações suportadas](https://www.keycloak.org/server/supported-configurations).
Não há integração com Next.js, Spring Security ou Google nesta etapa.

## Pré-requisitos e contexto

- Docker Engine/Desktop ativo e Docker Compose com suporte a dependências saudáveis/concluídas.
- Execute os comandos **na raiz deste repositório**, usando o mesmo projeto Compose
  que criou o banco. Neste ambiente: `sistema-completo`.
- Banco `sidpb_db` no serviço `db`, porta interna 5432, volume persistente
  `sistema-completo_db_data` e rede `sistema-completo_default`.
- A porta local 8081 deve estar livre. As portas existentes 5432, 8080 e 7080
  não são modificadas. Apenas `127.0.0.1:8081:8080` é publicado pelo Keycloak;
  a porta de gerenciamento 9000 fica interna.
- O usuário de provisionamento (`POSTGRES_USER`) precisa poder criar roles e
  schemas, conceder CONNECT no banco e configurar a role dedicada. Se não tiver
  esses privilégios, solicite ao DBA executar/revisar o SQL; não eleve privilégios.

O Compose alternativo `backend/docker-compose.yaml` não é usado nesta etapa.
Ele compartilha o nome fixo de container `sidpb_db` e a porta 5432, mas pode resolver
outro volume ao mudar o diretório/projeto. Não execute os dois simultaneamente.
Não altere `-p`, `COMPOSE_PROJECT_NAME` nem o nome do volume ao seguir este guia.

O Flyway continua em `classpath:db/migration`, com suas tabelas no schema `public`.
O provisionamento do Keycloak é separado; suas tabelas são gerenciadas pelo próprio
Keycloak no schema `keycloak`. Não adicione essas tabelas às migrations da aplicação.

## Variáveis locais

Preserve o `.env` existente. O `.env.example` da raiz documenta as configurações;
copie o arquivo inteiro apenas se ainda não houver `.env`. Acrescente:

```dotenv
KEYCLOAK_ADMIN=admin
KEYCLOAK_ADMIN_PASSWORD=substitua-por-uma-senha-local-forte
KEYCLOAK_DB_USER=sidpb_keycloak
KEYCLOAK_DB_PASSWORD=substitua-por-outra-senha-local-forte
```

Use senhas distintas. As variáveis administrativas são mapeadas para
`KC_BOOTSTRAP_ADMIN_USERNAME` e `KC_BOOTSTRAP_ADMIN_PASSWORD`. As credenciais do
banco são mapeadas para `KC_DB_USERNAME` e `KC_DB_PASSWORD`; a URL usa
`jdbc:postgresql://db:5432/${POSTGRES_DB}`, com `KC_DB=postgres` e
`KC_DB_SCHEMA=keycloak`. `POSTGRES_DB` deve permanecer `sidpb_db`.

O `.env` é ignorado pelo Git. Não publique a saída completa de `docker compose config`,
que contém senhas; use `--quiet` para validar. O perfil `auth` mantém os novos
serviços opcionais. A falta de senha é rejeitada ao executar os serviços, sem
impedir o uso dos serviços antigos.

## Provisionar e iniciar sem reiniciar a aplicação

Primeiro confirme o banco e o volume atuais:

```powershell
docker compose ps db
docker inspect sidpb_db --format '{{json .Mounts}}'
docker compose --profile auth config --quiet
```

Se o container do banco estiver parado, use `docker compose start db`. Se ainda
não existir um container, confirme a identificação do volume existente antes de
usar `docker compose up -d db`.

Com o banco em execução:

```powershell
docker compose --profile auth run --rm --no-deps keycloak-db-init
docker compose --profile auth up -d --no-deps --wait --wait-timeout 300 keycloak
```

Execute o segundo comando **somente se o primeiro terminar com código 0**.
Esses comandos não recriam o banco, a API, o frontend nem executam seeds.
`keycloak-db-init` é apenas um cliente `psql` descartável, não outra instância de
banco. Seu SQL transacional em `infra/keycloak/provision.sql` cria a role dedicada
sem privilégios administrativos e o schema que ela possui. A role recebe CONNECT
no banco e usa `search_path=keycloak`. Nenhuma permissão global ou tabela de
`public` é modificada. Permissões já concedidas a `PUBLIC` continuam herdadas;
se houver permissões amplas legadas, a revisão fica a cargo do DBA.

O script pode ser repetido: reutiliza role/schema e sincroniza a senha da role
com o `.env`. Ele rejeita banco diferente, role privilegiada, associação a outra
role ou schema pertencente a outro usuário. Não depende de
`/docker-entrypoint-initdb.d`, portanto funciona com o volume já populado.
Não reutilize uma role da aplicação como `KEYCLOAK_DB_USER`.

Em uma inicialização geral com `--profile auth`, o Compose também aguarda o banco
saudável e o provisionamento concluído antes de iniciar o Keycloak. Prefira os
comandos direcionados acima para não acionar outros serviços.

## Disponibilidade, painel e realm

```powershell
docker compose ps keycloak
docker compose logs --tail 100 keycloak
Invoke-WebRequest -UseBasicParsing http://localhost:8081/admin/
Invoke-RestMethod http://localhost:8081/realms/sidpb/.well-known/openid-configuration
```

O healthcheck usa Bash e `/dev/tcp` para consultar `/health/ready` na porta 9000;
não depende de curl/wget ausentes da imagem. Métricas estão habilitadas para incluir
a verificação da conexão ao banco. O primeiro boot compila a configuração e cria
tabelas, podendo levar alguns minutos. `unless-stopped` reinicia o processo após
falhas, mas o Docker não reinicia automaticamente um processo apenas por estar
`unhealthy`; nesse caso, confira os logs.

Acesse **http://localhost:8081/admin/** e entre com os valores de `KEYCLOAK_ADMIN`
e `KEYCLOAK_ADMIN_PASSWORD` no `.env`. No seletor de realms, selecione **sidpb**.
O arquivo `infra/keycloak/sidpb-realm.json` é importado oficialmente no primeiro
boot. Se o realm já existir, a importação é ignorada; editar o JSON não sobrescreve
o realm existente. Apenas os clientes e roles padrão do Keycloak são criados;
não há clientes SIDPB, roles de aplicação, provedores externos ou usuários finais.

As credenciais de bootstrap só criam o administrador inicialmente; editar a senha
no `.env` não altera uma conta já persistida. Gerencie essa senha pelo painel.

## Verificar tabelas e permissões

Abra uma sessão `psql` no banco atual (compatível com PowerShell):

```powershell
docker compose exec db sh -c 'exec psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"'
```

Execute:

```sql
SELECT current_database();
SELECT schemaname, count(*) FROM pg_tables
WHERE schemaname IN ('public', 'keycloak') GROUP BY schemaname;
SELECT id, name FROM keycloak.realm ORDER BY name;
SELECT nspname, nspowner::regrole FROM pg_namespace
WHERE nspname IN ('public', 'keycloak');
SELECT rolname, rolsuper, rolcreatedb, rolcreaterole, rolreplication, rolbypassrls
FROM pg_roles WHERE rolname = 'sidpb_keycloak';
SELECT installed_rank, version, success FROM public.flyway_schema_history;
```

Saia com `\q`. Se personalizar `KEYCLOAK_DB_USER`, ajuste o filtro da consulta.

## Parar, reiniciar e preservar dados

```powershell
docker compose stop keycloak
docker compose start keycloak
docker compose restart keycloak
```

Os realms, contas e configurações ficam no schema `keycloak` do mesmo volume
`db_data`; não precisam de outro volume. Para verificar persistência, anote o ID
de `sidpb` na consulta acima, reinicie apenas o Keycloak e confirme o mesmo ID,
o login administrativo e o endpoint de descoberta. A aplicação deve continuar ativa.
Após mudar variáveis do container, use `up -d --no-deps --wait keycloak`, pois
`restart` não recarrega variáveis. Ao mudar a senha do banco, pare o Keycloak,
repita o provisionamento e recrie somente seu container.

Nunca remova/recrie o volume nem execute `docker compose down -v`. Backups do banco
devem incluir os dois schemas e as roles necessárias. Um backup só de `public`
não contém a configuração do Keycloak.

## Problemas comuns

- **Porta 8081 ocupada:** identifique o processo com
  `Get-NetTCPConnection -LocalPort 8081 -State Listen`. Libere a porta antes de iniciar.
- **Permission denied no provisionamento:** interrompa; peça revisão ao DBA. O SQL
  reverte a transação em erro. Não execute grants globais ou troque para a role da aplicação.
- **Schema/role com proprietário inesperado:** o script para de propósito. Confirme
  com o DBA antes de reutilizar objetos existentes; não apague nem reassuma ownership.
- **Falha de senha:** confirme as credenciais reais do volume. Alterar
  `POSTGRES_PASSWORD` no `.env` não muda a senha de um PostgreSQL já inicializado.
- **Banco não disponível:** confira `docker compose ps db` e os logs. O fluxo manual
  com `--no-deps` pressupõe banco saudável e na mesma rede.
- **Keycloak unhealthy:** confira logs e disponibilidade do banco; aguarde o primeiro
  boot. O teste consulta readiness HTTP, não apenas uma porta TCP aberta.
- **Realm ausente:** verifique o mount, JSON e logs de importação. Não apague um realm
  existente para forçar importação, pois isso apaga suas configurações.
- **Painel redireciona incorretamente:** use `localhost:8081`, correspondente a
  `KC_HOSTNAME`; se trocar a porta, ajuste também esse valor.

## Desenvolvimento e produção

Esta configuração usa HTTP e `start-dev`, restritos ao loopback do host. Produção
exige projeto separado de configuração: HTTPS/hostname, imagem otimizada, gestão
de segredos, administrador permanente, backups e políticas de rede. Não publique
este Compose como implantação de produção.

Referências: [containers e importação](https://www.keycloak.org/server/containers),
[healthchecks](https://www.keycloak.org/observability/health),
[banco de dados](https://www.keycloak.org/server/db).

## Validação executada em 21/10/2026

- Branch de implementação: `feature/keycloak-auth`, criada a partir da branch
  limpa `feature/keycloak-autenticacao`. Não houve push nem deploy.
- Docker Desktop disponível; PostgreSQL real identificado como 15.8/PostGIS.
- `docker compose --profile auth config --quiet` e `git diff --check`: sucesso.
- Porta 8081 livre antes da inicialização; publicação final confirmada apenas em
  `127.0.0.1`. Healthcheck: `healthy`.
- Provisionamento executado duas vezes com sucesso sobre o banco existente.
  Senha vazia e tentativa de reutilizar `sidpb_admin` foram rejeitadas.
- Keycloak 26.8.1 iniciou, conectou ao banco e criou 101 tabelas em `keycloak`.
  `public` manteve suas 23 tabelas e as migrations 001, 002 e 003 bem-sucedidas.
- Dumps de estrutura e dados de `public`, antes e depois, resultaram idênticos
  (desconsiderando somente marcadores aleatórios `restrict` do pg_dump).
- Role `sidpb_keycloak` sem superuser, CREATEDB, CREATEROLE, REPLICATION ou BYPASSRLS;
  sem CREATE em `public`, com CREATE em `keycloak`. A única tabela acessível em
  `public` é `spatial_ref_sys`, somente leitura, por permissão herdada do PostGIS.
  Nenhuma permissão global foi alterada.
- Painel `/admin/`: HTTP 200. Credenciais administrativas verificadas pelo endpoint
  de token e pela leitura autenticada de `/admin/realms/sidpb`; não foi realizada
  inspeção visual do painel em navegador.
- Descoberta OIDC retornou issuer `http://localhost:8081/realms/sidpb`.
- Após `docker compose restart keycloak`, o serviço voltou a `healthy`; login,
  descoberta OIDC e o mesmo ID do realm `sidpb` foram confirmados.
- Banco, API e frontend permaneceram em execução sem reinicialização. O volume
  `sistema-completo_db_data` foi preservado.
- As quatro variáveis KEYCLOAK foram acrescentadas ao `.env` local, com senhas
  aleatórias distintas, sem modificar os valores anteriores. O arquivo continua
  ignorado pelo Git. Para acessar este ambiente, consulte essas credenciais locais;
  os valores de `.env.example` são apenas ilustrativos.

Não há pendência de infraestrutura neste ambiente. Em outra máquina, preencha as
variáveis e execute o provisionamento antes de iniciar o serviço conforme este guia.
