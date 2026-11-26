package com.nca.sistema_miiase_app.dto.curation;

import com.nca.sistema_miiase_app.dto.submission.ArticleDataDto;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;

public record ApproveRequestDto(Integer curatorId, @NotNull @Valid ArticleDataDto curatedData) { }
