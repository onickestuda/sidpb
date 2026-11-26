package com.nca.sistema_miiase_app.service.extraction;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Resolves the free-text municipality/state written by the LLM against the IBGE base, reporting
 * how precise the result is. Nothing is guessed: ambiguous names never become a point on the map.
 */
public final class LocationResolver {

    public enum Precision { EXATA, MUNICIPIO, ESTADO, SEM_LOCAL }

    public record State(int id, String acronym, String name, BigDecimal latitude, BigDecimal longitude) { }
    public record Municipality(int id, String name, int stateId, BigDecimal latitude, BigDecimal longitude) { }
    public record Resolution(Precision precision, Integer municipalityId, Integer stateId,
                             BigDecimal latitude, BigDecimal longitude, String note) { }

    private final Map<String, State> statesByKey = new HashMap<>();
    private final Map<Integer, State> statesById = new HashMap<>();
    private final Map<String, List<Municipality>> municipalitiesByName = new HashMap<>();

    public LocationResolver(List<State> states, List<Municipality> municipalities) {
        for (State state : states) {
            statesById.put(state.id(), state);
            statesByKey.put(ExtractionText.fold(state.acronym()), state);
            statesByKey.put(ExtractionText.fold(state.name()), state);
        }
        for (Municipality municipality : municipalities) {
            municipalitiesByName.computeIfAbsent(ExtractionText.fold(municipality.name()), key -> new ArrayList<>()).add(municipality);
        }
    }

    public Resolution resolve(String municipalityText, String stateText, BigDecimal latitude, BigDecimal longitude) {
        State state = statesByKey.get(ExtractionText.fold(ExtractionText.clean(stateText)));
        String municipality = ExtractionText.clean(municipalityText);
        List<Municipality> candidates = municipality == null ? List.of()
                : municipalitiesByName.getOrDefault(ExtractionText.fold(municipality), List.of());
        List<Municipality> inState = state == null ? candidates
                : candidates.stream().filter(candidate -> candidate.stateId() == state.id()).toList();

        Municipality match = inState.size() == 1 ? inState.get(0)
                // State text unreadable/wrong but the name exists in a single place: still unambiguous.
                : inState.isEmpty() && candidates.size() == 1 ? candidates.get(0) : null;
        String note = match != null && state == null && stateText != null && ExtractionText.clean(stateText) != null
                ? "UF da extração não reconhecida (\"" + stateText.strip() + "\"); município único no país." : null;

        if (latitude != null && longitude != null && validCoordinate(latitude, longitude)) {
            return new Resolution(Precision.EXATA, match == null ? null : match.id(),
                    match != null ? Integer.valueOf(match.stateId()) : state == null ? null : state.id(), latitude, longitude, note);
        }
        if (match != null) {
            return new Resolution(Precision.MUNICIPIO, match.id(), match.stateId(), match.latitude(), match.longitude(), note);
        }
        String ambiguity = inState.size() > 1 || (state == null && candidates.size() > 1)
                ? "Município \"" + municipality + "\" existe em mais de uma UF; local não confirmado." : null;
        if (municipality != null && ambiguity == null && candidates.isEmpty()) {
            ambiguity = "Município \"" + municipality + "\" não encontrado na base do IBGE.";
        }
        if (state != null) {
            return new Resolution(Precision.ESTADO, null, state.id(), null, null, ambiguity);
        }
        return new Resolution(Precision.SEM_LOCAL, null, null, null, null, ambiguity);
    }

    public State state(Integer id) { return id == null ? null : statesById.get(id); }

    private static boolean validCoordinate(BigDecimal latitude, BigDecimal longitude) {
        return latitude.abs().compareTo(BigDecimal.valueOf(90)) <= 0 && longitude.abs().compareTo(BigDecimal.valueOf(180)) <= 0;
    }
}
