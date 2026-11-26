package com.nca.sistema_miiase_app.dto.request.auth;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.Setter;

// Não gerar toString: este DTO contém a senha apenas durante a requisição.
@Getter
@Setter
public class LoginRequestDto {
    @NotBlank
    @Email
    @Size(max = 320)
    private String email;

    @NotBlank
    @Size(max = 255)
    private String password;
}
