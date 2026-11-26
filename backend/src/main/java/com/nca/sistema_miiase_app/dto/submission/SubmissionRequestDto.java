package com.nca.sistema_miiase_app.dto.submission;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;

public record SubmissionRequestDto(
        Integer userId,
        @NotBlank @Size(max = 1000) String originalLink,
        @NotNull @Valid ArticleDataDto userData
) { }
