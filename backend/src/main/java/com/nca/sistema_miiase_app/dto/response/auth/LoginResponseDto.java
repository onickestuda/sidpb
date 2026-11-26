package com.nca.sistema_miiase_app.dto.response.auth;

import com.nca.sistema_miiase_app.domain.entity.UsuarioRole;

public record LoginResponseDto(Integer id, String name, String email, UsuarioRole role) {
}
