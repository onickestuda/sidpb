package com.nca.sistema_miiase_app.service.extraction;

import java.time.Instant;
import java.util.List;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import com.nca.sistema_miiase_app.service.submission.PdfStorageService;

/**
 * Work queue for PDFs submitted by people. The worker (on the LLM machine) only makes outgoing
 * requests: it claims jobs, downloads each PDF and posts the result back to the same submission.
 * A claim is a lease: if the worker dies, the job returns to the queue when the lease expires.
 */
@Service
public class PipelineQueueService {

    public record Job(Integer submissionId, String title, String pdfName, Long pdfSize, String pdfSha256,
                      Instant submittedAt, Instant leaseUntil) { }

    static final int LEASE_MINUTES = 30;
    private static final int MAX_CLAIM = 20;

    private final JdbcTemplate jdbc;
    private final PdfStorageService storage;

    public PipelineQueueService(JdbcTemplate jdbc, PdfStorageService storage) {
        this.jdbc = jdbc;
        this.storage = storage;
    }

    @Transactional
    public List<Job> claim(int limit) {
        int size = Math.max(1, Math.min(limit, MAX_CLAIM));
        return jdbc.query("""
                UPDATE submissao_artigo s SET extraction_lease_until = CURRENT_TIMESTAMP + make_interval(mins => ?)
                WHERE s.id_submissao IN (
                    SELECT id_submissao FROM submissao_artigo
                    WHERE origem = 'USUARIO' AND extraction_status = 'PENDING' AND pdf_path IS NOT NULL
                      AND (extraction_lease_until IS NULL OR extraction_lease_until < CURRENT_TIMESTAMP)
                    ORDER BY created_at, id_submissao
                    LIMIT ? FOR UPDATE SKIP LOCKED)
                RETURNING s.id_submissao, s.titulo, s.pdf_nome, s.pdf_tamanho, s.pdf_sha256, s.created_at, s.extraction_lease_until
                """, (rs, row) -> new Job(rs.getInt("id_submissao"), rs.getString("titulo"), rs.getString("pdf_nome"),
                (Long) rs.getObject("pdf_tamanho"), rs.getString("pdf_sha256"), rs.getTimestamp("created_at").toInstant(),
                rs.getTimestamp("extraction_lease_until").toInstant()), LEASE_MINUTES, size);
    }

    /** PDF of a job still waiting for extraction (claimed or not). */
    public Resource pdf(Integer submissionId) {
        List<String> paths = jdbc.queryForList("""
                SELECT pdf_path FROM submissao_artigo
                WHERE id_submissao = ? AND origem = 'USUARIO' AND extraction_status = 'PENDING' AND pdf_path IS NOT NULL""",
                String.class, submissionId);
        if (paths.isEmpty()) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Trabalho não encontrado ou já extraído.");
        return storage.load(paths.get(0));
    }

    /** The worker gives up a job (e.g. the LLM is unavailable): it returns to the queue immediately. */
    public void release(Integer submissionId) {
        jdbc.update("UPDATE submissao_artigo SET extraction_lease_until = NULL WHERE id_submissao = ? AND extraction_status = 'PENDING'",
                submissionId);
    }
}
