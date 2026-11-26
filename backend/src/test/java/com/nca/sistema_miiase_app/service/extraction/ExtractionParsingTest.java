package com.nca.sistema_miiase_app.service.extraction;

import static org.junit.jupiter.api.Assertions.*;

import java.math.BigDecimal;
import java.util.List;
import org.junit.jupiter.api.Test;
import com.nca.sistema_miiase_app.service.extraction.ExtractionReader.Quality;
import com.nca.sistema_miiase_app.service.extraction.LocationResolver.Precision;

class ExtractionParsingTest {

    private static final String VALID = """
            {"source": {"title": "Miíase oral", "authors": ["A"], "publication_date": "2011"},
             "occurrences": [{"disease": {"raw_name": "oral myiasis"}, "location": {"municipality_candidate": "Recife"}},
                             {"disease": {"raw_name": "miíase"}, "location": {}}]}
            """;

    @Test void leJsonValidoComTodasAsOcorrencias() {
        var result = ExtractionReader.read(VALID);
        assertEquals(Quality.VALIDA, result.quality());
        assertEquals("Miíase oral", result.source().get("title").asText());
        assertEquals(2, result.occurrences().size());
        assertNull(result.note());
    }

    @Test void aceitaJsonEntreCercasDeCodigo() {
        assertEquals(Quality.VALIDA, ExtractionReader.read("```json\n" + VALID + "\n```").quality());
    }

    @Test void recuperaOcorrenciasCompletasDeJsonTruncado() {
        String truncated = VALID.substring(0, VALID.indexOf("{\"disease\": {\"raw_name\": \"miíase\"") + 20);
        var result = ExtractionReader.read(truncated);
        assertEquals(Quality.PARCIAL, result.quality());
        assertEquals(1, result.occurrences().size(), "only the complete occurrence is kept");
        assertEquals("Miíase oral", result.source().get("title").asText());
        assertTrue(result.note().contains("1 ocorrência"));
    }

    @Test void chavesDentroDeTextoNaoConfundemOLeitor() {
        String tricky = "{\"source\": {\"title\": \"a } b { c\"}, \"occurrences\": [{\"evidence\": [{\"text\": \"x } y\"}]}, {\"cut\": ";
        var result = ExtractionReader.read(tricky);
        assertEquals(Quality.PARCIAL, result.quality());
        assertEquals("a } b { c", result.source().get("title").asText());
        assertEquals(1, result.occurrences().size());
    }

    @Test void textoIlegivelNuncaEhRejeitado() {
        var result = ExtractionReader.read("Desculpe, não consegui extrair.");
        assertEquals(Quality.ILEGIVEL, result.quality());
        assertTrue(result.occurrences().isEmpty());
        assertNotNull(result.note());
        assertEquals(Quality.ILEGIVEL, ExtractionReader.read(null).quality());
    }

    @Test void agrupaGrafiasDeMiiaseSemPerderOutrasDoencas() {
        for (String raw : List.of("myiasis", "Oral-maxillofacial myiasis", "miíase", "Miíases humanas", "primary myiasis")) {
            assertEquals("Miíase", ExtractionText.normalizeDisease(raw), raw);
        }
        assertEquals("Pseudomiíase", ExtractionText.normalizeDisease("pseudomyiasis"));
        assertEquals("Leishmaniose", ExtractionText.normalizeDisease("leishmaniose"));
        assertNull(ExtractionText.normalizeDisease("null"));
        assertEquals("sao paulo", ExtractionText.fold("São Paulo"));
        assertEquals("piaui", ExtractionText.fold("Piauı´"));
    }

    private static final LocationResolver RESOLVER = new LocationResolver(
            List.of(new LocationResolver.State(26, "PE", "Pernambuco", null, null),
                    new LocationResolver.State(41, "PR", "Paraná", new BigDecimal("-24.6"), new BigDecimal("-51.6")),
                    new LocationResolver.State(43, "RS", "Rio Grande do Sul", null, null),
                    new LocationResolver.State(35, "SP", "São Paulo", null, null)),
            List.of(new LocationResolver.Municipality(1, "Recife", 26, new BigDecimal("-8.05"), new BigDecimal("-34.88")),
                    new LocationResolver.Municipality(2, "Sarandi", 41, BigDecimal.ONE, BigDecimal.ONE),
                    new LocationResolver.Municipality(3, "Sarandi", 43, BigDecimal.TEN, BigDecimal.TEN),
                    new LocationResolver.Municipality(4, "Botucatu", 35, new BigDecimal("-22.9"), new BigDecimal("-48.4"))));

    @Test void resolveMunicipioPorSiglaOuNomeDaUf() {
        var bySigla = RESOLVER.resolve("Recife", "PE", null, null);
        assertEquals(Precision.MUNICIPIO, bySigla.precision());
        assertEquals(1, bySigla.municipalityId());
        assertEquals(new BigDecimal("-8.05"), bySigla.latitude());
        assertEquals(1, RESOLVER.resolve("recife", "Pernambuco", null, null).municipalityId());
    }

    @Test void ufIlegivelComMunicipioUnicoAindaResolveComObservacao() {
        var result = RESOLVER.resolve("Botucatu", "S~o Paulo", null, null);
        assertEquals(Precision.MUNICIPIO, result.precision());
        assertEquals(4, result.municipalityId());
    }

    @Test void municipioAmbiguoNuncaViraPontoNoMapa() {
        var noState = RESOLVER.resolve("Sarandi", null, null, null);
        assertEquals(Precision.SEM_LOCAL, noState.precision());
        assertNull(noState.latitude());
        assertTrue(noState.note().contains("mais de uma UF"));
        assertEquals(2, RESOLVER.resolve("Sarandi", "PR", null, null).municipalityId(), "state disambiguates");
    }

    @Test void soEstadoFicaSemPontoESemLocalFicaSemLocal() {
        var state = RESOLVER.resolve(null, "Paraná", null, null);
        assertEquals(Precision.ESTADO, state.precision());
        assertEquals(41, state.stateId());
        assertNull(state.latitude(), "state-only occurrences are not pinned at the state centroid");
        assertEquals(Precision.SEM_LOCAL, RESOLVER.resolve(null, null, null, null).precision());
        assertEquals(Precision.SEM_LOCAL, RESOLVER.resolve("Cidade Inexistente", null, null, null).precision());
    }

    @Test void coordenadaInformadaTemPrecedencia() {
        var exact = RESOLVER.resolve("Recife", "PE", new BigDecimal("-8.1"), new BigDecimal("-34.9"));
        assertEquals(Precision.EXATA, exact.precision());
        assertEquals(new BigDecimal("-8.1"), exact.latitude());
        assertEquals(1, exact.municipalityId());
    }
}
