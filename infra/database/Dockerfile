# Banco do SIDPB: PostgreSQL 15 + PostGIS. O schema é criado pelo Flyway da API, e o
# Keycloak usa o schema "keycloak" no mesmo banco (provisionado por keycloak-db-init).
FROM postgis/postgis:15-3.4-alpine

ENV TZ=America/Sao_Paulo

HEALTHCHECK --interval=5s --timeout=5s --start-period=20s --retries=10 \
  CMD pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB" -h localhost || exit 1

EXPOSE 5432
