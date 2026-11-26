package com.nca.sistema_miiase_app.service.auth;
import java.util.*;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import org.springframework.http.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.server.ResponseStatusException;

@Service
public class AdminUsersService {
    public static final Set<String> ROLES = Set.of("USER","CURATOR","ADMIN");
    private final KeycloakGateway kc;
    private final AuthService auth;
    private final AdminAuditService audit;
    private final JdbcTemplate jdbc;
    private final TransactionTemplate transaction;
    public AdminUsersService(KeycloakGateway kc, AuthService auth, AdminAuditService audit, JdbcTemplate jdbc, PlatformTransactionManager manager) {
        this.kc=kc; this.auth=auth; this.audit=audit; this.jdbc=jdbc; transaction=new TransactionTemplate(manager);
    }
    public record UserView(String id, String username, String firstName, String lastName, String email,
        boolean enabled, boolean emailVerified, List<String> roles, List<String> effectiveRoles,
        String profile, Long createdTimestamp, boolean self, Long reviews) {}
    public record Page(List<UserView> items, Integer nextFirst) {}
    public record Details(UserView user, List<String> authenticationMethods) {}
    public static String path(String id) {
        if (id == null || !id.matches("[a-zA-Z0-9-]{1,255}")) throw error(HttpStatus.BAD_REQUEST,"Usuário inválido.");
        return "/users/"+id;
    }
    static ResponseStatusException error(HttpStatus status, String text) { return new ResponseStatusException(status,text); }
    @SuppressWarnings("unchecked")
    private List<Map<String,Object>> rows(String path) { return kc.admin(HttpMethod.GET,path,null,List.class); }
    private List<String> names(String path) { return rows(path).stream().map(row -> (String)row.get("name")).filter(ROLES::contains).sorted().toList(); }
    public Map<?,?> human(String id) {
        Map<?,?> user=kc.admin(HttpMethod.GET,path(id),null,Map.class);
        if (user.get("serviceAccountClientId") != null) throw error(HttpStatus.FORBIDDEN,"Contas técnicas não são gerenciadas nesta área.");
        return user;
    }
    private String text(Map<?,?> row,String key) { return Objects.toString(row.get(key),""); }
    private UserView view(Map<?,?> row, boolean activity) {
        String id=text(row,"id");
        var direct=names(path(id)+"/role-mappings/realm");
        var effective=names(path(id)+"/role-mappings/realm/composite");
        String profile=effective.contains("ADMIN") ? "ADMIN" : effective.contains("CURATOR") ? "CURATOR" : "USER";
        Long reviews=activity ? jdbc.queryForObject("SELECT count(*) FROM public.submissao_artigo s JOIN public.usuario u ON u.id_usuario=s.id_curador WHERE u.keycloak_id=? AND s.reviewed_at IS NOT NULL",Long.class,id) : null;
        return new UserView(id,text(row,"username"),text(row,"firstName"),text(row,"lastName"),text(row,"email"),
            Boolean.TRUE.equals(row.get("enabled")),Boolean.TRUE.equals(row.get("emailVerified")),direct,effective,profile,
            row.get("createdTimestamp") instanceof Number n ? n.longValue() : null,id.equals(auth.identity().getSubject()),reviews);
    }
    public Page list(int first,int max,String search,String profile,Boolean enabled,boolean team) {
        if (first<0 || max<1 || max>50 || search.length()>200 || (!profile.isEmpty() && !ROLES.contains(profile))) throw error(HttpStatus.BAD_REQUEST,"Filtro inválido.");
        List<UserView> result=new ArrayList<>(); int cursor=first;
        // Search/status are server-side; profile filtering uses bounded windows and an exact continuation cursor.
        for (int scanned=0; scanned<60;) {
            int batchSize=Math.min(20,60-scanned);
            var batch=rows("/users?first="+cursor+"&max="+batchSize+"&search="+URLEncoder.encode(search,StandardCharsets.UTF_8)
                +(enabled == null ? "" : "&enabled="+enabled));
            if (batch.isEmpty()) return new Page(result,null);
            for (var row:batch) {
                cursor++; scanned++;
                if (row.get("serviceAccountClientId") != null) continue;
                var user=view(row,team);
                if ((!profile.isEmpty() && !profile.equals(user.profile())) || (team && "USER".equals(user.profile()))) continue;
                result.add(user);
                if (result.size()==max) return new Page(result,cursor);
            }
            if (batch.size()<batchSize) return new Page(result,null);
        }
        return new Page(result,cursor);
    }
    public Details details(String id) {
        var user=view(human(id),true); List<String> methods=new ArrayList<>();
        // Strict projection: credential objects and federated identifiers never leave this service.
        for (var credential:rows(path(id)+"/credentials")) {
            String type=Objects.toString(credential.get("type"),"");
            if (type.equals("password")) methods.add("E-mail e senha");
            else if (type.equals("otp")) methods.add("Aplicativo autenticador");
            else if (type.startsWith("webauthn")) methods.add("Chave de acesso");
        }
        for (var link:rows(path(id)+"/federated-identity")) methods.add("google".equals(link.get("identityProvider")) ? "Google" : "Provedor externo");
        return new Details(user,methods.stream().distinct().toList());
    }
    private Map<String,Object> state(UserView user) { return Map.of("profile",user.profile(),"enabled",user.enabled(),"firstName",user.firstName(),"lastName",user.lastName(),"email",user.email()); }
    private String name(UserView user) { return (user.firstName()+" "+user.lastName()).strip().isEmpty() ? user.email() : (user.firstName()+" "+user.lastName()).strip(); }
    /** Explicit erasure for legacy rows whose subject was never recorded. Never infer ownership from email. */
    public void eraseOrphan(int localId, String confirmation) {
        if (localId < 1 || !"EXCLUIR".equals(confirmation)) throw error(HttpStatus.BAD_REQUEST,"Confirme o registro local a anonimizar.");
        transaction.executeWithoutResult(status -> {
            jdbc.queryForObject("SELECT pg_advisory_xact_lock(731492810035)",(rs,n)->true);
            var actor=view(human(auth.identity().getSubject()),false);
            if (!actor.enabled() || !actor.effectiveRoles().contains("ADMIN")) throw error(HttpStatus.FORBIDDEN,"Acesso administrativo necessário.");
            var rows=jdbc.queryForList("SELECT keycloak_id,deleted_at FROM usuario WHERE id_usuario=? FOR UPDATE",localId);
            if (rows.isEmpty()) throw error(HttpStatus.NOT_FOUND,"Registro não encontrado.");
            if (rows.getFirst().get("keycloak_id") != null) throw error(HttpStatus.CONFLICT,"Esta conta possui identidade. Use a exclusão coordenada.");
            if (rows.getFirst().get("deleted_at") != null) return;
            jdbc.update("DELETE FROM usuario_identity_link_audit WHERE id_usuario=?",localId);
            jdbc.update("""
                UPDATE usuario SET nome='Conta excluída',email=NULL,password_hash=NULL,role='USER',ativo=false,
                  deleted_at=CURRENT_TIMESTAMP,identity_checked_at=CURRENT_TIMESTAMP WHERE id_usuario=?
                """,localId);
            // Atomic local audit, no copied personal profile or historical reassociation.
            jdbc.update("""
                INSERT INTO admin_user_audit(actor_sub,actor_name,target_sub,target_name,operation,before_state,after_state,result,completed_at)
                VALUES (?,? ,?,'Conta excluída','ORPHAN_ERASURE','{}'::jsonb,'{}'::jsonb,'SUCCESS',CURRENT_TIMESTAMP)
                """,actor.id(),name(actor),"local-orphan-"+localId);
        });
    }
    public UserView change(String id,String profile,Map<String,Object> fields,boolean confirmed) {
        path(id);
        if (profile != null && !ROLES.contains(profile)) throw error(HttpStatus.BAD_REQUEST,"Perfil inválido.");
        return transaction.execute(status -> {
            // Shared PostgreSQL transaction lock across ALL SIDPB API instances.
            jdbc.queryForObject("SELECT pg_advisory_xact_lock(731492810035)",(rs,n)->true);
            // A queued request may carry a formerly valid ADMIN token; recheck after locking.
            var actor=view(human(auth.identity().getSubject()),false);
            if (!actor.enabled() || !actor.effectiveRoles().contains("ADMIN")) throw error(HttpStatus.FORBIDDEN,"Seu acesso administrativo mudou. Entre novamente.");
            var before=view(human(id),false);
            boolean demotion=profile != null && !profile.equals("ADMIN") && before.profile().equals("ADMIN");
            boolean disable=Boolean.FALSE.equals(fields.get("enabled"));
            if (actor.id().equals(id) && (demotion || disable)) throw error(HttpStatus.FORBIDDEN,"Você não pode remover seu próprio acesso administrativo ou desativar sua conta.");
            // Every reduction has a DIFFERENT, live, enabled ADMIN (actor). Serialized
            // revalidation prevents two administrators removing each other/last active ADMIN.
            if ((demotion || disable || "ADMIN".equals(profile)) && !confirmed) throw error(HttpStatus.BAD_REQUEST,"Confirme explicitamente esta alteração.");
            var desired=new HashMap<>(state(before)); desired.putAll(fields);
            if (profile != null) desired.put("profile",profile);
            if (desired.equals(state(before))) return before;
            long event=audit.begin(actor.id(),name(actor),id,name(before),profile == null ? "ACCOUNT_UPDATE" : "PROFILE_CHANGE",state(before));
            try {
                if (profile != null) {
                    String mapping=path(id)+"/role-mappings/realm";
                    var direct=rows(mapping);
                    var wanted=kc.admin(HttpMethod.GET,"/roles/"+profile,null,Map.class);
                    if (direct.stream().noneMatch(role -> profile.equals(role.get("name")))) kc.admin(HttpMethod.POST,mapping,List.of(wanted),Void.class);
                    var remove=direct.stream().filter(role -> ROLES.contains(role.get("name")) && !profile.equals(role.get("name"))).toList();
                    if (!remove.isEmpty()) kc.admin(HttpMethod.DELETE,mapping,remove,Void.class);
                } else {
                    var body=new HashMap<>(fields);
                    if (body.containsKey("email") && !before.email().equals(body.get("email"))) body.put("emailVerified",false);
                    kc.admin(HttpMethod.PUT,path(id),body,Void.class);
                }
                kc.admin(HttpMethod.POST,path(id)+"/logout",null,Void.class);
                var after=view(human(id),false);
                if (!state(after).equals(desired)) throw error(HttpStatus.CONFLICT,"A alteração não foi confirmada integralmente. Recarregue os dados e consulte o histórico; permissões herdadas podem exigir suporte técnico.");
                audit.finish(event,state(after),"SUCCESS");
                return after;
            } catch (RuntimeException failure) {
                // REST changes cannot roll back with SQL. Revoke even on partial failure.
                try { kc.admin(HttpMethod.POST,path(id)+"/logout",null,Void.class); } catch (RuntimeException ignored) { }
                Map<String,Object> observed=null;
                try { observed=state(view(human(id),false)); } catch (RuntimeException ignored) { }
                audit.finish(event,observed,observed == null ? "UNKNOWN" : observed.equals(state(before)) ? "FAILED" : "PARTIAL");
                throw failure;
            }
        });
    }
}
