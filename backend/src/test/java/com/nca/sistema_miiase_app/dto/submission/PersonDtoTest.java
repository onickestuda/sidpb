package com.nca.sistema_miiase_app.dto.submission;

import static org.junit.jupiter.api.Assertions.*;

import org.junit.jupiter.api.Test;
import com.nca.sistema_miiase_app.domain.entity.Usuario;

class PersonDtoTest {
    private static Usuario user(Integer id, String name, String keycloakId) {
        Usuario user = new Usuario();
        user.setId(id); user.setNome(name); user.setKeycloakId(keycloakId);
        return user;
    }

    @Test void codigoPublicoEhEstavelHexDeSeisDigitosESemDadosPessoais() {
        PersonDto person = PersonDto.of(user(7, "Maria", "kc-subject-1"));
        assertEquals(person.code(), PersonDto.of(user(99, "Outra pessoa", "kc-subject-1")).code(), "depende so da identidade");
        assertTrue(person.code().matches("[0-9A-F]{6}"));
        assertNotEquals(person.code(), PersonDto.of(user(7, "Maria", "kc-subject-2")).code());
        assertNotEquals(person.code(), PersonDto.of(user(7, "Maria", null)).code(), "conta sem Keycloak usa o id local");
        assertNull(PersonDto.of(null));
    }

    @Test void curadorApareceSoPeloCodigo() {
        PersonDto curator = PersonDto.codeOnly(user(7, "Maria", "kc-subject-1"));
        assertNull(curator.name());
        assertEquals(PersonDto.of(user(7, "Maria", "kc-subject-1")).code(), curator.code());
        assertNull(PersonDto.codeOnly(null));
    }

    @Test void codigoDaContaLogadaEhOMesmoDoCarimbo() {
        assertEquals(PersonDto.of(user(7, "Maria", "kc-subject-1")).code(), PersonDto.publicCode("kc-subject-1"));
    }
}
