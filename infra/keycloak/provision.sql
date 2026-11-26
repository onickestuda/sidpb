-- Run with psql -X --set=ON_ERROR_STOP=1. Credentials come from the environment.
\getenv kc_user KEYCLOAK_DB_USER
\getenv kc_password KEYCLOAK_DB_PASSWORD
BEGIN;
SELECT set_config('sidpb.keycloak_user', :'kc_user', true) AS kc_user_setting \gset
DO $$
DECLARE
    service_user text := current_setting('sidpb.keycloak_user');
    existing_role pg_roles%ROWTYPE;
BEGIN
    IF current_database() <> 'sidpb_db' THEN
        RAISE EXCEPTION 'Provisioning is restricted to sidpb_db';
    END IF;
    IF service_user !~ '^[a-z][a-z0-9_]{0,62}$' OR service_user = current_user THEN
        RAISE EXCEPTION 'Use a dedicated, lowercase PostgreSQL role for Keycloak';
    END IF;
    SELECT * INTO existing_role FROM pg_roles WHERE rolname = service_user;
    IF FOUND THEN
        IF existing_role.rolsuper OR existing_role.rolcreatedb OR existing_role.rolcreaterole
           OR existing_role.rolreplication OR existing_role.rolbypassrls
           OR NOT existing_role.rolcanlogin
           OR EXISTS (SELECT 1 FROM pg_auth_members WHERE member = existing_role.oid)
           OR NOT EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'keycloak' AND nspowner = existing_role.oid) THEN
            RAISE EXCEPTION 'Existing role is not a dedicated Keycloak owner; ask the DBA to review';
        END IF;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'keycloak'
               AND nspowner::regrole::text <> service_user) THEN
        RAISE EXCEPTION 'Schema keycloak has another owner; ask the DBA to review';
    END IF;
END $$;
SELECT format('CREATE ROLE %I LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS', :'kc_user')
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = :'kc_user') \gexec
SELECT format('ALTER ROLE %I PASSWORD %L', :'kc_user', :'kc_password') \gexec
SELECT format('CREATE SCHEMA IF NOT EXISTS keycloak AUTHORIZATION %I', :'kc_user') \gexec
SELECT format('GRANT CONNECT ON DATABASE %I TO %I', current_database(), :'kc_user') \gexec
SELECT format('ALTER ROLE %I IN DATABASE %I SET search_path TO keycloak', :'kc_user', current_database()) \gexec
COMMIT;
