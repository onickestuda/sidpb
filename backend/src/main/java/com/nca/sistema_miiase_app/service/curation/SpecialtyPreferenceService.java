package com.nca.sistema_miiase_app.service.curation;

import java.util.LinkedHashSet;
import java.util.List;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.nca.sistema_miiase_app.service.curation.CurationFacetService.Selection;

/**
 * The curator's saved specialty ("Minhas áreas"), stored per account so it follows the curator to any
 * browser. An empty selection removes the preference.
 */
@Service
public class SpecialtyPreferenceService {
    static final int MAX_VALUES = 200;
    static final int MAX_LENGTH = 300;

    private final JdbcTemplate jdbc;
    private final ObjectMapper json = new ObjectMapper();

    public SpecialtyPreferenceService(JdbcTemplate jdbc) { this.jdbc = jdbc; }

    public Selection get(Integer userId) {
        List<String> rows = jdbc.queryForList("SELECT selecao::text FROM preferencia_especialidade WHERE id_usuario = ?",
                String.class, userId);
        if (rows.isEmpty()) return empty();
        try {
            return clean(json.readValue(rows.get(0), Selection.class));
        } catch (JsonProcessingException e) {
            return empty();
        }
    }

    public Selection save(Integer userId, Selection selection) {
        Selection cleaned = clean(selection);
        if (cleaned.isEmpty()) {
            jdbc.update("DELETE FROM preferencia_especialidade WHERE id_usuario = ?", userId);
            return cleaned;
        }
        try {
            jdbc.update("""
                    INSERT INTO preferencia_especialidade (id_usuario, selecao, atualizado_em) VALUES (?, ?::jsonb, now())
                    ON CONFLICT (id_usuario) DO UPDATE SET selecao = EXCLUDED.selecao, atualizado_em = now()""",
                    userId, json.writeValueAsString(cleaned));
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("Não foi possível salvar a especialidade.", e);
        }
        return cleaned;
    }

    static Selection empty() { return new Selection(List.of(), List.of(), List.of(), List.of()); }

    /** Trims, drops blanks and duplicates, and caps sizes so a request cannot store arbitrary data. */
    static Selection clean(Selection selection) {
        if (selection == null) return empty();
        return new Selection(values(selection.diseases()), values(selection.vectors()),
                values(selection.hosts()), values(selection.states()));
    }

    private static List<String> values(List<String> input) {
        if (input == null) return List.of();
        var unique = new LinkedHashSet<String>();
        for (String value : input) {
            if (value == null || value.isBlank()) continue;
            String trimmed = value.strip();
            if (trimmed.length() > MAX_LENGTH) continue;
            unique.add(trimmed);
            if (unique.size() >= MAX_VALUES) break;
        }
        return List.copyOf(unique);
    }
}
