package com.nca.sistema_miiase_app.dto.curation;

import java.math.BigDecimal;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/**
 * One occurrence confirmed by the curator. sourceId points to the extracted occurrence it came from
 * (to keep its evidence quotes); null when the curator added it from scratch.
 */
public record CuratedOccurrenceDto(
        Integer sourceId,
        @Size(max = 300) String disease,
        @Size(max = 300) String parasite,
        @Size(max = 300) String vector,
        @Size(max = 300) String host,
        @Size(max = 100) String hostCategory,
        @Size(max = 300) String municipality,
        @Size(max = 100) String state,
        @DecimalMin("-90") @DecimalMax("90") BigDecimal latitude,
        @DecimalMin("-180") @DecimalMax("180") BigDecimal longitude,
        @Min(1500) @Max(2100) Integer year,
        @NotBlank @Pattern(regexp = "EXATA|MUNICIPIO|ESTADO|SEM_LOCAL") String locationSeal,
        @Size(max = 4000) String notes
) { }
