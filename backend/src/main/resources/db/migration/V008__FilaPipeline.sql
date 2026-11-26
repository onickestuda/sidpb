-- Fila de extração para PDFs enviados por pessoas: o worker do pipeline reserva um trabalho
-- (lease com expiração), baixa o PDF, roda a LLM e devolve o resultado para a MESMA submissão.
ALTER TABLE submissao_artigo ADD COLUMN pdf_sha256 VARCHAR(64);
ALTER TABLE submissao_artigo ADD COLUMN extraction_lease_until TIMESTAMPTZ;
COMMENT ON COLUMN submissao_artigo.pdf_sha256 IS 'Impressão digital do PDF (SHA-256); base para detectar o mesmo artigo enviado duas vezes.';
COMMENT ON COLUMN submissao_artigo.extraction_lease_until IS 'Reserva do worker; vencida, o trabalho volta para a fila.';
CREATE INDEX idx_submissao_fila_extracao ON submissao_artigo (extraction_status, created_at) WHERE origem = 'USUARIO';
CREATE INDEX idx_submissao_pdf_sha256 ON submissao_artigo (pdf_sha256);
