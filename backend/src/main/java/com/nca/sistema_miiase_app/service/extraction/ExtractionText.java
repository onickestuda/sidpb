package com.nca.sistema_miiase_app.service.extraction;

import java.text.Normalizer;
import java.util.Locale;

/** Text helpers shared by the ingestion: accent-free comparison and disease grouping. */
public final class ExtractionText {

    private ExtractionText() { }

    /** "São Paulo", "S~o Paulo", "SAO  PAULO" and "Piauı´" all fold to comparable keys. */
    public static String fold(String value) {
        if (value == null) return "";
        String text = value.replace('ı', 'i');
        text = Normalizer.normalize(text, Normalizer.Form.NFD).replaceAll("\\p{M}+", "");
        return text.toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9]+", " ").strip();
    }

    /** Null for blank or the literal "null" some models emit. */
    public static String clean(String value) {
        if (value == null) return null;
        String text = value.strip();
        return text.isEmpty() || text.equalsIgnoreCase("null") ? null : text;
    }

    /**
     * Groups the many spellings of myiasis ("myiasis", "oral myiasis", "miíase"...) under the
     * curated name; the original wording is kept separately for the curator.
     */
    public static String normalizeDisease(String raw) {
        String text = clean(raw);
        if (text == null) return null;
        String key = fold(text).replace(" ", "");
        if (key.contains("pseudomyias") || key.contains("pseudomiias") || key.contains("pseudomias")) return "Pseudomiíase";
        if (key.contains("myias") || key.contains("miias") || key.contains("miase")) return "Miíase";
        return Character.toUpperCase(text.charAt(0)) + text.substring(1);
    }
}
