package com.nca.sistema_miiase_app.dto.response.auth;

import com.nca.sistema_miiase_app.domain.entity.UsuarioRole;

/** code: public account code (6 hex), shown as CUR-XXXXXX; never the e-mail. */
public record LoginResponseDto(Integer id, String name, String email, UsuarioRole role, String code) {
    public LoginResponseDto(Integer id, String name, String email, UsuarioRole role) { this(id, name, email, role, null); }
}
