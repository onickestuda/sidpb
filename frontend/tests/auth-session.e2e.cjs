// OIDC replaced the provisional password/storage flow.
import('./keycloak-auth.e2e.mjs').catch(error => { console.error(error); process.exitCode = 1; });
