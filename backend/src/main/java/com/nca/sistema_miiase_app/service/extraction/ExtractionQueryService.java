package com.nca.sistema_miiase_app.service.extraction;

import java.math.BigDecimal;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.nca.sistema_miiase_app.dto.response.mapa.MapOccurrenceDto;

/** Read side of the extractions: map points (curated or not) and the curator's detail view. */
@Service
public class ExtractionQueryService {

    public record OccurrenceView(Integer id, int order, String curationStatus, String disease, String diseaseOriginal,
                                 String parasite, String vector, String host, String hostCategory, String locationText,
                                 String municipality, String state, String locationPrecision, BigDecimal latitude,
                                 BigDecimal longitude, Integer year, Map<String, Object> others) { }

    public record ExtractionView(Integer submissionId, String externalId, String model, String quality,
                                 int occurrencesRead, String readingNote, Instant receivedAt, String rawContent,
                                 List<OccurrenceView> occurrences) { }

    private static final ObjectMapper JSON = new ObjectMapper();
    private static final String OCCURRENCE_COLUMNS = """
            o.id_ocorrencia_extraida, o.ordem, o.status_curadoria, o.doenca, o.doenca_original, o.parasito, o.vetor,
            o.hospedeiro, o.categoria_hospedeiro, o.local_texto, COALESCE(m.nome, o.municipio_texto) AS municipio,
            COALESCE(es.sigla, o.uf_texto) AS uf, o.precisao_local, o.latitude, o.longitude, o.ano, o.outros::text AS outros
            """;

    private final JdbcTemplate jdbc;

    public ExtractionQueryService(JdbcTemplate jdbc) { this.jdbc = jdbc; }

    /** Extracted occurrences shown to everyone: not yet curated and curated; rejected ones never appear. */
    public List<MapOccurrenceDto> mapOccurrences() {
        return jdbc.query("SELECT " + OCCURRENCE_COLUMNS + """
                , s.id_submissao, s.titulo, s.ano AS ano_artigo, COALESCE(s.dados_curados, s.dados_usuario)::text AS artigo, e.modelo
                FROM ocorrencia_extraida o
                JOIN extracao e ON e.id_extracao = o.id_extracao
                JOIN submissao_artigo s ON s.id_submissao = e.id_submissao
                LEFT JOIN municipio m ON m.id_municipio = o.id_municipio
                LEFT JOIN estado es ON es.id_estado = o.id_estado
                WHERE o.status_curadoria IN ('NAO_CURADA', 'CURADA')
                ORDER BY o.id_ocorrencia_extraida
                """, (rs, row) -> toMap(rs));
    }

    public ExtractionView detail(Integer submissionId) {
        List<ExtractionView> found = jdbc.query("""
                SELECT e.id_extracao, e.id_externo, e.modelo, e.qualidade, e.ocorrencias_lidas, e.observacao_leitura,
                       e.recebida_em, e.conteudo_bruto
                FROM extracao e WHERE e.id_submissao = ?""", (rs, row) -> new ExtractionView(submissionId,
                rs.getString("id_externo"), rs.getString("modelo"), rs.getString("qualidade"), rs.getInt("ocorrencias_lidas"),
                rs.getString("observacao_leitura"), rs.getTimestamp("recebida_em").toInstant(), rs.getString("conteudo_bruto"),
                occurrences(rs.getInt("id_extracao"))), submissionId);
        if (found.isEmpty()) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Esta submissão não veio de uma extração automática.");
        return found.get(0);
    }

    /**
     * Curator's location seal for one extracted occurrence. EXATA needs coordinates and MUNICIPIO a
     * resolved municipality; the seal stays visible after curation (a street may never be known).
     */
    @org.springframework.transaction.annotation.Transactional
    public OccurrenceView updatePrecision(Integer submissionId, Integer occurrenceId, String precision) {
        if (!Set.of("EXATA", "MUNICIPIO", "ESTADO", "SEM_LOCAL").contains(precision)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Selo de localização inválido.");
        }
        List<Map<String, Object>> rows = jdbc.queryForList("""
                SELECT o.latitude, o.id_municipio, o.id_estado, e.id_extracao,
                       -- Municipality-level rows store the centroid in latitude/longitude: that is not an exact point.
                       (o.latitude IS NOT NULL AND (m.id_municipio IS NULL
                            OR o.latitude <> m.latitude_municipio OR o.longitude <> m.longitude_municipio)) AS ponto_proprio
                FROM ocorrencia_extraida o
                JOIN extracao e ON e.id_extracao = o.id_extracao
                LEFT JOIN municipio m ON m.id_municipio = o.id_municipio
                WHERE o.id_ocorrencia_extraida = ? AND e.id_submissao = ?""", occurrenceId, submissionId);
        if (rows.isEmpty()) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Ocorrência não encontrada nesta submissão.");
        Map<String, Object> row = rows.get(0);
        if (precision.equals("EXATA") && !Boolean.TRUE.equals(row.get("ponto_proprio")))
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Sem coordenadas registradas: a localização não pode ser marcada como exata.");
        if (precision.equals("MUNICIPIO") && row.get("id_municipio") == null)
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Nenhum município reconhecido para esta ocorrência.");
        if (precision.equals("ESTADO") && row.get("id_estado") == null)
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Nenhuma UF reconhecida para esta ocorrência.");
        jdbc.update("UPDATE ocorrencia_extraida SET precisao_local = ? WHERE id_ocorrencia_extraida = ?", precision, occurrenceId);
        return occurrences(((Number) row.get("id_extracao")).intValue()).stream()
                .filter(view -> view.id().equals(occurrenceId)).findFirst().orElseThrow();
    }

    private List<OccurrenceView> occurrences(int extractionId) {
        return jdbc.query("SELECT " + OCCURRENCE_COLUMNS + """
                FROM ocorrencia_extraida o
                LEFT JOIN municipio m ON m.id_municipio = o.id_municipio
                LEFT JOIN estado es ON es.id_estado = o.id_estado
                WHERE o.id_extracao = ? ORDER BY o.ordem""", (rs, row) -> new OccurrenceView(
                rs.getInt("id_ocorrencia_extraida"), rs.getInt("ordem"), rs.getString("status_curadoria"),
                rs.getString("doenca"), rs.getString("doenca_original"), rs.getString("parasito"), rs.getString("vetor"),
                rs.getString("hospedeiro"), rs.getString("categoria_hospedeiro"), rs.getString("local_texto"),
                rs.getString("municipio"), rs.getString("uf"), rs.getString("precisao_local"), rs.getBigDecimal("latitude"),
                rs.getBigDecimal("longitude"), (Integer) rs.getObject("ano"), others(rs.getString("outros"))), extractionId);
    }

    private MapOccurrenceDto toMap(ResultSet rs) throws SQLException {
        Map<String, Object> article = others(rs.getString("artigo"));
        Integer articleYear = (Integer) rs.getObject("ano_artigo");
        Integer eventYear = (Integer) rs.getObject("ano");
        @SuppressWarnings("unchecked")
        List<String> authors = article.get("authors") instanceof List<?> list ? (List<String>) list : List.of();
        String doi = article.get("doi") instanceof String value && !value.isBlank() ? value.strip() : null;
        String title = article.get("title") instanceof String value && !value.isBlank() ? value : rs.getString("titulo");
        var source = new MapOccurrenceDto.FonteDto(null, null, null, new ArrayList<>(authors), title,
                doi == null ? null : "https://doi.org/" + doi, articleYear == null ? null : LocalDate.of(articleYear, 1, 1));

        int id = rs.getInt("id_ocorrencia_extraida");
        // Only exact and municipality-level positions become points; the curator's seal decides.
        boolean pinned = Set.of("EXATA", "MUNICIPIO").contains(rs.getString("precisao_local"));
        var dto = new MapOccurrenceDto(-id, null, rs.getString("municipio"), rs.getString("uf"), null,
                pinned ? rs.getBigDecimal("latitude") : null, pinned ? rs.getBigDecimal("longitude") : null, rs.getString("doenca"), rs.getString("hospedeiro"),
                rs.getString("categoria_hospedeiro"), rs.getString("parasito"), rs.getString("vetor"),
                null, null, List.of(source)); // only the year is known: never fake a day/month
        Map<String, Object> others = others(rs.getString("outros"));
        if (others.get("outcome") instanceof String outcome) dto.setDesfecho(outcome);
        if (eventYear != null) others.put("event_year", eventYear);
        if (rs.getString("doenca_original") != null) others.put("disease_original", rs.getString("doenca_original"));
        if (rs.getString("local_texto") != null) others.put("location_raw", rs.getString("local_texto"));
        dto.setChave("E-" + id);
        dto.setCuradoria(rs.getString("status_curadoria"));
        dto.setPrecisaoLocal(rs.getString("precisao_local"));
        dto.setIdSubmissao(rs.getInt("id_submissao"));
        dto.setModeloExtracao(rs.getString("modelo"));
        dto.setOutros(others);
        return dto;
    }

    private static Map<String, Object> others(String json) {
        if (json == null) return new LinkedHashMap<>();
        try { return JSON.readValue(json, new TypeReference<LinkedHashMap<String, Object>>() { }); }
        catch (Exception invalid) { return new LinkedHashMap<>(); }
    }
}
