package com.nca.sistema_miiase_app.domain.entity;

import java.util.LinkedHashSet;
import java.util.Set;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.ManyToMany;
import jakarta.persistence.Table;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.Setter;

@Entity
@Getter
@Setter
@Table(name = "parasito")
public class Parasito {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id_parasito")
    private Integer id;

    @NotBlank
    @Size(max = 200)
    @Column(name = "nome_cientifico", nullable = false, unique = true, length = 200)
    private String nomeCientifico;

    @Size(max = 100)
    @Column(name = "ordem_taxonomica", length = 100)
    private String ordemTaxonomica;

    @ManyToMany(mappedBy = "parasitos")
    private Set<Doenca> doencas = new LinkedHashSet<>();

    @ManyToMany(mappedBy = "parasitos")
    private Set<Vetor> vetores = new LinkedHashSet<>();

    public Parasito() {
    }
}
