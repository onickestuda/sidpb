package com.nca.sistema_miiase_app.dto.submission;

import java.math.BigDecimal;
import java.util.List;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

// Mesmo formato para usuário, extração e resultado curado, em campos separados.
public record ArticleDataDto(
        @NotBlank @Size(max = 500) String title,
        @Size(max = 50) List<@NotBlank @Size(max = 200) String> authors,
        @Min(1500) @Max(2100) Integer year,
        @Size(max = 200) String doi,
        @Size(max = 200) String disease,
        @Size(max = 200) String parasite,
        @Size(max = 200) String vector,
        @Size(max = 200) String host,
        @Size(max = 100) String state,
        @Size(max = 200) String municipality,
        @DecimalMin("-90") @DecimalMax("90") BigDecimal latitude,
        @DecimalMin("-180") @DecimalMax("180") BigDecimal longitude,
        @Size(max = 200) String source,
        @Size(max = 4000) String notes
) { }
