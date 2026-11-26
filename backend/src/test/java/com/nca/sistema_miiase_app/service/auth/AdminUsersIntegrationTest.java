package com.nca.sistema_miiase_app.service.auth;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.*;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.HttpMethod;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.web.server.ResponseStatusException;

@SpringBootTest(webEnvironment=SpringBootTest.WebEnvironment.NONE)
@ActiveProfiles("test")
class AdminUsersIntegrationTest {
    @Autowired AdminUsersService users;
    @Autowired AdminAuditService audit;
    @Autowired JdbcTemplate jdbc;
    @MockitoBean KeycloakGateway kc;
    final Map<String,Map<String,Object>> accounts=new ConcurrentHashMap<>();
    final Map<String,Set<String>> roles=new ConcurrentHashMap<>();
    volatile boolean failRemoval;
    @BeforeEach void setup() {
        jdbc.update("DELETE FROM public.admin_user_audit");
        accounts.clear(); roles.clear(); failRemoval=false;
        add("a","ADMIN");add("b","ADMIN");add("c","USER");
        when(kc.admin(any(),anyString(),any(),any())).thenAnswer(call -> remote(call.getArgument(0),call.getArgument(1),call.getArgument(2)));
        login("a");
    }
    void add(String id,String role) {
        accounts.put(id,new ConcurrentHashMap<>(Map.of("id",id,"firstName","Person "+id,"lastName","Test","username",id,"email",id+"@example.invalid","enabled",true,"emailVerified",true)));
        roles.put(id,ConcurrentHashMap.newKeySet());roles.get(id).addAll(Set.of(role,"offline_access"));
    }
    Jwt login(String id) {
        var jwt=Jwt.withTokenValue("test").header("alg","RS256").subject(id).issuedAt(Instant.now().minusSeconds(30)).expiresAt(Instant.now().plusSeconds(600)).claim("realm_access",Map.of("roles",List.of("ADMIN"))).build();
        SecurityContextHolder.getContext().setAuthentication(new JwtAuthenticationToken(jwt));return jwt;
    }
    @SuppressWarnings("unchecked")
    Object remote(HttpMethod method,String path,Object body) {
        if (path.startsWith("/roles/")) return Map.of("id",path.substring(7),"name",path.substring(7));
        if (path.startsWith("/users?")) return accounts.values().stream().sorted(Comparator.comparing(row->row.get("id").toString())).toList();
        String id=path.split("/")[2];
        if (path.endsWith("/logout")) return null;
        if (path.endsWith("/credentials")) return List.of(Map.of("type","password","secretData","never expose"));
        if (path.endsWith("/federated-identity")) return List.of(Map.of("identityProvider","google","userId","private-provider-id"));
        if (path.contains("/role-mappings/realm")) {
            if (method==HttpMethod.GET) {
                Set<String> values=new HashSet<>(roles.get(id));
                if (path.endsWith("/composite")) {if(values.contains("ADMIN"))values.add("CURATOR");if(values.contains("CURATOR"))values.add("USER");}
                return values.stream().map(role->Map.of("id",role,"name",role)).toList();
            }
            if (method==HttpMethod.DELETE && failRemoval) throw new IllegalStateException("simulated timeout");
            for (var role:(List<Map<String,Object>>)body) {
                if(method==HttpMethod.POST)roles.get(id).add(role.get("name").toString());else roles.get(id).remove(role.get("name").toString());
            }
            return null;
        }
        if (method==HttpMethod.PUT) {accounts.get(id).putAll((Map<String,Object>)body);return null;}
        return accounts.get(id);
    }
    @AfterEach void clear() {SecurityContextHolder.clearContext();}
    @Test void profilesAreCanonicalAndInternalRolesSurviveWithAuditedActor() {
        assertEquals("CURATOR",users.change("c","CURATOR",Map.of(),false).profile());
        assertEquals("ADMIN",users.change("c","ADMIN",Map.of(),true).profile());
        assertEquals("USER",users.change("c","USER",Map.of(),true).profile());
        assertEquals(Set.of("USER","offline_access"),roles.get("c"));
        var rows=audit.list("c",0,20);
        assertEquals(3,rows.size());assertTrue(rows.stream().allMatch(row->row.get("actor_sub").equals("a")&&row.get("result").equals("SUCCESS")));
        assertEquals("Person a Test",rows.getFirst().get("actor_name"));
        verify(kc,times(3)).admin(eq(HttpMethod.POST),eq("/users/c/logout"),isNull(),eq(Void.class));
    }
    @Test void ownAccessAndConfirmationAndInternalRolesAreProtected() {
        assertThrows(ResponseStatusException.class,()->users.change("a","USER",Map.of(),true));
        assertThrows(ResponseStatusException.class,()->users.change("a",null,Map.of("enabled",false),true));
        assertThrows(ResponseStatusException.class,()->users.change("c","ADMIN",Map.of(),false));
        assertThrows(ResponseStatusException.class,()->users.change("c","realm-admin",Map.of(),true));
        assertTrue(audit.list("",0,20).isEmpty());
        roles.get("b").remove("ADMIN");
        assertThrows(ResponseStatusException.class,()->users.change("a","USER",Map.of(),true));
        assertEquals("ADMIN",users.details("a").user().profile());
    }
    @Test void staleAdministratorCannotWinConcurrentMutualRemoval() throws Exception {
        var start=new CountDownLatch(1);
        try(var pool=Executors.newFixedThreadPool(2)) {
            List<Future<Boolean>> results=new ArrayList<>();
            for(String actor:List.of("a","b"))results.add(pool.submit(()->{
                login(actor);start.await();
                try {users.change(actor.equals("a")?"b":"a","USER",Map.of(),true);return true;}
                catch(ResponseStatusException denied){assertEquals(403,denied.getStatusCode().value());return false;}
                finally{SecurityContextHolder.clearContext();}
            }));
            start.countDown();int successes=0;for(var result:results)if(result.get(20,TimeUnit.SECONDS))successes++;
            assertEquals(1,successes);assertEquals(1,roles.values().stream().filter(r->r.contains("ADMIN")).count());
            assertEquals(1,audit.list("",0,20).size());
        }
    }
    @Test void failedRemoteMutationIsDurablePartialAndOldTokensAreRejected() {
        var token=login("c");login("a");failRemoval=true;
        assertThrows(IllegalStateException.class,()->users.change("c","CURATOR",Map.of(),false));
        assertEquals("PARTIAL",audit.list("c",0,20).getFirst().get("result"));
        assertFalse(audit.accepts(token));
        verify(kc).admin(eq(HttpMethod.POST),eq("/users/c/logout"),isNull(),eq(Void.class));
    }
    @Test void statusAndCredentialProjectionAreSafe() {
        assertFalse(users.change("c",null,Map.of("enabled",false),true).enabled());
        assertTrue(users.change("c",null,Map.of("enabled",true),false).enabled());
        assertEquals(List.of("E-mail e senha","Google"),users.details("c").authenticationMethods());
        assertFalse(users.details("c").toString().contains("secretData"));
        assertEquals(2,users.list(0,20,"","",null,true).items().size());
        assertEquals("USER",users.list(0,20,"","USER",null,false).items().getFirst().profile());
    }
    @Test void orphanErasureIsExplicitIdempotentAndNeverDeletesALinkedIdentity() {
        String address=UUID.randomUUID()+"@example.invalid";
        int local=jdbc.queryForObject("INSERT INTO usuario(nome,email,role,ativo) VALUES ('Orphan',?,'USER',true) RETURNING id_usuario",Integer.class,address);
        assertEquals(400,assertThrows(ResponseStatusException.class,()->users.eraseOrphan(local,"no")).getStatusCode().value());
        login("c");assertEquals(403,assertThrows(ResponseStatusException.class,()->users.eraseOrphan(local,"EXCLUIR")).getStatusCode().value());
        login("a");
        jdbc.update("UPDATE usuario SET keycloak_id='linked-fixture' WHERE id_usuario=?",local);
        assertEquals(409,assertThrows(ResponseStatusException.class,()->users.eraseOrphan(local,"EXCLUIR")).getStatusCode().value());
        jdbc.update("UPDATE usuario SET keycloak_id=NULL WHERE id_usuario=?",local);
        users.eraseOrphan(local,"EXCLUIR");users.eraseOrphan(local,"EXCLUIR");
        var row=jdbc.queryForMap("SELECT * FROM usuario WHERE id_usuario=?",local);
        assertNull(row.get("email"));assertNotNull(row.get("deleted_at"));assertEquals(false,row.get("ativo"));
        assertEquals(1,audit.list("local-orphan-"+local,0,20).size());
        verify(kc,never()).admin(eq(HttpMethod.DELETE),anyString(),any(),any());
    }
}
