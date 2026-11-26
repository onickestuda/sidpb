package com.nca.sistema_miiase_app.service.auth;
import static org.junit.jupiter.api.Assertions.*;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.*;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.web.server.ResponseStatusException;

@SpringBootTest(webEnvironment=SpringBootTest.WebEnvironment.NONE)
@ActiveProfiles("test")
class IdentityIntegrationTest {
    @Autowired AuthService auth;
    @Autowired JdbcTemplate jdbc;
    @AfterEach void clear() { SecurityContextHolder.clearContext(); }
    void login(String sub, String email, String name) {
        var jwt = Jwt.withTokenValue("test").header("alg","RS256").subject(sub)
            .issuedAt(Instant.now()).expiresAt(Instant.now().plusSeconds(120))
            .claim("email",email).claim("name",name).claim("email_verified",true)
            .claim("realm_access",Map.of("roles",List.of("USER"))).build();
        SecurityContextHolder.getContext().setAuthentication(new JwtAuthenticationToken(jwt));
    }
    @Test void concurrentFirstLoginIsIdempotentAndProfileChangesPreserveId() throws Exception {
        String sub = UUID.randomUUID().toString(), email = sub+"@example.org";
        try (var executor = Executors.newFixedThreadPool(6)) {
            List<Callable<Integer>> tasks = new ArrayList<>();
            for (int i=0;i<12;i++) tasks.add(() -> {
                login(sub,email,"Original");
                try { return auth.currentId(); } finally { SecurityContextHolder.clearContext(); }
            });
            Set<Integer> ids = new HashSet<>();
            for (var result : executor.invokeAll(tasks)) ids.add(result.get());
            assertEquals(1, ids.size());
            login(sub,"changed-"+email,"Changed name");
            var current = auth.currentUser();
            assertEquals(ids.iterator().next(), current.id());
            assertEquals("Changed name",current.name());
            assertEquals("changed-"+email,current.email());
            assertEquals(1,jdbc.queryForObject("SELECT count(*) FROM usuario WHERE keycloak_id=?",Integer.class,sub));
        }
    }
    @Test void legacyEmailDoesNotLinkOrChangeHistory() {
        String email = UUID.randomUUID()+"@example.invalid";
        int orphan = jdbc.queryForObject("INSERT INTO usuario(nome,email,role,ativo) VALUES ('Historical fixture',?,'USER',true) RETURNING id_usuario",Integer.class,email);
        var before = jdbc.queryForMap("SELECT id_usuario,keycloak_id FROM usuario WHERE id_usuario=?",orphan);
        login(UUID.randomUUID().toString(),email,"New identity");
        assertNotEquals(before.get("id_usuario"), auth.currentUser().id());
        assertEquals(before,jdbc.queryForMap("SELECT id_usuario,keycloak_id FROM usuario WHERE id_usuario=?", before.get("id_usuario")));
        assertEquals(0,jdbc.queryForObject("SELECT count(*) FROM usuario WHERE password_hash IS NOT NULL",Integer.class));
    }
}
