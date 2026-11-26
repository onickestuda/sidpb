package com.nca.sistema_miiase_app.service.auth;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.HexFormat;
import java.util.Map;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.server.ResponseStatusException;

/** Durable intent + retry, not a distributed transaction. Never deletes scientific rows. */
@Service
public class AccountLifecycleService {
    private final JdbcTemplate jdbc;
    private final KeycloakGateway kc;
    private final TransactionTemplate tx;
    public AccountLifecycleService(JdbcTemplate jdbc, KeycloakGateway kc, PlatformTransactionManager manager) {
        this.jdbc = jdbc; this.kc = kc;
        tx = new TransactionTemplate(manager);
        tx.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);
    }
    public static String hash(String subject) {
        try { return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(subject.getBytes(StandardCharsets.UTF_8))); }
        catch (java.security.NoSuchAlgorithmException impossible) { throw new IllegalStateException(impossible); }
    }
    private void lock(String subject) {
        // Same order as administration; subject lock is also used by first login.
        jdbc.queryForObject("SELECT pg_advisory_xact_lock(731492810035)", (rs,n) -> true);
        jdbc.queryForObject("SELECT pg_advisory_xact_lock(hashtextextended(?, 0))", (rs,n) -> true, subject);
    }
    public boolean blocked(String subject) {
        return Boolean.TRUE.equals(jdbc.queryForObject("SELECT EXISTS (SELECT 1 FROM account_deletion WHERE subject_hash=?)", Boolean.class, hash(subject)));
    }
    /** Called only for the authenticated subject, after explicit confirmation. */
    public void request(String subject) {
        AdminUsersService.path(subject);
        tx.executeWithoutResult(status -> {
            lock(subject);
            if (blocked(subject)) return;
            var user = kc.findUser(subject);
            if (user.isPresent()) {
                if (user.get().get("serviceAccountClientId") != null)
                    throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Contas técnicas não podem ser excluídas aqui.");
                // A live role check prevents a stale token from deleting the last administrator.
                var roles = kc.admin(HttpMethod.GET, AdminUsersService.path(subject) + "/role-mappings/realm/composite", null, java.util.List.class);
                if (roles == null || roles.stream().anyMatch(r -> "ADMIN".equals(((Map<?,?>) r).get("name"))))
                    throw new ResponseStatusException(HttpStatus.CONFLICT, "Transfira o acesso administrativo antes de excluir a conta.");
            }
            intent(subject);
        });
        // Intent is committed before remote DELETE. Timeout/crash leaves a retryable, blocked account.
        try { process(subject); } catch (RuntimeException failure) { /* Worker retries the durable intent. */ }
    }
    private void intent(String subject) {
        jdbc.update("INSERT INTO account_deletion(subject_hash,subject) VALUES (?,?) ON CONFLICT DO NOTHING", hash(subject), subject);
        jdbc.update("UPDATE usuario SET ativo=false WHERE keycloak_id=?", subject);
    }
    public void process(String subject) {
        if (!blocked(subject)) return;
        jdbc.update("UPDATE account_deletion SET attempts=attempts+1,last_attempt_at=CURRENT_TIMESTAMP WHERE subject_hash=? AND state='PENDING'", hash(subject));
        tx.executeWithoutResult(status -> {
            lock(subject);
            String state = jdbc.queryForObject("SELECT state FROM account_deletion WHERE subject_hash=?", String.class, hash(subject));
            if ("COMPLETE".equals(state)) return;
            if (kc.findUser(subject).isPresent()) {
                try { kc.admin(HttpMethod.DELETE, AdminUsersService.path(subject), null, Void.class); }
                catch (ResponseStatusException failure) { if (failure.getStatusCode().value() != 404) throw failure; }
            }
            // Even a DELETE 204/404 is followed by a realm-validated lookup before anonymizing.
            if (kc.findUser(subject).isPresent()) throw new IllegalStateException("Identity deletion not confirmed");
            anonymize(subject);
            jdbc.update("UPDATE account_deletion SET state='COMPLETE',subject=NULL,completed_at=CURRENT_TIMESTAMP WHERE subject_hash=?", hash(subject));
        });
    }
    private void anonymize(String subject) {
        // Preserve actor FK rows to keep approved/rejected decisions valid, but remove identity/profile.
        jdbc.update("DELETE FROM usuario_identity_link_audit WHERE keycloak_id=? OR id_usuario IN (SELECT id_usuario FROM usuario WHERE keycloak_id=?)", subject, subject);
        jdbc.update("""
            UPDATE admin_user_audit SET target_sub='deleted',target_name='Conta excluída',
                before_state='{}'::jsonb,after_state='{}'::jsonb WHERE target_sub=?
            """, subject);
        jdbc.update("UPDATE admin_user_audit SET actor_sub='deleted',actor_name='Conta excluída' WHERE actor_sub=?", subject);
        jdbc.update("""
            UPDATE usuario SET nome='Conta excluída',email=NULL,password_hash=NULL,keycloak_id=NULL,
                role='USER',ativo=false,deleted_at=CURRENT_TIMESTAMP,identity_checked_at=CURRENT_TIMESTAMP
            WHERE keycloak_id=?
            """, subject);
        jdbc.update("DELETE FROM account_identity_watch WHERE subject=?", subject);
    }
    /** Fair bounded scan. Only a confirmed missing subject, never enabled=false or a failure, is erased. */
    public void reconcile() {
        for (String subject : jdbc.queryForList("SELECT subject FROM account_deletion WHERE state='PENDING' ORDER BY last_attempt_at NULLS FIRST,requested_at LIMIT 50", String.class)) {
            try { process(subject); } catch (RuntimeException failure) { /* Retained for the next pass. */ }
        }
        jdbc.update("""
            INSERT INTO account_identity_watch(subject)
            SELECT subject FROM (
              SELECT keycloak_id AS subject FROM usuario WHERE keycloak_id IS NOT NULL
              UNION SELECT actor_sub FROM admin_user_audit
              UNION SELECT target_sub FROM admin_user_audit
              UNION SELECT keycloak_id FROM usuario_identity_link_audit
            ) known WHERE subject <> 'deleted' AND subject NOT LIKE 'local-orphan-%'
            ON CONFLICT DO NOTHING
            """);
        for (String subject : jdbc.queryForList("SELECT subject FROM account_identity_watch ORDER BY checked_at NULLS FIRST,subject LIMIT 100", String.class)) {
            try {
                tx.executeWithoutResult(status -> {
                    lock(subject);
                    var user = kc.findUser(subject);
                    if (user.isEmpty()) { intent(subject); anonymize(subject); jdbc.update("UPDATE account_deletion SET state='COMPLETE',subject=NULL,completed_at=CURRENT_TIMESTAMP WHERE subject_hash=?", hash(subject)); }
                    else {
                        if (!blocked(subject)) jdbc.update("UPDATE usuario SET ativo=?,identity_checked_at=CURRENT_TIMESTAMP WHERE keycloak_id=?", Boolean.TRUE.equals(user.get().get("enabled")), subject);
                        jdbc.update("UPDATE account_identity_watch SET checked_at=CURRENT_TIMESTAMP WHERE subject=?",subject);
                    }
                });
            } catch (RuntimeException failure) {
                // Advance scan cursor without interpreting an outage/403/timeout as absence.
                jdbc.update("UPDATE usuario SET identity_checked_at=CURRENT_TIMESTAMP WHERE keycloak_id=?", subject);
                jdbc.update("UPDATE account_identity_watch SET checked_at=CURRENT_TIMESTAMP WHERE subject=?",subject);
            }
        }
    }
}
