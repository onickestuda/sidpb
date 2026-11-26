-- Preserve IDs and all foreign keys. Legacy accounts are linked explicitly by an operator.
ALTER TABLE public.usuario ADD COLUMN keycloak_id VARCHAR(255);
ALTER TABLE public.usuario ADD CONSTRAINT uq_usuario_keycloak_id UNIQUE (keycloak_id);
ALTER TABLE public.usuario ALTER COLUMN password_hash DROP NOT NULL;
-- Retire prototype credentials; Keycloak is now the only credential store.
UPDATE public.usuario SET password_hash = NULL;
ALTER TABLE public.usuario ADD CONSTRAINT ck_usuario_no_password CHECK (password_hash IS NULL);
COMMENT ON COLUMN public.usuario.password_hash IS 'Retired; must remain NULL. Credentials belong to Keycloak.';
COMMENT ON COLUMN public.usuario.role IS 'Display cache only; authorization uses validated Keycloak claims.';
COMMENT ON COLUMN public.usuario.keycloak_id IS 'OIDC sub in the configured sidpb realm; no cross-schema foreign key.';
COMMENT ON TABLE public.submissao_artigo IS 'Actors resolved from authenticated Keycloak identity; original IDs preserved.';

CREATE TABLE public.usuario_identity_link_audit (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_usuario INTEGER NOT NULL REFERENCES public.usuario(id_usuario),
    keycloak_id VARCHAR(255) NOT NULL,
    approval_reference TEXT NOT NULL,
    linked_by TEXT NOT NULL DEFAULT CURRENT_USER,
    linked_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
