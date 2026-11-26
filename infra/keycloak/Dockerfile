# Keycloak do SIDPB: realm "sidpb" importado na primeira subida e tema próprio (login e conta).
# Mudou um tema ou o realm? Reconstrua: docker compose up -d --build keycloak
FROM quay.io/keycloak/keycloak:26.8.1

COPY --chown=keycloak:keycloak sidpb-realm.json /opt/keycloak/data/import/sidpb-realm.json
COPY --chown=keycloak:keycloak themes/sidpb /opt/keycloak/themes/sidpb

ENV KC_DB=postgres \
    KC_DB_SCHEMA=keycloak \
    KC_HEALTH_ENABLED=true \
    KC_METRICS_ENABLED=true \
    KC_HOSTNAME_STRICT=true \
    KC_HOSTNAME_BACKCHANNEL_DYNAMIC=false

EXPOSE 8080 9000

# Falha cedo, com mensagem clara, se o .env não tiver as credenciais.
ENTRYPOINT ["/bin/bash", "-ec", "\
  : \"${KC_DB_PASSWORD:?Configure KEYCLOAK_DB_PASSWORD no .env}\"; \
  : \"${KC_BOOTSTRAP_ADMIN_USERNAME:?Configure KEYCLOAK_ADMIN no .env}\"; \
  : \"${KC_BOOTSTRAP_ADMIN_PASSWORD:?Configure KEYCLOAK_ADMIN_PASSWORD no .env}\"; \
  exec /opt/keycloak/bin/kc.sh start-dev --import-realm"]
