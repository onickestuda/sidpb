package com.nca.sistema_miiase_app.service.curation;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import com.nca.sistema_miiase_app.domain.entity.SubmissaoStatus;

/**
 * Specialty facets of the curation queue (disease, etiological agent, host, state), taken from every
 * occurrence a submission carries: automatic extraction, the submitter's suggestions (new list or the
 * legacy root fields) and the indexed disease. Lets a curator see only the submissions of their field.
 */
@Service
public class CurationFacetService {

    public record Option(String label, long count) { }
    public record Facets(List<Option> diseases, List<Option> vectors, List<Option> hosts, List<Option> states) { }
    /** Selected values per category; empty lists mean "no filter". */
    public record Selection(List<String> diseases, List<String> vectors, List<String> hosts, List<String> states) {
        @com.fasterxml.jackson.annotation.JsonIgnore
        public boolean isEmpty() { return all(diseases).isEmpty() && all(vectors).isEmpty() && all(hosts).isEmpty() && all(states).isEmpty(); }
    }

    private static final String FACETS = """
            WITH f(id, k, v) AS (
                SELECT e.id_submissao, 'disease', o.doenca FROM ocorrencia_extraida o JOIN extracao e ON e.id_extracao = o.id_extracao
                  WHERE o.status_curadoria <> 'REPROVADA'
                UNION ALL SELECT e.id_submissao, 'vector', o.vetor FROM ocorrencia_extraida o JOIN extracao e ON e.id_extracao = o.id_extracao
                UNION ALL SELECT e.id_submissao, 'vector', o.parasito FROM ocorrencia_extraida o JOIN extracao e ON e.id_extracao = o.id_extracao
                UNION ALL SELECT e.id_submissao, 'host', o.hospedeiro FROM ocorrencia_extraida o JOIN extracao e ON e.id_extracao = o.id_extracao
                UNION ALL SELECT e.id_submissao, 'state', COALESCE(es.sigla, o.uf_texto) FROM ocorrencia_extraida o
                  JOIN extracao e ON e.id_extracao = o.id_extracao LEFT JOIN estado es ON es.id_estado = o.id_estado
                UNION ALL SELECT s.id_submissao, 'disease', x->>'disease' FROM submissao_artigo s,
                  jsonb_array_elements(CASE WHEN jsonb_typeof(s.dados_usuario->'occurrences') = 'array' THEN s.dados_usuario->'occurrences' ELSE '[]'::jsonb END) x
                UNION ALL SELECT s.id_submissao, 'vector', x->>'vector' FROM submissao_artigo s,
                  jsonb_array_elements(CASE WHEN jsonb_typeof(s.dados_usuario->'occurrences') = 'array' THEN s.dados_usuario->'occurrences' ELSE '[]'::jsonb END) x
                UNION ALL SELECT s.id_submissao, 'vector', x->>'parasite' FROM submissao_artigo s,
                  jsonb_array_elements(CASE WHEN jsonb_typeof(s.dados_usuario->'occurrences') = 'array' THEN s.dados_usuario->'occurrences' ELSE '[]'::jsonb END) x
                UNION ALL SELECT s.id_submissao, 'host', x->>'host' FROM submissao_artigo s,
                  jsonb_array_elements(CASE WHEN jsonb_typeof(s.dados_usuario->'occurrences') = 'array' THEN s.dados_usuario->'occurrences' ELSE '[]'::jsonb END) x
                UNION ALL SELECT s.id_submissao, 'state', x->>'state' FROM submissao_artigo s,
                  jsonb_array_elements(CASE WHEN jsonb_typeof(s.dados_usuario->'occurrences') = 'array' THEN s.dados_usuario->'occurrences' ELSE '[]'::jsonb END) x
                UNION ALL SELECT id_submissao, 'disease', dados_usuario->>'disease' FROM submissao_artigo
                UNION ALL SELECT id_submissao, 'vector', dados_usuario->>'vector' FROM submissao_artigo
                UNION ALL SELECT id_submissao, 'vector', dados_usuario->>'parasite' FROM submissao_artigo
                UNION ALL SELECT id_submissao, 'host', dados_usuario->>'host' FROM submissao_artigo
                UNION ALL SELECT id_submissao, 'state', dados_usuario->>'state' FROM submissao_artigo
                UNION ALL SELECT id_submissao, 'disease', doenca FROM submissao_artigo
            )
            """;

    private final JdbcTemplate jdbc;

    public CurationFacetService(JdbcTemplate jdbc) { this.jdbc = jdbc; }

    public Facets facets(SubmissaoStatus status) {
        Map<String, List<Option>> byKey = new LinkedHashMap<>();
        for (String key : List.of("disease", "vector", "host", "state")) byKey.put(key, new ArrayList<>());
        jdbc.query(FACETS + """
                SELECT f.k, MIN(TRIM(f.v)) AS label, COUNT(DISTINCT f.id) AS total
                FROM f JOIN submissao_artigo s ON s.id_submissao = f.id
                WHERE s.status = ? AND f.v IS NOT NULL AND TRIM(f.v) <> ''
                GROUP BY f.k, LOWER(TRIM(f.v))
                ORDER BY f.k, LOWER(MIN(TRIM(f.v)))""",
                rs -> { byKey.get(rs.getString("k")).add(new Option(rs.getString("label"), rs.getLong("total"))); }, status.name());
        return new Facets(byKey.get("disease"), byKey.get("vector"), byKey.get("host"), byKey.get("state"));
    }

    /**
     * Submissions matching the selection: any selected value within a category, every category with a
     * selection. Null when nothing is selected (no restriction).
     */
    public Set<Integer> matching(Selection selection) {
        if (selection == null || selection.isEmpty()) return null;
        Set<Integer> result = null;
        Map<String, List<String>> categories = Map.of("disease", all(selection.diseases()), "vector", all(selection.vectors()),
                "host", all(selection.hosts()), "state", all(selection.states()));
        for (var category : categories.entrySet()) {
            if (category.getValue().isEmpty()) continue;
            String[] values = category.getValue().stream().map(value -> value.strip().toLowerCase(Locale.ROOT)).toArray(String[]::new);
            Set<Integer> ids = new HashSet<>(jdbc.queryForList(FACETS + """
                    SELECT DISTINCT f.id FROM f WHERE f.k = ? AND f.v IS NOT NULL AND LOWER(TRIM(f.v)) = ANY (?)""",
                    Integer.class, category.getKey(), values));
            if (result == null) result = ids; else result.retainAll(ids);
        }
        return result;
    }

    private static List<String> all(List<String> values) {
        return values == null ? List.of() : values.stream().filter(value -> value != null && !value.isBlank()).toList();
    }
}
