package com.nca.sistema_miiase_app.config;

import java.time.Instant;
import java.util.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnWebApplication;
import org.springframework.context.annotation.*;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.oauth2.core.*;
import org.springframework.security.oauth2.jwt.*;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationConverter;
import org.springframework.security.web.SecurityFilterChain;
import com.nca.sistema_miiase_app.service.auth.KeycloakGateway;
import com.nca.sistema_miiase_app.service.auth.AdminAuditService;

@Configuration
@org.springframework.security.config.annotation.web.configuration.EnableWebSecurity
@ConditionalOnWebApplication(type = ConditionalOnWebApplication.Type.SERVLET)
public class SecurityConfig {
    public static Set<String> roles(Jwt jwt) {
        Map<String, Object> realm = jwt.getClaimAsMap("realm_access");
        Set<String> roles = new HashSet<>();
        if (realm != null && realm.get("roles") instanceof Collection<?> values) {
            for (Object value : values) if (Set.of("USER", "CURATOR", "ADMIN").contains(value)) roles.add(value.toString());
        }
        if (roles.contains("ADMIN")) roles.add("CURATOR");
        if (roles.contains("CURATOR")) roles.add("USER");
        return roles;
    }

    public static OAuth2TokenValidator<Jwt> claimsValidator(String issuer, String audience) {
        OAuth2TokenValidator<Jwt> required = jwt -> {
            boolean valid = jwt.getAudience().contains(audience) && jwt.getSubject() != null
                && !jwt.getSubject().isBlank() && jwt.getExpiresAt() != null && jwt.getIssuedAt() != null
                && !jwt.getIssuedAt().isAfter(Instant.now().plusSeconds(30))
                && Boolean.TRUE.equals(jwt.getClaimAsBoolean("email_verified"));
            return valid ? OAuth2TokenValidatorResult.success() : OAuth2TokenValidatorResult.failure(
                new OAuth2Error("invalid_token", "Required identity claims are missing or invalid", null));
        };
        return new DelegatingOAuth2TokenValidator<>(JwtValidators.createDefaultWithIssuer(issuer), required);
    }

    @Bean JwtDecoder jwtDecoder(@Value("${sidpb.auth.issuer}") String issuer,
            @Value("${sidpb.auth.jwks}") String jwks, @Value("${sidpb.auth.audience}") String audience,
            KeycloakGateway keycloak, AdminAuditService audit) {
        var decoder = NimbusJwtDecoder.withJwkSetUri(jwks).build();
        decoder.setJwtValidator(claimsValidator(issuer, audience));
        // Validate signature/claims first; introspection then rejects disabled users and revoked sessions.
        return token -> {
            Jwt jwt = decoder.decode(token);
            if (!keycloak.active(token)) throw new BadJwtException("Session is no longer active");
            if (!audit.accepts(jwt)) throw new BadJwtException("Permissions changed; sign in again");
            return jwt;
        };
    }

    @Bean SecurityFilterChain security(HttpSecurity http) throws Exception {
        var converter = new JwtAuthenticationConverter();
        converter.setJwtGrantedAuthoritiesConverter(jwt -> roles(jwt).stream()
            .<org.springframework.security.core.GrantedAuthority>map(role -> new SimpleGrantedAuthority("ROLE_" + role)).toList());
        return http.csrf(csrf -> csrf.disable()) // Bearer-only API; browser CSRF is enforced at the BFF.
            .cors(cors -> {})
            .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .authorizeHttpRequests(auth -> auth
                .requestMatchers(HttpMethod.GET, "/api/mapa/**", "/api/occurrences", "/api/occurrences/**").permitAll()
                .requestMatchers("/api/auth/login").denyAll()
                .requestMatchers("/api/admin/**").hasRole("ADMIN")
                .requestMatchers("/api/curation/**").hasRole("CURATOR")
                .requestMatchers("/api/submissions/**", "/api/auth/me").hasRole("USER")
                .anyRequest().denyAll())
            .oauth2ResourceServer(resource -> resource.jwt(jwt -> jwt.jwtAuthenticationConverter(converter)))
            .build();
    }
}
