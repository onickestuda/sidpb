package com.nca.sistema_miiase_app.controller;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import java.time.Instant;
import java.util.*;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.HttpHeaders;
import org.springframework.security.oauth2.jwt.*;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import com.nca.sistema_miiase_app.config.SecurityConfig;
import com.nca.sistema_miiase_app.service.auth.*;
import com.nca.sistema_miiase_app.service.submission.SubmissionService;
import com.nca.sistema_miiase_app.service.curation.CurationService;
import com.nca.sistema_miiase_app.dto.response.auth.LoginResponseDto;
import com.nca.sistema_miiase_app.domain.entity.UsuarioRole;

@WebMvcTest({AuthController.class, CurationController.class, SubmissionController.class, AdminUsersController.class})
@Import(SecurityConfig.class)
class AuthControllerTest {
    @Autowired MockMvc mvc;
    @MockitoBean JwtDecoder decoder;
    @MockitoBean AuthService auth;
    @MockitoBean AccountLifecycleService lifecycle;
    @MockitoBean KeycloakGateway keycloak;
    @MockitoBean AdminUsersService adminUsers;
    @MockitoBean AdminAuditService adminAudit;
    @MockitoBean SubmissionService submissions;
    @MockitoBean CurationService curation;
    @MockitoBean com.nca.sistema_miiase_app.service.curation.CurationFacetService facets;
    void token(String role) {
        when(decoder.decode("valid")).thenReturn(Jwt.withTokenValue("valid").header("alg", "RS256")
            .subject("actor-sub").issuedAt(Instant.now()).expiresAt(Instant.now().plusSeconds(120))
            .claim("realm_access", Map.of("roles", List.of(role))).build());
    }
    @Test void anonymousAndInvalidTokensGet401() throws Exception {
        mvc.perform(get("/api/auth/me")).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/curation/submissions")).andExpect(status().isUnauthorized());
        when(decoder.decode("bad")).thenThrow(new BadJwtException("invalid"));
        mvc.perform(get("/api/auth/me").header(HttpHeaders.AUTHORIZATION,"Bearer bad")).andExpect(status().isUnauthorized());
    }
    @Test void deletionRequiresConfirmationAndUsesOnlyAuthenticatedSubject() throws Exception {
        mvc.perform(delete("/api/auth/me").contentType("application/json").content("{\"confirmation\":\"EXCLUIR\"}"))
            .andExpect(status().isUnauthorized());
        token("USER");
        var identity = decoder.decode("valid");
        when(auth.identity()).thenReturn(identity);
        mvc.perform(delete("/api/auth/me").header(HttpHeaders.AUTHORIZATION,"Bearer valid")
            .contentType("application/json").content("{\"confirmation\":\"no\"}"))
            .andExpect(status().isBadRequest());
        verifyNoInteractions(lifecycle);
        mvc.perform(delete("/api/auth/me").header(HttpHeaders.AUTHORIZATION,"Bearer valid")
            .contentType("application/json").content("{\"confirmation\":\"EXCLUIR\",\"userId\":\"victim\"}"))
            .andExpect(status().isAccepted());
        verify(lifecycle).request("actor-sub");
    }
    @Test void noPasswordLoginOrSelfElevation() throws Exception {
        token("USER");
        mvc.perform(post("/api/auth/login").header(HttpHeaders.AUTHORIZATION,"Bearer valid")).andExpect(status().isForbidden());
        mvc.perform(put("/api/admin/users/actor-sub/roles").header(HttpHeaders.AUTHORIZATION,"Bearer valid")
            .contentType("application/json").content("{\"roles\":[\"ADMIN\"]}")).andExpect(status().isForbidden());
        verifyNoInteractions(keycloak);
    }
    @Test void userCannotCurateOrAdminister() throws Exception {
        token("USER");
        mvc.perform(get("/api/curation/submissions").header(HttpHeaders.AUTHORIZATION,"Bearer valid")).andExpect(status().isForbidden());
        mvc.perform(get("/api/admin/users").header(HttpHeaders.AUTHORIZATION,"Bearer valid")).andExpect(status().isForbidden());
    }
    @Test void curatorInheritsUserButCannotAdminister() throws Exception {
        token("CURATOR");
        when(auth.currentUser()).thenReturn(new LoginResponseDto(3,"Curator","c@example.org",UsuarioRole.CURATOR));
        mvc.perform(get("/api/auth/me").header(HttpHeaders.AUTHORIZATION,"Bearer valid")).andExpect(status().isOk());
        mvc.perform(get("/api/curation/submissions").header(HttpHeaders.AUTHORIZATION,"Bearer valid")).andExpect(status().isOk());
        mvc.perform(get("/api/admin/users").header(HttpHeaders.AUTHORIZATION,"Bearer valid")).andExpect(status().isForbidden());
    }
    @Test void missingConfirmationReachesBusinessRuleAndMalformedBodyReturns400() throws Exception {
        token("ADMIN");
        when(adminUsers.change("target-sub","ADMIN",Map.of(),false)).thenThrow(
            new org.springframework.web.server.ResponseStatusException(org.springframework.http.HttpStatus.BAD_REQUEST,"Confirme explicitamente esta alteração."));
        mvc.perform(put("/api/admin/users/target-sub/roles").header(HttpHeaders.AUTHORIZATION,"Bearer valid")
            .contentType("application/json").content("{\"profile\":\"ADMIN\"}"))
            .andExpect(status().isBadRequest()).andExpect(jsonPath("$.message").value("Confirme explicitamente esta alteração."));
        verify(adminUsers).change("target-sub","ADMIN",Map.of(),false);
        mvc.perform(put("/api/admin/users/target-sub/roles").header(HttpHeaders.AUTHORIZATION,"Bearer valid")
            .contentType("application/json").content("{"))
            .andExpect(status().isBadRequest()).andExpect(jsonPath("$.message").exists());
    }
    @Test void adminInheritsCurationAndUser() throws Exception {
        token("ADMIN");
        when(keycloak.admin(eq(org.springframework.http.HttpMethod.GET), startsWith("/users?"), isNull(), eq(List.class))).thenReturn(List.of());
        mvc.perform(get("/api/auth/me").header(HttpHeaders.AUTHORIZATION,"Bearer valid")).andExpect(status().isOk());
        mvc.perform(get("/api/curation/submissions").header(HttpHeaders.AUTHORIZATION,"Bearer valid")).andExpect(status().isOk());
        mvc.perform(get("/api/admin/users").header(HttpHeaders.AUTHORIZATION,"Bearer valid")).andExpect(status().isOk());
    }
}
