# SIDPB — backend

API Spring Boot 4 (Java 21) com PostgreSQL/PostGIS, migrations Flyway e autenticação
por tokens do Keycloak (resource server). A visão geral do projeto e as instruções de
execução estão no [README da raiz](../README.md).

## Pacotes (`src/main/java/com/nca/sistema_miiase_app`)

| Pacote | Conteúdo |
|---|---|
| `config` | segurança (JWT do Keycloak), CORS, reconciliação agendada de contas |
| `controller` | endpoints REST e tratadores de exceção |
| `domain` | entidades JPA e repositórios |
| `dto` | contratos de entrada/saída (mapa, ocorrências, submissões, curadoria, auth) |
| `mapper` | consultas e conversões de ocorrências |
| `service` | regras de negócio: `analytics`, `auth`, `curation`, `extraction`, `submission` |

## Execução no host

Com o banco e o Keycloak rodando no Docker (o `application.properties` importa `../.env`):

```bash
./mvnw spring-boot:run
./mvnw test   # testes de integração exigem PostgreSQL local
```
