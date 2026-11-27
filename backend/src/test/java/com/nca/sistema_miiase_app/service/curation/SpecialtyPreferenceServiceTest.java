package com.nca.sistema_miiase_app.service.curation;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import com.nca.sistema_miiase_app.service.curation.CurationFacetService.Selection;

class SpecialtyPreferenceServiceTest {
    private final JdbcTemplate jdbc = mock(JdbcTemplate.class);
    private final SpecialtyPreferenceService service = new SpecialtyPreferenceService(jdbc);

    @Test void deveLimparEspacosVaziosDuplicadosENulos() {
        Selection cleaned = SpecialtyPreferenceService.clean(new Selection(
                Arrays.asList(" Miíase ", "Miíase", "", null), null, List.of("boi"), List.of("MA")));
        assertThat(cleaned.diseases()).containsExactly("Miíase");
        assertThat(cleaned.vectors()).isEmpty();
        assertThat(cleaned.hosts()).containsExactly("boi");
    }

    @Test void deveLimitarQuantidadeETamanho() {
        var many = new ArrayList<String>();
        for (int i = 0; i < 500; i++) many.add("valor " + i);
        many.add("x".repeat(400));
        Selection cleaned = SpecialtyPreferenceService.clean(new Selection(many, List.of(), List.of(), List.of()));
        assertThat(cleaned.diseases()).hasSize(SpecialtyPreferenceService.MAX_VALUES);
        assertThat(cleaned.diseases()).allMatch(value -> value.length() <= SpecialtyPreferenceService.MAX_LENGTH);
    }

    @Test void selecaoVaziaRemoveAPreferencia() {
        service.save(7, new Selection(List.of(" "), List.of(), List.of(), List.of()));
        verify(jdbc).update(startsWith("DELETE FROM preferencia_especialidade"), eq(7));
        verify(jdbc, never()).update(startsWith("INSERT"), any(), any());
    }

    @Test void salvaComoJsonPorUsuario() {
        service.save(7, new Selection(List.of("Miíase"), List.of(), List.of(), List.of("MA")));
        verify(jdbc).update(contains("ON CONFLICT (id_usuario)"), eq(7),
                eq("{\"diseases\":[\"Miíase\"],\"vectors\":[],\"hosts\":[],\"states\":[\"MA\"]}"));
    }

    @Test void semPreferenciaRetornaVazio() {
        when(jdbc.queryForList(anyString(), eq(String.class), eq(7))).thenReturn(List.of());
        assertThat(service.get(7).isEmpty()).isTrue();
    }
}
