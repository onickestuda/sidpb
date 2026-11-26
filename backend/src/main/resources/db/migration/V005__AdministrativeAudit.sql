-- Business audit only. Identity and permissions remain in Keycloak.
CREATE TABLE public.admin_user_audit (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    actor_sub VARCHAR(255) NOT NULL,
    actor_name VARCHAR(255) NOT NULL,
    target_sub VARCHAR(255) NOT NULL,
    target_name VARCHAR(255) NOT NULL,
    operation VARCHAR(30) NOT NULL,
    before_state JSONB NOT NULL,
    after_state JSONB,
    result VARCHAR(20) NOT NULL CHECK (result IN ('PENDING','SUCCESS','FAILED','PARTIAL','UNKNOWN')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMPTZ
);
CREATE INDEX idx_admin_audit_target ON public.admin_user_audit (target_sub, id DESC);
COMMENT ON TABLE public.admin_user_audit IS 'Durable administrative intent and confirmed outcome; no credentials. PENDING/UNKNOWN require technical reconciliation.';
