package com.nca.sistema_miiase_app.service.extraction;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

/** Loads the IBGE states/municipalities once (≈5.6k rows) for in-memory, accent-free matching. */
@Component
public class LocationIndex {

    private final JdbcTemplate jdbc;
    private volatile LocationResolver resolver;

    public LocationIndex(JdbcTemplate jdbc) { this.jdbc = jdbc; }

    public LocationResolver resolver() {
        LocationResolver current = resolver;
        if (current == null) {
            synchronized (this) {
                if (resolver == null) resolver = load();
                current = resolver;
            }
        }
        return current;
    }

    private LocationResolver load() {
        var states = jdbc.query("SELECT id_estado, sigla, nome, latitude_estado, longitude_estado FROM estado",
                (rs, row) -> new LocationResolver.State(rs.getInt(1), rs.getString(2), rs.getString(3),
                        rs.getBigDecimal(4), rs.getBigDecimal(5)));
        var municipalities = jdbc.query(
                "SELECT id_municipio, nome, id_estado, latitude_municipio, longitude_municipio FROM municipio",
                (rs, row) -> new LocationResolver.Municipality(rs.getInt(1), rs.getString(2), rs.getInt(3),
                        rs.getBigDecimal(4), rs.getBigDecimal(5)));
        return new LocationResolver(states, municipalities);
    }
}
