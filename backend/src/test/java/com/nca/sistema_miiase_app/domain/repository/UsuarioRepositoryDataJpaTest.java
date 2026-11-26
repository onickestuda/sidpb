package com.nca.sistema_miiase_app.domain.repository;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.Map;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.data.jpa.test.autoconfigure.DataJpaTest;
import org.springframework.boot.jdbc.test.autoconfigure.AutoConfigureTestDatabase;
import org.springframework.test.context.ActiveProfiles;

import com.nca.sistema_miiase_app.domain.entity.UsuarioRole;

@DataJpaTest
@ActiveProfiles("test")
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
class UsuarioRepositoryDataJpaTest {
    @Autowired
    private UsuarioRepository usuarioRepository;

    @Test
    void deveConsultarOsTresPerfisCriadosPeloFlywayNoPostgres() {
        var perfis = Map.of(
                "admin@sidpb.local", UsuarioRole.ADMIN,
                "curador@sidpb.local", UsuarioRole.CURATOR,
                "usuario@sidpb.local", UsuarioRole.USER);

        perfis.forEach((email, role) -> {
            var usuario = usuarioRepository.findByEmail(email).orElseThrow();
            assertEquals(role, usuario.getRole());
            assertTrue(usuario.isAtivo());
            assertNotNull(usuario.getId());
            assertNotNull(usuario.getCreatedAt());
        });
    }

    @Test
    void deveRetornarVazioParaEmailInexistente() {
        assertTrue(usuarioRepository.findByEmail("inexistente@sidpb.local").isEmpty());
    }
}
