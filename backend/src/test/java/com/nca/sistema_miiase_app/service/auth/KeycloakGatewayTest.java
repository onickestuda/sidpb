package com.nca.sistema_miiase_app.service.auth;

import static org.junit.jupiter.api.Assertions.*;
import com.sun.net.httpserver.HttpServer;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import org.junit.jupiter.api.*;
import org.springframework.web.server.ResponseStatusException;

class KeycloakGatewayTest {
    HttpServer server; KeycloakGateway gateway;
    int tokenStatus=200, realmStatus=200, userStatus=200;
    String realm="{\"realm\":\"sidpb\"}", user="{\"id\":\"fixture\",\"enabled\":false}";
    @BeforeEach void start() throws Exception {
        server=HttpServer.create(new InetSocketAddress("localhost",0),0);
        server.createContext("/", exchange -> {
            String path=exchange.getRequestURI().getPath(); int status; String body;
            if(path.endsWith("/token")) {status=tokenStatus;body="{\"access_token\":\"isolated-service-token\"}";}
            else if(path.endsWith("/admin/realms/sidpb")) {status=realmStatus;body=realm;}
            else {status=userStatus;body=user;}
            byte[] bytes=body.getBytes(StandardCharsets.UTF_8);
            exchange.getResponseHeaders().set("Content-Type","application/json");
            exchange.sendResponseHeaders(status,bytes.length);exchange.getResponseBody().write(bytes);exchange.close();
        });
        server.start(); gateway=new KeycloakGateway("http://localhost:"+server.getAddress().getPort(),"test","test");
    }
    @AfterEach void stop() {server.stop(0);}
    @Test void disabledIsPresentAndOnlyAuthenticatedUser404MeansMissing() {
        assertEquals(false,gateway.findUser("fixture").orElseThrow().get("enabled"));
        userStatus=404;assertTrue(gateway.findUser("fixture").isEmpty());
        userStatus=403;assertEquals(502,assertThrows(ResponseStatusException.class,()->gateway.findUser("fixture")).getStatusCode().value());
        userStatus=500;assertThrows(ResponseStatusException.class,()->gateway.findUser("fixture"));
    }
    @Test void missingRealmOrTokenEndpointNeverMeansDeletedAccount() {
        realmStatus=404;userStatus=404;
        assertThrows(ResponseStatusException.class,()->gateway.findUser("fixture"));
        realmStatus=200;tokenStatus=404;
        assertEquals(502,assertThrows(ResponseStatusException.class,()->gateway.findUser("fixture")).getStatusCode().value());
    }
    @Test void malformedOrWrongRealmResponsesFailClosed() {
        realm="{\"realm\":\"other\"}";assertThrows(ResponseStatusException.class,()->gateway.findUser("fixture"));
        realm="{\"realm\":\"sidpb\"}";user="{}";assertThrows(ResponseStatusException.class,()->gateway.findUser("fixture"));
        user="{\"id\":\"another-person\"}";assertThrows(ResponseStatusException.class,()->gateway.findUser("fixture"));
    }
}
