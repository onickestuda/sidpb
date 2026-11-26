-- Schema only: no existing account or scientific record is deleted/anonymized by migration.
ALTER TABLE public.usuario DROP CONSTRAINT uq_usuario_email;
ALTER TABLE public.usuario ALTER COLUMN email DROP NOT NULL;
ALTER TABLE public.usuario ADD COLUMN deleted_at TIMESTAMPTZ;
ALTER TABLE public.usuario ADD COLUMN identity_checked_at TIMESTAMPTZ;
CREATE INDEX idx_usuario_email ON public.usuario(email);
ALTER TABLE public.usuario ADD CONSTRAINT ck_usuario_deleted CHECK
 (deleted_at IS NULL OR (keycloak_id IS NULL AND email IS NULL AND password_hash IS NULL AND NOT ativo AND nome='Conta excluída' AND role='USER'));
CREATE TABLE public.account_deletion (
 subject_hash CHAR(64) PRIMARY KEY,
 subject VARCHAR(255),
 state VARCHAR(16) NOT NULL DEFAULT 'PENDING' CHECK (state IN ('PENDING','COMPLETE')),
 requested_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
 completed_at TIMESTAMPTZ,
 attempts INTEGER NOT NULL DEFAULT 0,
 last_attempt_at TIMESTAMPTZ,
 CHECK ((state='PENDING' AND subject IS NOT NULL) OR (state='COMPLETE' AND subject IS NULL))
);
-- Also reconcile subjects known only from administration (users who never logged into SIDPB).
CREATE TABLE public.account_identity_watch (
 subject VARCHAR(255) PRIMARY KEY,
 checked_at TIMESTAMPTZ
);
COMMENT ON TABLE public.account_deletion IS 'Durable erasure intent. Completed subjects retained only as SHA-256 replay fences, never for reassociation.';
COMMENT ON COLUMN public.usuario.email IS 'Profile cache, not an identity or ownership key. Keycloak sub is the sole identity.';
