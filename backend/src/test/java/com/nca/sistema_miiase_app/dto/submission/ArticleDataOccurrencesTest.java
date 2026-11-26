package com.nca.sistema_miiase_app.dto.submission;

import static org.junit.jupiter.api.Assertions.*;

import java.math.BigDecimal;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.web.server.ResponseStatusException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.nca.sistema_miiase_app.service.submission.SubmissionService;

class ArticleDataOccurrencesTest {
    private final ObjectMapper json = new ObjectMapper();

    private static UserOccurrenceDto occurrence(String disease, BigDecimal latitude, BigDecimal longitude) {
        return new UserOccurrenceDto(disease, null, null, "bovino", null, 2020, "MA", "Imperatriz", latitude, longitude, null);
    }

    private static ArticleDataDto article(List<UserOccurrenceDto> occurrences) {
        return new ArticleDataDto("Artigo", List.of(), 2020, null, null, null, null, null, null, null, null, null, null, null, occurrences);
    }

    @Test void soFonteSemOcorrenciasEhValida() {
        var onlySource = article(List.of());
        assertDoesNotThrow(() -> SubmissionService.validateCoordinates(onlySource));
        assertNull(onlySource.firstDisease());
        assertNull(article(null).firstDisease());
    }

    @Test void variasOcorrenciasUsamAPrimeiraDoencaPreenchida() {
        var data = article(List.of(occurrence(" ", null, null), occurrence("Miíase", null, null), occurrence("Leishmaniose", null, null)));
        assertEquals("Miíase", data.firstDisease());
        assertDoesNotThrow(() -> SubmissionService.validateCoordinates(data));
    }

    @Test void coordenadasValidadasEmParPorOcorrencia() {
        var data = article(List.of(occurrence("Miíase", null, null), occurrence("Miíase", new BigDecimal("-5.5"), null)));
        var error = assertThrows(ResponseStatusException.class, () -> SubmissionService.validateCoordinates(data));
        assertTrue(error.getReason().startsWith("Ocorrência 2"));
    }

    @Test void formatoLegadoSemListaContinuaLegivel() throws Exception {
        String legacy = """
                {"title":"Antigo","authors":["A"],"year":2019,"disease":"Miíase","state":"SP","municipality":"Campinas"}""";
        ArticleDataDto data = json.readValue(legacy, ArticleDataDto.class);
        assertNull(data.occurrences());
        assertEquals("Miíase", data.firstDisease(), "falls back to the legacy root field");
        assertEquals("Campinas", data.municipality());
    }

    @Test void formatoNovoIdaEVolta() throws Exception {
        var data = article(List.of(occurrence("Miíase", new BigDecimal("-5.5"), new BigDecimal("-47.5"))));
        ArticleDataDto back = json.readValue(json.writeValueAsString(data), ArticleDataDto.class);
        assertEquals(1, back.occurrences().size());
        assertEquals("Imperatriz", back.occurrences().get(0).municipality());
    }
}
