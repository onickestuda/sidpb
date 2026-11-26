package com.nca.sistema_miiase_app.dto.curation;

import java.util.List;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import com.nca.sistema_miiase_app.dto.submission.ArticleDataDto;

/**
 * occurrences: the curated occurrences that replace whatever the extraction found. Null keeps the
 * previous behavior (extracted occurrences, if any, simply become CURADA).
 */
public record ApproveRequestDto(Integer curatorId, @NotNull @Valid ArticleDataDto curatedData,
                                @Size(max = 200) List<@Valid CuratedOccurrenceDto> occurrences) {
    public ApproveRequestDto(Integer curatorId, ArticleDataDto curatedData) { this(curatorId, curatedData, null); }
}
