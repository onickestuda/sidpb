package com.nca.sistema_miiase_app.service.auth;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import java.time.Instant;
import java.util.*;
import org.junit.jupiter.api.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.web.server.ResponseStatusException;
import com.nca.sistema_miiase_app.config.SecurityConfig;

class AuthServiceTest {
    @AfterEach void clear() { SecurityContextHolder.clearContext(); }
    static Jwt jwt(String role, String issuer, List<String> audience, Instant expires, boolean verified) {
        return Jwt.withTokenValue("test").header("alg", "RS256").subject("stable-sub")
            .issuer(issuer).audience(audience).issuedAt(Instant.now().minusSeconds(600)).expiresAt(expires)
            .claim("email", "user@example.org").claim("email_verified", verified)
            .claim("realm_access", Map.of("roles", List.of(role))).build();
    }
    @Test void hierarchyAndClaims() {
        var admin = jwt("ADMIN", "https://issuer", List.of("sidpb-api"), Instant.now().plusSeconds(120), true);
        assertEquals(Set.of("ADMIN", "CURATOR", "USER"), SecurityConfig.roles(admin));
        var validator = SecurityConfig.claimsValidator("https://issuer", "sidpb-api");
        assertFalse(validator.validate(admin).hasErrors());
        assertTrue(validator.validate(jwt("USER", "https://wrong", List.of("sidpb-api"), Instant.now().plusSeconds(120), true)).hasErrors());
        assertTrue(validator.validate(jwt("USER", "https://issuer", List.of("other"), Instant.now().plusSeconds(120), true)).hasErrors());
        assertTrue(validator.validate(jwt("USER", "https://issuer", List.of("sidpb-api"), Instant.now().minusSeconds(120), true)).hasErrors());
        assertTrue(validator.validate(jwt("USER", "https://issuer", List.of("sidpb-api"), Instant.now().plusSeconds(120), false)).hasErrors());
        assertEquals(Set.of("USER", "CURATOR"), SecurityConfig.roles(jwt("CURATOR", "https://issuer", List.of("sidpb-api"), Instant.now().plusSeconds(120), true)));
    }
    @Test void rejectsAnonymousIdentityAndUnverifiedEmail() {
        var service = new AuthService(mock(JdbcTemplate.class));
        assertEquals(401, assertThrows(ResponseStatusException.class, service::currentId).getStatusCode().value());
        SecurityContextHolder.getContext().setAuthentication(new JwtAuthenticationToken(jwt("USER", "https://issuer", List.of("sidpb-api"), Instant.now().plusSeconds(120), false)));
        assertEquals(403, assertThrows(ResponseStatusException.class, service::currentId).getStatusCode().value());
    }
    @Test void refusesForgedUserId() {
        var service = spy(new AuthService(mock(JdbcTemplate.class)));
        doReturn(3).when(service).currentId();
        assertEquals(3, service.requireOwnId(3));
        assertEquals(403, assertThrows(ResponseStatusException.class, () -> service.requireOwnId(1)).getStatusCode().value());
    }
}
