-- Submissões de usuários: a fonte pode ser o PDF, o link original ou ambos (ao menos um).
-- Os dados do arquivo continuam coerentes: com PDF, caminho, nome e tamanho vêm juntos.
ALTER TABLE submissao_artigo DROP CONSTRAINT ck_submissao_arquivos_usuario;
ALTER TABLE submissao_artigo ADD CONSTRAINT ck_submissao_arquivos_usuario CHECK (
    origem <> 'USUARIO'
    OR (
        (link_original IS NOT NULL OR pdf_path IS NOT NULL)
        AND (pdf_path IS NULL) = (pdf_nome IS NULL)
        AND (pdf_path IS NULL) = (pdf_tamanho IS NULL)
    )
);
