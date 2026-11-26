package com.nca.sistema_miiase_app.dto.submission;

import java.time.Instant;
import com.nca.sistema_miiase_app.domain.entity.SubmissaoStatus;

public record SubmissionSummaryDto(
        Integer id, String title, String originalLink, SubmissaoStatus status,
        Instant createdAt, PersonDto submittedBy, PersonDto reviewedBy, Instant reviewedAt
) { }
