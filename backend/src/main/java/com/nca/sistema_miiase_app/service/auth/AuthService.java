package com.nca.sistema_miiase_app.service.auth;

import java.util.Locale;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import com.nca.sistema_miiase_app.config.SecurityConfig;
import com.nca.sistema_miiase_app.domain.entity.UsuarioRole;
import com.nca.sistema_miiase_app.dto.response.auth.LoginResponseDto;

@Service
public class AuthService {
    private final JdbcTemplate jdbc;
    public AuthService(JdbcTemplate jdbc) { this.jdbc = jdbc; }

    public Jwt identity() {
        var auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !(auth.getPrincipal() instanceof Jwt jwt))
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Autenticação necessária.");
        return jwt;
    }

    @Transactional
    public LoginResponseDto currentUser() {
        Jwt jwt = identity();
        var roles = SecurityConfig.roles(jwt);
        if (!roles.contains("USER") || !Boolean.TRUE.equals(jwt.getClaimAsBoolean("email_verified")))
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Verifique o e-mail e o perfil de acesso.");
        String email = jwt.getClaimAsString("email");
        if (email == null || email.isBlank() || email.length() > 320)
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "E-mail válido necessário.");
        email = email.strip().toLowerCase(Locale.ROOT);
        String name = jwt.getClaimAsString("name");
        if (name == null || name.isBlank()) name = jwt.getClaimAsString("preferred_username");
        if (name == null || name.isBlank()) name = email;
        name = name.substring(0, Math.min(200, name.length()));
        UsuarioRole role = roles.contains("ADMIN") ? UsuarioRole.ADMIN : roles.contains("CURATOR") ? UsuarioRole.CURATOR : UsuarioRole.USER;
        // Serialize first access for the same subject across API instances. PostgreSQL can
        // arbitrate with coordinated account erasure using the same subject lock.
        // Transaction-scoped: released automatically on commit/rollback, no schema changes.
        jdbc.queryForObject("SELECT pg_advisory_xact_lock(hashtextextended(?, 0))",
            (rs, rowNum) -> Boolean.TRUE, jwt.getSubject());
        if (Boolean.TRUE.equals(jdbc.queryForObject("SELECT EXISTS (SELECT 1 FROM account_deletion WHERE subject_hash=?)",
                Boolean.class, AccountLifecycleService.hash(jwt.getSubject()))))
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Conta excluída ou exclusão em andamento.");
        Integer id = jdbc.queryForObject("""
            INSERT INTO public.usuario (keycloak_id, nome, email, role, ativo)
            VALUES (?, ?, ?, ?, true)
            ON CONFLICT (keycloak_id) DO UPDATE SET nome=EXCLUDED.nome, email=EXCLUDED.email,
                role=EXCLUDED.role, ativo=true
            RETURNING id_usuario
            """, Integer.class, jwt.getSubject(), name, email, role.name());
        return new LoginResponseDto(id, name, email, role);
    }
    @Transactional
    public Integer currentId() { return currentUser().id(); }
    @Transactional
    public Integer requireOwnId(Integer requested) {
        Integer id = currentId();
        if (!id.equals(requested)) throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Acesso restrito às suas submissões.");
        return id;
    }
}
