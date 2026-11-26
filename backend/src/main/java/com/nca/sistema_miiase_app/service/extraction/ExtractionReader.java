package com.nca.sistema_miiase_app.service.extraction;

import java.util.ArrayList;
import java.util.List;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

/**
 * Deterministic, tolerant reader for the extraction JSON sent by the pipeline. It never rejects a
 * payload: it reports the FORM quality (VALIDA, PARCIAL, ILEGIVEL) and recovers every complete
 * occurrence object it can find. Judging the CONTENT is the human curator's job.
 */
public final class ExtractionReader {

    public enum Quality { VALIDA, PARCIAL, ILEGIVEL }

    public record Result(Quality quality, JsonNode source, List<JsonNode> occurrences, String note) { }

    private static final ObjectMapper JSON = new ObjectMapper();

    private ExtractionReader() { }

    public static Result read(String raw) {
        String text = strip(raw);
        try {
            JsonNode root = JSON.readTree(text);
            if (root != null && root.isObject()) {
                List<JsonNode> occurrences = new ArrayList<>();
                root.path("occurrences").forEach(node -> { if (node.isObject()) occurrences.add(node); });
                JsonNode source = root.path("source").isObject() ? root.get("source") : null;
                return new Result(Quality.VALIDA, source, occurrences, null);
            }
        } catch (Exception malformed) {
            // Fall through to salvage below: the pipeline may send truncated or invalid JSON.
        }
        JsonNode source = firstObjectAfter(text, "\"source\"");
        List<JsonNode> occurrences = objectsInArrayAfter(text, "\"occurrences\"");
        if (source == null && occurrences.isEmpty()) {
            return new Result(Quality.ILEGIVEL, null, List.of(),
                    "Não foi possível ler a extração automaticamente. Cure a partir da fonte.");
        }
        return new Result(Quality.PARCIAL, source, occurrences, "JSON inválido; recuperadas automaticamente "
                + occurrences.size() + " ocorrência(s) completa(s). Confira a fonte, pode haver dados faltando.");
    }

    private static String strip(String raw) {
        if (raw == null) return "";
        String text = raw.strip();
        if (text.startsWith("```")) {
            int firstLine = text.indexOf('\n');
            text = firstLine < 0 ? "" : text.substring(firstLine + 1);
            if (text.endsWith("```")) text = text.substring(0, text.length() - 3);
        }
        return text.strip();
    }

    private static JsonNode firstObjectAfter(String text, String key) {
        int at = text.indexOf(key);
        if (at < 0) return null;
        int start = text.indexOf('{', at + key.length());
        int end = start < 0 ? -1 : matchingEnd(text, start);
        return end < 0 ? null : parse(text.substring(start, end + 1));
    }

    private static List<JsonNode> objectsInArrayAfter(String text, String key) {
        List<JsonNode> result = new ArrayList<>();
        int at = text.indexOf(key);
        if (at < 0) return result;
        int position = text.indexOf('[', at + key.length());
        if (position < 0) return result;
        position++;
        while (position < text.length()) {
            char c = text.charAt(position);
            if (c == ']') break;
            if (c == '{') {
                int end = matchingEnd(text, position);
                if (end < 0) break; // truncated object: stop, keep what was complete
                JsonNode node = parse(text.substring(position, end + 1));
                if (node != null && node.isObject()) result.add(node);
                position = end + 1;
            } else {
                position++;
            }
        }
        return result;
    }

    /** Index of the brace closing the object that starts at {@code start}, honoring strings; -1 if truncated. */
    private static int matchingEnd(String text, int start) {
        int depth = 0;
        boolean inString = false;
        for (int i = start; i < text.length(); i++) {
            char c = text.charAt(i);
            if (inString) {
                if (c == '\\') i++;
                else if (c == '"') inString = false;
            } else if (c == '"') {
                inString = true;
            } else if (c == '{') {
                depth++;
            } else if (c == '}' && --depth == 0) {
                return i;
            }
        }
        return -1;
    }

    private static JsonNode parse(String json) {
        try { return JSON.readTree(json); } catch (Exception invalid) { return null; }
    }
}
