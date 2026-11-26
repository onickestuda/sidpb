package com.nca.sistema_miiase_app.service.auth;

import java.time.Duration;
import java.util.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.stereotype.Service;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.web.client.RestClient;
import org.springframework.web.server.ResponseStatusException;

@Service
public class KeycloakGateway {
    private final RestClient client;
    private final String base, apiSecret, serviceSecret;
    public KeycloakGateway(@Value("${sidpb.auth.internal-url}") String base,
            @Value("${sidpb.auth.api-secret:}") String apiSecret,
            @Value("${sidpb.auth.service-secret:}") String serviceSecret) {
        this.base = base; this.apiSecret = apiSecret; this.serviceSecret = serviceSecret;
        var factory = new JdkClientHttpRequestFactory(java.net.http.HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(5)).build());
        factory.setReadTimeout(Duration.ofSeconds(10));
        this.client = RestClient.builder().requestFactory(factory).build();
    }
    public boolean active(String token) {
        try {
            var body = new LinkedMultiValueMap<String, String>();
            body.add("client_id", "sidpb-api"); body.add("client_secret", apiSecret); body.add("token", token);
            var result = client.post().uri(base + "/realms/sidpb/protocol/openid-connect/token/introspect")
                .contentType(MediaType.APPLICATION_FORM_URLENCODED).body(body).retrieve().body(Map.class);
            return result != null && Boolean.TRUE.equals(result.get("active"));
        } catch (Exception failure) { return false; } // Fail closed, never log tokens.
    }
    private String serviceToken() {
        var body = new LinkedMultiValueMap<String, String>();
        body.add("grant_type", "client_credentials"); body.add("client_id", "sidpb-admin-service");
        body.add("client_secret", serviceSecret);
        Map<?, ?> result = client.post().uri(base + "/realms/sidpb/protocol/openid-connect/token")
            .contentType(MediaType.APPLICATION_FORM_URLENCODED).body(body).retrieve().body(Map.class);
        if (result == null || !(result.get("access_token") instanceof String token)) throw new IllegalStateException("Service authentication unavailable");
        return token;
    }
    public <T> T admin(HttpMethod method, String path, Object body, Class<T> type) {
        String token;
        try { token = serviceToken(); } catch (Exception failure) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Autenticação administrativa indisponível.");
        }
        try {
            // Query values are encoded by the caller. URI avoids encoding '%' a second time.
            var request = client.method(method).uri(java.net.URI.create(base + "/admin/realms/sidpb" + path))
                .headers(headers -> headers.setBearerAuth(token));
            if (body != null) request.contentType(MediaType.APPLICATION_JSON).body(body);
            return request.retrieve().body(type);
        } catch (org.springframework.web.client.HttpClientErrorException.NotFound failure) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Usuário não encontrado.");
        } catch (org.springframework.web.client.HttpClientErrorException.Conflict failure) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Nome de usuário ou e-mail já utilizado.");
        } catch (Exception failure) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Administração do Keycloak indisponível.");
        }
    }
    public Optional<Map<?, ?>> findUser(String subject) {
        // A missing realm / misconfigured endpoint must never count as a deleted user.
        Map<?, ?> realm = admin(HttpMethod.GET, "", null, Map.class);
        if (realm == null || !"sidpb".equals(realm.get("realm")))
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Realm indisponível.");
        try {
            Map<?, ?> user = admin(HttpMethod.GET, AdminUsersService.path(subject), null, Map.class);
            if (user == null || !subject.equals(user.get("id")))
                throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Resposta de identidade inválida.");
            return Optional.of(user);
        } catch (ResponseStatusException failure) {
            if (failure.getStatusCode().value() == 404) return Optional.empty();
            throw failure;
        }
    }

}
