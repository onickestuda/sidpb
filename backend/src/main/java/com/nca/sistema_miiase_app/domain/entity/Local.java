package com.nca.sistema_miiase_app.domain.entity;

import java.math.BigDecimal;
import java.util.LinkedHashSet;
import java.util.Set;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.OneToMany;
import jakarta.persistence.Table;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.Setter;

@Entity
@Getter
@Setter
@Table(name = "local")
public class Local {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id_local")
    private Integer id;

    @Size(max = 100)
    @Column(name = "bairro", length = 100)
    private String bairro;

    @Column(name = "latitude_ocorrencia", precision = 10, scale = 7)
    private BigDecimal latitudeOcorrencia;

    @Column(name = "longitude_ocorrencia", precision = 10, scale = 7)
    private BigDecimal longitudeOcorrencia;

    @NotNull
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "id_municipio", nullable = false)
    private Municipio municipio;

    @OneToMany(mappedBy = "local")
    private Set<Ocorrencia> ocorrencias = new LinkedHashSet<>();

    public Local() {
    }
}
