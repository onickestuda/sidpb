package com.nca.sistema_miiase_app.service.curation;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import com.nca.sistema_miiase_app.service.curation.CurationFacetService.Selection;

class CurationFacetServiceTest {
    private final JdbcTemplate jdbc = mock(JdbcTemplate.class);
    private final CurationFacetService service = new CurationFacetService(jdbc);

    @Test void filtroEhInclusivoEntreCategorias() {
        // Miíase -> submissions 1, 2; humano -> 3; nothing in common, all must show.
        when(jdbc.queryForList(anyString(), eq(Integer.class), eq("disease"), any())).thenReturn(List.of(1, 2));
        when(jdbc.queryForList(anyString(), eq(Integer.class), eq("host"), any())).thenReturn(List.of(3));
        var ids = service.matching(new Selection(List.of("Miíase", "Dengue"), List.of(), List.of("humano"), List.of()));
        assertThat(ids).containsExactlyInAnyOrder(1, 2, 3);
    }

    @Test void semCorrespondenciaRetornaVazioENaoNulo() {
        when(jdbc.queryForList(anyString(), eq(Integer.class), any(), any())).thenReturn(List.of());
        assertThat(service.matching(new Selection(List.of("Dengue"), List.of(), List.of(), List.of()))).isEmpty();
    }

    @Test void semSelecaoNaoRestringe() {
        assertThat(service.matching(new Selection(List.of(), List.of(), List.of(), List.of()))).isNull();
        verifyNoInteractions(jdbc);
    }
}
