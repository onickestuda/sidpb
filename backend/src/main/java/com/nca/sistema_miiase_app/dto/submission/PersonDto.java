package com.nca.sistema_miiase_app.dto.submission;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;
import com.nca.sistema_miiase_app.domain.entity.Usuario;

// Nunca serializar a entidade Usuario com suas credenciais nos endpoints de curadoria.
// "code" e um identificador publico e estavel (6 hex), exibido no carimbo de curadoria
// para distinguir homonimos sem expor e-mail nem a contagem de cadastros.
public record PersonDto(Integer id, String name, String code) {

    public static PersonDto of(Usuario user) {
        return user == null ? null : new PersonDto(user.getId(), user.getNome(), publicCode(user));
    }

    static String publicCode(Usuario user) {
        return publicCode(user.getKeycloakId() != null ? user.getKeycloakId() : "local:" + user.getId());
    }

    /** Public code of a Keycloak subject (or "local:id"): the same value shown in curation stamps. */
    public static String publicCode(String identity) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256")
                    .digest(("sidpb-person:" + identity).getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().withUpperCase().formatHex(digest, 0, 3);
        } catch (NoSuchAlgorithmException impossible) {
            throw new IllegalStateException("SHA-256 indisponivel", impossible);
        }
    }
}
