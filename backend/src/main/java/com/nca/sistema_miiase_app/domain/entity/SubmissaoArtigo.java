package com.nca.sistema_miiase_app.domain.entity;

import java.time.Instant;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;
import com.nca.sistema_miiase_app.dto.submission.ArticleDataDto;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

@Entity
@Getter
@Setter
@Table(name = "submissao_artigo")
public class SubmissaoArtigo {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id_submissao")
    private Integer id;
    @ManyToOne(fetch = FetchType.LAZY, optional = false) @JoinColumn(name = "id_usuario", nullable = false)
    private Usuario usuario;
    @Column(nullable = false, length = 500)
    private String titulo;
    @Column(name = "link_original", length = 1000)
    private String linkOriginal;
    @Column(name = "pdf_path", length = 100)
    private String pdfPath;
    @Column(name = "pdf_nome", length = 255)
    private String pdfNome;
    // Null for automatic extractions (no PDF upload); required for user submissions (DB constraint).
    @Column(name = "pdf_tamanho")
    private Long pdfTamanho;
    /** USUARIO (manual upload) or EXTRACAO (received from the LLM pipeline). */
    @Column(nullable = false, length = 20)
    private String origem = "USUARIO";
    @Column(name = "pdf_sha256", length = 64)
    private String pdfSha256;
    @Enumerated(EnumType.STRING) @Column(nullable = false, length = 20)
    private SubmissaoStatus status = SubmissaoStatus.PENDING;
    private Integer ano;
    @Column(length = 200)
    private String doenca;
    @JdbcTypeCode(SqlTypes.JSON) @Column(name = "dados_usuario", nullable = false, columnDefinition = "jsonb")
    private ArticleDataDto dadosUsuario;
    @JdbcTypeCode(SqlTypes.JSON) @Column(name = "dados_llm", columnDefinition = "jsonb")
    private ArticleDataDto dadosLlm;
    @JdbcTypeCode(SqlTypes.JSON) @Column(name = "dados_curados", columnDefinition = "jsonb")
    private ArticleDataDto dadosCurados;
    @Enumerated(EnumType.STRING) @Column(name = "extraction_status", nullable = false, length = 20)
    private ExtractionStatus extractionStatus = ExtractionStatus.PENDING;
    @Column(name = "extracted_at")
    private Instant extractedAt;
    @Column(name = "extraction_model", length = 100)
    private String extractionModel;
    @Column(name = "extraction_mock", nullable = false)
    private boolean extractionMock;
    @ManyToOne(fetch = FetchType.LAZY) @JoinColumn(name = "id_curador")
    private Usuario curador;
    @Column(name = "reviewed_at")
    private Instant reviewedAt;
    @Column(name = "rejection_reason", length = 2000)
    private String rejectionReason;
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;
    @Version @Column(nullable = false)
    private long version;

    @PrePersist
    void beforeInsert() { createdAt = Instant.now(); updatedAt = createdAt; }
    @PreUpdate
    void beforeUpdate() { updatedAt = Instant.now(); }
}
