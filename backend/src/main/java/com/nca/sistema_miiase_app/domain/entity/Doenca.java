package com.nca.sistema_miiase_app.domain.entity;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.JoinTable;
import jakarta.persistence.ManyToMany;
import jakarta.persistence.OneToMany;
import jakarta.persistence.Table;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.Setter;

@Entity
@Getter
@Setter
@Table(name = "doenca")
public class Doenca {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id_doenca")
    private Integer id;

    @NotBlank
    @Size(max = 200)
    @Column(name = "nome_cientifico", nullable = false, unique = true, length = 200)
    private String nomeCientifico;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "sinonimos", nullable = false, columnDefinition = "jsonb")
    private List<String> sinonimos = new ArrayList<>();

    @OneToMany(mappedBy = "doenca")
    private Set<Ocorrencia> ocorrencias = new LinkedHashSet<>();

    @ManyToMany
    @JoinTable(
            name = "doenca_parasito",
            joinColumns = @JoinColumn(name = "id_doenca"),
            inverseJoinColumns = @JoinColumn(name = "id_parasito")
    )
    private Set<Parasito> parasitos = new LinkedHashSet<>();

    public Doenca() {
    }
}
