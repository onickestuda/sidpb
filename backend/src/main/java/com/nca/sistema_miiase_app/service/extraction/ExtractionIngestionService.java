package com.nca.sistema_miiase_app.service.extraction;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.EnumMap;
import java.util.Iterator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.nca.sistema_miiase_app.dto.submission.ArticleDataDto;
import com.nca.sistema_miiase_app.service.extraction.LocationResolver.Precision;

/**
 * Entry point of the extraction pipeline: every payload is inserted right away as a pending
 * submission whose occurrences appear on the map as NAO_CURADA until a human curator decides.
 */
@Service
public class ExtractionIngestionService {

    /**
     * Same shape as a JSONL line. "sumarization" may be the JSON text (as the pipeline writes it) or an
     * already-parsed object; it is typed as Object because Spring MVC binds request bodies with Jackson 3.
     */
    public record Payload(String id, String model, Object sumarization) { }

    public record Outcome(String externalId, Integer submissionId, boolean created, String quality,
                          int occurrences, Map<Precision, Integer> byPrecision, String note) { }

    private static final ObjectMapper JSON = new ObjectMapper();
    private static final Pattern YEAR = Pattern.compile("(1[5-9]\\d{2}|20\\d{2}|2100)");
    // Fields the map/curation already show; everything else in an occurrence goes to "outros".
    private static final Set<String> MAPPED = Set.of("host", "disease", "parasite", "vector", "location", "event_year");

    private final JdbcTemplate jdbc;
    private final LocationIndex locations;

    public ExtractionIngestionService(JdbcTemplate jdbc, LocationIndex locations) {
        this.jdbc = jdbc;
        this.locations = locations;
    }

    @Transactional
    public Outcome ingest(Payload payload) {
        String externalId = ExtractionText.clean(payload.id());
        if (externalId == null || externalId.length() > 500) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Informe um id de extração com até 500 caracteres.");
        }
        List<Map<String, Object>> existing = jdbc.queryForList("""
                SELECT e.id_submissao, e.qualidade, e.ocorrencias_lidas FROM extracao e WHERE e.id_externo = ?""", externalId);
        if (!existing.isEmpty()) {
            Map<String, Object> row = existing.get(0);
            return new Outcome(externalId, (Integer) row.get("id_submissao"), false, (String) row.get("qualidade"),
                    ((Number) row.get("ocorrencias_lidas")).intValue(), Map.of(), "Extração já recebida antes; nada foi duplicado.");
        }

        String raw = rawText(payload.sumarization());
        ExtractionReader.Result read = ExtractionReader.read(raw);
        JsonNode source = read.source();
        String title = firstText(source, "title", "title_raw", "file");
        if (title == null) title = externalId.replaceFirst(":fulltext:\\d+$", "");
        List<String> authors = new ArrayList<>();
        if (source != null) source.path("authors").forEach(author -> {
            String name = ExtractionText.clean(author.asText(null));
            if (name != null && authors.size() < 50) authors.add(truncate(name, 200));
        });
        Integer year = year(firstText(source, "publication_date", "year"));
        String sourceType = firstText(source, "source_type");
        String firstDisease = read.occurrences().stream()
                .map(occurrence -> ExtractionText.normalizeDisease(diseaseText(occurrence)))
                .filter(java.util.Objects::nonNull).findFirst().orElse(null);

        ArticleDataDto article = new ArticleDataDto(truncate(title, 500), authors, year, null, truncate(firstDisease, 200),
                null, null, null, null, null, null, null, truncate(sourceType, 200),
                "Recebido automaticamente do pipeline de extração (" + (payload.model() == null ? "modelo não informado" : payload.model()) + ").");
        String articleJson = write(article);

        Integer pipelineUser = jdbc.queryForObject(
                "SELECT id_usuario FROM usuario WHERE email = 'pipeline@sidpb.invalid'", Integer.class);
        Integer submissionId = jdbc.queryForObject("""
                INSERT INTO submissao_artigo (id_usuario, titulo, status, ano, doenca, dados_usuario, dados_llm,
                    extraction_status, extracted_at, extraction_model, extraction_mock, origem)
                VALUES (?, ?, 'PENDING', ?, ?, ?::jsonb, ?::jsonb, ?, CURRENT_TIMESTAMP, ?, FALSE, 'EXTRACAO')
                RETURNING id_submissao""", Integer.class,
                pipelineUser, truncate(title, 500), year, truncate(firstDisease, 200), articleJson, articleJson,
                read.quality() == ExtractionReader.Quality.ILEGIVEL ? "FAILED" : "COMPLETED", truncate(payload.model(), 100));
        return store(submissionId, externalId, payload.model(), raw, read);
    }

    /**
     * Result of the pipeline for a PDF a person submitted: attached to THAT submission (the id travels
     * with the job), never matched by content. A second result for the same submission is ignored.
     */
    @Transactional
    public Outcome attach(Integer submissionId, Payload payload) {
        List<Map<String, Object>> submission = jdbc.queryForList(
                "SELECT origem FROM submissao_artigo WHERE id_submissao = ? FOR UPDATE", submissionId);
        if (submission.isEmpty()) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Submissão não encontrada.");
        if (!"USUARIO".equals(submission.get(0).get("origem"))) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Só submissões enviadas por pessoas aguardam extração.");
        }
        List<Map<String, Object>> existing = jdbc.queryForList(
                "SELECT qualidade, ocorrencias_lidas, id_externo FROM extracao WHERE id_submissao = ?", submissionId);
        if (!existing.isEmpty()) {
            Map<String, Object> row = existing.get(0);
            return new Outcome((String) row.get("id_externo"), submissionId, false, (String) row.get("qualidade"),
                    ((Number) row.get("ocorrencias_lidas")).intValue(), Map.of(), "Esta submissão já tinha uma extração; nada foi alterado.");
        }
        String raw = rawText(payload.sumarization());
        ExtractionReader.Result read = ExtractionReader.read(raw);
        String externalId = ExtractionText.clean(payload.id()) == null ? "submissao:" + submissionId : truncate(payload.id().strip(), 500);
        String firstDisease = read.occurrences().stream()
                .map(occurrence -> ExtractionText.normalizeDisease(diseaseText(occurrence)))
                .filter(java.util.Objects::nonNull).findFirst().orElse(null);
        jdbc.update("""
                UPDATE submissao_artigo SET extraction_status = ?, extracted_at = CURRENT_TIMESTAMP, extraction_model = ?,
                    extraction_mock = FALSE, extraction_lease_until = NULL, updated_at = CURRENT_TIMESTAMP,
                    dados_llm = jsonb_set(dados_usuario, '{disease}', to_jsonb(COALESCE(?, dados_usuario->>'disease')))
                WHERE id_submissao = ?""",
                read.quality() == ExtractionReader.Quality.ILEGIVEL ? "FAILED" : "COMPLETED",
                truncate(payload.model(), 100), truncate(firstDisease, 200), submissionId);
        return store(submissionId, externalId, payload.model(), raw, read);
    }

    private Outcome store(Integer submissionId, String externalId, String model, String raw, ExtractionReader.Result read) {
        Integer extractionId = jdbc.queryForObject("""
                INSERT INTO extracao (id_submissao, id_externo, modelo, qualidade, ocorrencias_lidas, observacao_leitura, conteudo_bruto)
                VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING id_extracao""", Integer.class,
                submissionId, externalId, truncate(model, 200), read.quality().name(),
                read.occurrences().size(), truncate(read.note(), 1000), raw);

        Map<Precision, Integer> byPrecision = new EnumMap<>(Precision.class);
        int order = 0;
        for (JsonNode occurrence : read.occurrences()) {
            Precision precision = insertOccurrence(extractionId, ++order, occurrence);
            byPrecision.merge(precision, 1, Integer::sum);
        }
        return new Outcome(externalId, submissionId, true, read.quality().name(), read.occurrences().size(), byPrecision, read.note());
    }

    private Precision insertOccurrence(Integer extractionId, int order, JsonNode occurrence) {
        JsonNode host = occurrence.path("host");
        JsonNode location = occurrence.path("location");
        String diseaseOriginal = diseaseText(occurrence);
        LocationResolver.Resolution place = locations.resolver().resolve(
                text(location, "municipality_candidate"), text(location, "state_candidate"),
                decimal(location.path("latitude")), decimal(location.path("longitude")));

        Map<String, Object> others = new LinkedHashMap<>();
        Iterator<Map.Entry<String, JsonNode>> fields = occurrence.fields();
        while (fields.hasNext()) {
            Map.Entry<String, JsonNode> field = fields.next();
            if (!MAPPED.contains(field.getKey()) && !field.getValue().isNull()) others.put(field.getKey(), field.getValue());
        }
        putIfPresent(others, "host_sex", host.path("sex"));
        putIfPresent(others, "host_age", host.path("age"));
        putIfPresent(others, "parasite_raw_name", occurrence.path("parasite").path("raw_name"));
        putIfPresent(others, "location_note", place.note() == null ? null : JSON.getNodeFactory().textNode(place.note()));

        jdbc.update("""
                INSERT INTO ocorrencia_extraida (id_extracao, ordem, doenca, doenca_original, parasito, vetor, hospedeiro,
                    categoria_hospedeiro, local_texto, municipio_texto, uf_texto, id_municipio, id_estado, latitude, longitude,
                    precisao_local, ano, outros)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?::jsonb)""",
                extractionId, order, truncate(ExtractionText.normalizeDisease(diseaseOriginal), 300), truncate(diseaseOriginal, 300),
                truncate(firstText(occurrence.path("parasite"), "scientific_name", "raw_name"), 300),
                truncate(vectorText(occurrence.path("vector")), 300),
                truncate(firstText(host, "scientific_name", "raw_name", "especie"), 300),
                truncate(text(host, "category"), 100),
                truncate(text(location, "location_raw"), 1000), truncate(text(location, "municipality_candidate"), 300),
                truncate(text(location, "state_candidate"), 100), place.municipalityId(), place.stateId(),
                place.latitude(), place.longitude(), place.precision().name(),
                year(occurrence.path("event_year").asText(null)), write(others));
        return place.precision();
    }

    private static String diseaseText(JsonNode occurrence) {
        return firstText(occurrence.path("disease"), "normalized_name", "raw_name");
    }

    private static String vectorText(JsonNode vector) {
        if (vector == null || vector.isNull() || vector.isMissingNode()) return null;
        if (vector.isTextual()) return ExtractionText.clean(vector.asText());
        return firstText(vector, "scientific_name", "raw_name", "name");
    }

    private static String firstText(JsonNode node, String... keys) {
        if (node == null) return null;
        for (String key : keys) {
            String value = text(node, key);
            if (value != null) return value;
        }
        return null;
    }

    private static String text(JsonNode node, String key) {
        JsonNode value = node == null ? null : node.get(key);
        return value == null || value.isNull() || value.isContainerNode() ? null : ExtractionText.clean(value.asText());
    }

    private static BigDecimal decimal(JsonNode node) {
        if (node == null || node.isNull() || node.isMissingNode()) return null;
        try { return node.isNumber() ? node.decimalValue() : new BigDecimal(node.asText().strip()); }
        catch (NumberFormatException invalid) { return null; }
    }

    private static Integer year(String value) {
        if (value == null) return null;
        Matcher matcher = YEAR.matcher(value);
        return matcher.find() ? Integer.valueOf(matcher.group(1)) : null;
    }

    private static void putIfPresent(Map<String, Object> target, String key, JsonNode value) {
        if (value != null && !value.isNull() && !value.isMissingNode() && !(value.isTextual() && ExtractionText.clean(value.asText()) == null)) {
            target.put(key, value);
        }
    }

    private static String rawText(Object sumarization) {
        if (sumarization == null) return "";
        if (sumarization instanceof String text) return text;
        if (sumarization instanceof JsonNode node) return node.isTextual() ? node.asText() : node.toString();
        return write(sumarization); // Map/List bound by Spring from a JSON object
    }

    private static String truncate(String value, int max) {
        return value == null || value.length() <= max ? value : value.substring(0, max);
    }

    private static String write(Object value) {
        try { return JSON.writeValueAsString(value); }
        catch (Exception impossible) { throw new IllegalStateException(impossible); }
    }
}
