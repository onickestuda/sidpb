package com.nca.sistema_miiase_app.dto.submission;

import java.time.Instant;
import com.nca.sistema_miiase_app.domain.entity.ExtractionStatus;
import com.nca.sistema_miiase_app.domain.entity.SubmissaoStatus;

public record SubmissionDetailDto(
        Integer id, String title, String originalLink, String pdfName, long pdfSize,
        SubmissaoStatus status, Instant createdAt, Instant updatedAt,
        PersonDto submittedBy, ArticleDataDto userData, ArticleDataDto llmData,
        ExtractionStatus extractionStatus, Instant extractedAt, String extractionModel, boolean extractionMock,
        ArticleDataDto curatedData, PersonDto reviewedBy, Instant reviewedAt, String rejectionReason
) { }
