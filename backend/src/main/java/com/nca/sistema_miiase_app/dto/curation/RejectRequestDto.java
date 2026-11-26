package com.nca.sistema_miiase_app.dto.curation;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;

public record RejectRequestDto(Integer curatorId, @NotBlank @Size(max = 2000) String reason) { }
