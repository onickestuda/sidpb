package com.nca.sistema_miiase_app.domain.entity;

import java.math.BigDecimal;
import java.util.LinkedHashSet;
import java.util.Set;

import org.locationtech.jts.geom.MultiPolygon;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.OneToMany;
import jakarta.persistence.Table;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Getter
@Setter
@NoArgsConstructor
@Table(name = "regiao")
public class Regiao {

    @Id
    @Column(name = "id_regiao")
    private Integer id;

    @NotBlank
    @Size(max = 2)
    @Column(name = "sigla", nullable = false, unique = true, length = 2)
    private String sigla;

    @NotBlank
    @Size(max = 100)
    @Column(name = "nome", nullable = false, unique = true, length = 100)
    private String nome;

    @Column(name = "latitude_regiao", precision = 10, scale = 7)
    private BigDecimal latitudeRegiao;

    @Column(name = "longitude_regiao", precision = 10, scale = 7)
    private BigDecimal longitudeRegiao;

    @Column(name = "geometria", columnDefinition = "geometry(MultiPolygon,4674)")
    private MultiPolygon geometria;

    @Column(name = "area_km2", precision = 15, scale = 3)
    private BigDecimal areaKm2;

    @OneToMany(mappedBy = "regiao")
    private Set<Estado> estados = new LinkedHashSet<>();
}
