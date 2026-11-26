package com.nca.sistema_miiase_app.service.auth;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.*;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.web.server.ResponseStatusException;

@SpringBootTest(webEnvironment=SpringBootTest.WebEnvironment.NONE)
@ActiveProfiles("test")
class AccountLifecycleIntegrationTest {
    @Autowired AccountLifecycleService lifecycle;
    @Autowired AuthService auth;
    @Autowired AdminAuditService audit;
    @Autowired JdbcTemplate jdbc;
    @MockitoBean KeycloakGateway kc;
    final Map<String, Map<?,?>> remote = new ConcurrentHashMap<>();
    String sub, email; int id;
    Jwt login(String subject, String address) {
        var jwt = Jwt.withTokenValue("test").header("alg","RS256").subject(subject)
            .issuedAt(Instant.now()).expiresAt(Instant.now().plusSeconds(120))
            .claim("email",address).claim("name","Scientific contributor").claim("email_verified",true)
            .claim("realm_access",Map.of("roles",List.of("USER"))).build();
        SecurityContextHolder.getContext().setAuthentication(new JwtAuthenticationToken(jwt)); return jwt;
    }
    @BeforeEach void setup() {
        sub=UUID.randomUUID().toString(); email=sub+"@example.invalid";
        remote.put(sub,Map.of("id",sub,"enabled",true));
        // Unknown fixtures from other tests are treated as existing; never erase by omission in mocks.
        when(kc.findUser(anyString())).thenAnswer(call -> Optional.ofNullable(remote.getOrDefault(call.getArgument(0), Map.of("enabled",true))));
        when(kc.admin(eq(HttpMethod.GET),endsWith("/role-mappings/realm/composite"),isNull(),eq(List.class))).thenReturn(List.of(Map.of("name","USER")));
        when(kc.admin(eq(HttpMethod.DELETE),anyString(),isNull(),eq(Void.class))).thenAnswer(call -> {
            String subject=((String)call.getArgument(1)).substring("/users/".length());
            when(kc.findUser(subject)).thenReturn(Optional.empty()); return null;
        });
        login(sub,email); id=auth.currentId();
    }
    @AfterEach void clear() { SecurityContextHolder.clearContext(); }
    Map<String,Object> row() { return jdbc.queryForMap("SELECT * FROM usuario WHERE id_usuario=?",id); }
    int submission() {
        return jdbc.queryForObject("""
            INSERT INTO submissao_artigo(id_usuario,id_curador,titulo,link_original,pdf_path,pdf_nome,pdf_tamanho,status,dados_usuario,dados_curados,reviewed_at)
            VALUES (?,?,'Original article','https://example.invalid/article','preserved.pdf','paper.pdf',100,'APPROVED',
                '{"authors":["Original Bibliographic Author"],"title":"Original article"}',
                '{"authors":["Original Bibliographic Author"]}',CURRENT_TIMESTAMP) RETURNING id_submissao
            """, Integer.class,id,id);
    }
    @Test void deletionPreservesScientificSnapshotsAndNewRegistrationHasNoOwnership() {
        int article=submission();
        var science=jdbc.queryForMap("SELECT * FROM submissao_artigo WHERE id_submissao=?",article);
        long event=audit.begin(sub,"Personal name",sub,"Private email", "ACCOUNT_UPDATE",Map.of("email",email,"firstName","Private"));
        audit.finish(event,Map.of("email",email),"SUCCESS");
        jdbc.update("INSERT INTO usuario_identity_link_audit(id_usuario,keycloak_id,approval_reference) VALUES (?,?,?)",id,sub,email);
        lifecycle.request(sub);
        assertNull(row().get("email")); assertNull(row().get("keycloak_id")); assertEquals("Conta excluída",row().get("nome"));
        assertNotNull(row().get("deleted_at")); assertEquals(false,row().get("ativo"));
        assertEquals(science,jdbc.queryForMap("SELECT * FROM submissao_artigo WHERE id_submissao=?",article));
        assertEquals(0,jdbc.queryForObject("SELECT count(*) FROM usuario_identity_link_audit WHERE id_usuario=?",Integer.class,id));
        var log=jdbc.queryForMap("SELECT * FROM admin_user_audit WHERE id=?",event);
        assertEquals("deleted",log.get("actor_sub")); assertEquals("deleted",log.get("target_sub"));
        assertFalse(log.toString().contains(email));
        assertEquals("COMPLETE",jdbc.queryForObject("SELECT state FROM account_deletion WHERE subject_hash=?",String.class,AccountLifecycleService.hash(sub)));
        assertNull(jdbc.queryForObject("SELECT subject FROM account_deletion WHERE subject_hash=?",String.class,AccountLifecycleService.hash(sub)));
        assertFalse(audit.accepts(login(sub,email)));
        assertEquals(401,assertThrows(ResponseStatusException.class,auth::currentUser).getStatusCode().value());
        login(UUID.randomUUID().toString(),email); int fresh=auth.currentId(); assertNotEquals(id,fresh);
        assertEquals(0,jdbc.queryForObject("SELECT count(*) FROM submissao_artigo WHERE id_usuario=? OR id_curador=?",Integer.class,fresh,fresh));
        lifecycle.process(sub); // idempotent after completion
        assertEquals(science,jdbc.queryForMap("SELECT * FROM submissao_artigo WHERE id_submissao=?",article));
    }
    @Test void publishedArticlesOccurrencesAndAllSubmissionStatesSurviveErasure() {
        int geo=8000000+id;
        jdbc.update("INSERT INTO regiao(id_regiao,sigla,nome) VALUES (?,'ZZ',?)",geo,sub);
        jdbc.update("INSERT INTO estado(id_estado,sigla,nome,id_regiao) VALUES (?,'ZZ',?,?)",geo,sub,geo);
        jdbc.update("INSERT INTO municipio(id_municipio,nome,id_estado) VALUES (?,?,?)",geo,sub,geo);
        int location=jdbc.queryForObject("INSERT INTO local(id_municipio) VALUES (?) RETURNING id_local",Integer.class,geo);
        int category=jdbc.queryForObject("INSERT INTO categoria_hospedeiro(nome_categoria) VALUES (?) RETURNING id_categoria",Integer.class,sub);
        int host=jdbc.queryForObject("INSERT INTO hospedeiro(nome_cientifico,id_categoria) VALUES (?,?) RETURNING id_hospedeiro",Integer.class,sub,category);
        int disease=jdbc.queryForObject("INSERT INTO doenca(nome_cientifico) VALUES (?) RETURNING id_doenca",Integer.class,sub);
        int parasite=jdbc.queryForObject("INSERT INTO parasito(nome_cientifico) VALUES (?) RETURNING id_parasito",Integer.class,sub);
        jdbc.update("INSERT INTO doenca_parasito VALUES (?,?)",disease,parasite);
        int occurrence=jdbc.queryForObject("INSERT INTO ocorrencia(id_hospedeiro,id_doenca,id_parasito,id_local) VALUES (?,?,?,?) RETURNING id_ocorrencia",Integer.class,host,disease,parasite,location);
        int source=jdbc.queryForObject("INSERT INTO fonte(titulo,autores) VALUES ('Scientific record','[\"Scientific contributor\"]') RETURNING id_fonte",Integer.class);
        jdbc.update("INSERT INTO ocorrencia_fonte VALUES (?,?)",occurrence,source);
        int approved=submission(), rejected=submission(), pending=submission();
        jdbc.update("UPDATE submissao_artigo SET status='REJECTED',dados_curados=NULL,rejection_reason='Scientific review' WHERE id_submissao=?",rejected);
        jdbc.update("UPDATE submissao_artigo SET status='PENDING',id_curador=NULL,dados_curados=NULL,reviewed_at=NULL WHERE id_submissao=?",pending);
        var rows=jdbc.queryForList("SELECT * FROM submissao_artigo WHERE id_submissao IN (?,?,?) ORDER BY id_submissao",approved,rejected,pending);
        var originalSource=jdbc.queryForMap("SELECT * FROM fonte WHERE id_fonte=?",source);
        var originalOccurrence=jdbc.queryForMap("SELECT * FROM ocorrencia WHERE id_ocorrencia=?",occurrence);
        lifecycle.request(sub);
        assertEquals(rows,jdbc.queryForList("SELECT * FROM submissao_artigo WHERE id_submissao IN (?,?,?) ORDER BY id_submissao",approved,rejected,pending));
        assertEquals(originalSource,jdbc.queryForMap("SELECT * FROM fonte WHERE id_fonte=?",source));
        assertEquals(originalOccurrence,jdbc.queryForMap("SELECT * FROM ocorrencia WHERE id_ocorrencia=?",occurrence));
        assertEquals(1,jdbc.queryForObject("SELECT count(*) FROM ocorrencia_fonte WHERE id_ocorrencia=? AND id_fonte=?",Integer.class,occurrence,source));
        assertThrows(org.springframework.dao.DataIntegrityViolationException.class,()->jdbc.update("DELETE FROM usuario WHERE id_usuario=?",id));
    }
    @Test void consoleDeletionIsReconciledWithoutExplicitRequest() {
        submission(); when(kc.findUser(sub)).thenReturn(Optional.empty());
        lifecycle.reconcile(); assertNotNull(row().get("deleted_at")); assertTrue(lifecycle.blocked(sub));
        verify(kc,never()).admin(eq(HttpMethod.DELETE),eq("/users/"+sub),any(),any());
    }
    @Test void consoleDeletionAlsoErasesAuditOfAnAccountThatNeverLoggedIn() {
        String remoteOnly=UUID.randomUUID().toString();
        long event=audit.begin(sub,"Current administrator",remoteOnly,"Private remote profile","ACCOUNT_UPDATE",Map.of("email","remote-private@example.invalid"));
        audit.finish(event,Map.of("email","remote-private@example.invalid"),"SUCCESS");
        when(kc.findUser(remoteOnly)).thenReturn(Optional.empty());
        lifecycle.reconcile();
        var row=jdbc.queryForMap("SELECT * FROM admin_user_audit WHERE id=?",event);
        assertEquals("deleted",row.get("target_sub"));assertFalse(row.toString().contains("remote-private"));
        assertTrue(lifecycle.blocked(remoteOnly));
        assertEquals(0,jdbc.queryForObject("SELECT count(*) FROM account_identity_watch WHERE subject=?",Integer.class,remoteOnly));
    }
    @Test void disableAndReactivatePreserveIdentityAndHistory() {
        int article=submission(); var science=jdbc.queryForMap("SELECT * FROM submissao_artigo WHERE id_submissao=?",article);
        when(kc.findUser(sub)).thenReturn(Optional.of(Map.of("id",sub,"enabled",false)));
        lifecycle.reconcile(); assertEquals(false,row().get("ativo")); assertNull(row().get("deleted_at")); assertEquals(email,row().get("email"));
        assertFalse(lifecycle.blocked(sub));
        when(kc.findUser(sub)).thenReturn(Optional.of(Map.of("id",sub,"enabled",true)));
        lifecycle.reconcile(); login(sub,email); assertEquals(id,auth.currentId());
        assertEquals(science,jdbc.queryForMap("SELECT * FROM submissao_artigo WHERE id_submissao=?",article));
    }
    @Test void unavailableProviderCannotBeMistakenForDeletion() {
        for (HttpStatus status : List.of(HttpStatus.BAD_GATEWAY,HttpStatus.FORBIDDEN,HttpStatus.UNAUTHORIZED)) {
            when(kc.findUser(sub)).thenThrow(new ResponseStatusException(status));
            lifecycle.reconcile(); assertEquals(email,row().get("email")); assertNull(row().get("deleted_at")); assertFalse(lifecycle.blocked(sub));
            reset(kc);
        }
    }
    @Test void timeoutKeepsDurableIntentBlocksAccessAndRetries() {
        when(kc.admin(eq(HttpMethod.DELETE),eq("/users/"+sub),isNull(),eq(Void.class))).thenThrow(new ResponseStatusException(HttpStatus.BAD_GATEWAY));
        lifecycle.request(sub); assertTrue(lifecycle.blocked(sub)); assertEquals(email,row().get("email"));
        assertEquals(401,assertThrows(ResponseStatusException.class,auth::currentId).getStatusCode().value());
        // Remote DELETE may have succeeded despite the timeout. An authenticated 404 closes the intent.
        when(kc.findUser(sub)).thenReturn(Optional.empty()); lifecycle.process(sub);
        assertNull(row().get("email")); assertNotNull(row().get("deleted_at"));
    }
    @Test void databaseFailureAfterRemoteDeletionIsRetriedWithoutLosingScience() {
        int article=submission(); var science=jdbc.queryForMap("SELECT * FROM submissao_artigo WHERE id_submissao=?",article);
        jdbc.execute("ALTER TABLE usuario ADD CONSTRAINT simulated_erasure_failure CHECK (deleted_at IS NULL OR id_usuario <> "+id+")");
        try {
            lifecycle.request(sub); assertTrue(lifecycle.blocked(sub)); assertEquals(email,row().get("email"));
            assertEquals("PENDING",jdbc.queryForObject("SELECT state FROM account_deletion WHERE subject_hash=?",String.class,AccountLifecycleService.hash(sub)));
        } finally { jdbc.execute("ALTER TABLE usuario DROP CONSTRAINT simulated_erasure_failure"); }
        lifecycle.process(sub); assertNull(row().get("email"));
        assertEquals(science,jdbc.queryForMap("SELECT * FROM submissao_artigo WHERE id_submissao=?",article));
    }
    @Test void administratorsAndTechnicalAccountsCannotBeAccidentallyDeleted() {
        when(kc.admin(eq(HttpMethod.GET),eq("/users/"+sub+"/role-mappings/realm/composite"),isNull(),eq(List.class))).thenReturn(List.of(Map.of("name","ADMIN")));
        assertEquals(409,assertThrows(ResponseStatusException.class,()->lifecycle.request(sub)).getStatusCode().value());
        assertFalse(lifecycle.blocked(sub));
        when(kc.findUser(sub)).thenReturn(Optional.of(Map.of("id",sub,"serviceAccountClientId","internal")));
        assertEquals(403,assertThrows(ResponseStatusException.class,()->lifecycle.request(sub)).getStatusCode().value());
    }
    @Test void concurrentDeletionAndLoginCannotResurrectOldSubject() throws Exception {
        try (var pool=Executors.newFixedThreadPool(4)) {
            List<Callable<Void>> work=new ArrayList<>();
            work.add(()->{lifecycle.request(sub);return null;});
            for(int n=0;n<8;n++) work.add(()->{
                login(sub,email);
                try { auth.currentUser(); } catch(ResponseStatusException expected) { assertEquals(401,expected.getStatusCode().value()); }
                finally { SecurityContextHolder.clearContext(); } return null;
            });
            for(var future:pool.invokeAll(work)) future.get();
        }
        lifecycle.process(sub); assertNull(row().get("email"));
        assertEquals(0,jdbc.queryForObject("SELECT count(*) FROM usuario WHERE keycloak_id=?",Integer.class,sub));
    }
}
