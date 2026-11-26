package com.nca.sistema_miiase_app.dto.submission;

import java.util.List;
import org.springframework.data.domain.Page;

public record SubmissionPageDto(List<SubmissionSummaryDto> items, int page, int size, long totalElements, int totalPages) {
    public static SubmissionPageDto from(Page<SubmissionSummaryDto> page) {
        return new SubmissionPageDto(page.getContent(), page.getNumber(), page.getSize(), page.getTotalElements(), page.getTotalPages());
    }
}
