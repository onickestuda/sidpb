package com.nca.sistema_miiase_app.config;

import com.nca.sistema_miiase_app.service.auth.AccountLifecycleService;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.scheduling.annotation.Scheduled;

@Configuration
@EnableScheduling
@ConditionalOnProperty(name="sidpb.auth.reconciliation-enabled", havingValue="true", matchIfMissing=true)
public class AccountReconciliation {
    private final AccountLifecycleService lifecycle;
    public AccountReconciliation(AccountLifecycleService lifecycle) { this.lifecycle = lifecycle; }
    @Scheduled(fixedDelayString="${sidpb.auth.reconciliation-delay-ms:60000}", initialDelayString="${sidpb.auth.reconciliation-delay-ms:60000}")
    public void reconcile() { lifecycle.reconcile(); }
}
