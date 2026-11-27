package com.nca.sistema_miiase_app.dto.submission;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;

public record SubmissionRequestDto(
        Integer userId,
        /** Optional when a PDF is sent; the PDF is optional when this link is given. */
        @Size(max = 1000) String originalLink,
        @NotNull @Valid ArticleDataDto userData
) { }
