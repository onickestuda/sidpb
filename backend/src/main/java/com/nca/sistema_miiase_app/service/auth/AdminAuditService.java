package com.nca.sistema_miiase_app.service.auth;
import java.util.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.support.TransactionTemplate;

@Service
public class AdminAuditService {
    private final JdbcTemplate jdbc;
    private final TransactionTemplate independent;
    private final ObjectMapper json = new ObjectMapper();
    public AdminAuditService(JdbcTemplate jdbc, PlatformTransactionManager manager) {
        this.jdbc = jdbc; independent = new TransactionTemplate(manager);
        independent.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);
    }
    private String encode(Object value) {
        try { return json.writeValueAsString(value); }
        catch (Exception e) { throw new IllegalStateException("Falha ao registrar histórico."); }
    }
    public long begin(String actor, String actorName, String target, String targetName, String operation, Object before) {
        return independent.execute(status -> jdbc.queryForObject("""
            INSERT INTO public.admin_user_audit (actor_sub,actor_name,target_sub,target_name,operation,before_state,result)
            VALUES (?,?,?,?,?,?::jsonb,'PENDING') RETURNING id
            """, Long.class, actor, actorName, target, targetName, operation, encode(before)));
    }
    public void finish(long id, Object after, String result) {
        independent.executeWithoutResult(status -> jdbc.update("""
            UPDATE public.admin_user_audit SET after_state=?::jsonb,result=?,completed_at=CURRENT_TIMESTAMP WHERE id=? AND result='PENDING'
            """, after == null ? null : encode(after), result, id));
    }
    public boolean accepts(org.springframework.security.oauth2.jwt.Jwt jwt) {
        // Additional revocation fence if a remote logout times out: tokens issued before
        // an administrative operation finishes cannot retain their previous privileges.
        return Boolean.TRUE.equals(jdbc.queryForObject("""
            SELECT NOT EXISTS (SELECT 1 FROM public.admin_user_audit
              WHERE target_sub=? AND COALESCE(completed_at,created_at) >= ?)
              AND NOT EXISTS (SELECT 1 FROM public.account_deletion WHERE subject_hash=?)
            """, Boolean.class, jwt.getSubject(), java.sql.Timestamp.from(jwt.getIssuedAt()), AccountLifecycleService.hash(jwt.getSubject())));
    }
    public List<Map<String,Object>> list(String target, long before, int max) {
        return jdbc.query("""
            SELECT * FROM public.admin_user_audit WHERE (? = '' OR target_sub=?) AND (?=0 OR id<?)
            ORDER BY id DESC LIMIT ?
            """, (rs, row) -> {
                Map<String,Object> result = new LinkedHashMap<>();
                for (String key : List.of("id","actor_sub","actor_name","target_sub","target_name","operation","result")) result.put(key,rs.getObject(key));
                result.put("created_at",rs.getTimestamp("created_at").toInstant().toString());
                result.put("completed_at",rs.getTimestamp("completed_at") == null ? null : rs.getTimestamp("completed_at").toInstant().toString());
                try {
                    result.put("before_state",json.readValue(rs.getString("before_state"),Map.class));
                    result.put("after_state",rs.getString("after_state") == null ? null : json.readValue(rs.getString("after_state"),Map.class));
                } catch (Exception e) { throw new IllegalStateException("Histórico indisponível."); }
                return result;
            }, target,target,before,before,max);
    }
}
