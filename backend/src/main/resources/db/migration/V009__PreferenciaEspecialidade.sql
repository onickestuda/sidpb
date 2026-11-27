-- Especialidade salva por curador ("Minhas áreas"): filtros que a fila de curadoria aplica ao abrir.
-- selecao = {"diseases": [...], "vectors": [...], "hosts": [...], "states": [...]}
CREATE TABLE preferencia_especialidade (
    id_usuario    INTEGER PRIMARY KEY REFERENCES usuario (id_usuario) ON DELETE CASCADE,
    selecao       JSONB NOT NULL,
    atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);
