package com.nca.sistema_miiase_app.domain.entity;

import java.math.BigDecimal;
import java.util.LinkedHashSet;
import java.util.Set;

import org.locationtech.jts.geom.MultiPolygon;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.OneToMany;
import jakarta.persistence.Table;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Getter
@Setter
@NoArgsConstructor
@Table(name = "municipio")
public class Municipio {

    @Id
    @Column(name = "id_municipio")
    private Integer id;

    @NotBlank
    @Size(max = 200)
    @Column(name = "nome", nullable = false, length = 200)
    private String nome;

    @Column(name = "latitude_municipio", precision = 10, scale = 7)
    private BigDecimal latitudeMunicipio;

    @Column(name = "longitude_municipio", precision = 10, scale = 7)
    private BigDecimal longitudeMunicipio;

    @NotNull
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "id_estado", nullable = false)
    private Estado estado;

    @Column(name = "geometria", columnDefinition = "geometry(MultiPolygon,4674)")
    private MultiPolygon geometria;

    @Column(name = "area_km2", precision = 15, scale = 3)
    private BigDecimal areaKm2;

    @OneToMany(mappedBy = "municipio")
    private Set<Local> locais = new LinkedHashSet<>();
}
