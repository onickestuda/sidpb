package com.nca.sistema_miiase_app.domain.entity;

import java.util.LinkedHashSet;
import java.util.Set;

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
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Getter
@Setter
@NoArgsConstructor
@Table(name = "categoria_hospedeiro")
public class CategoriaHospedeiro {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id_categoria")
    private Integer id;

    @NotBlank
    @Size(max = 100)
    @Column(name = "nome_categoria", nullable = false, unique = true, length = 100)
    private String nomeCategoria;

    @OneToMany(mappedBy = "categoria")
    private Set<Hospedeiro> hospedeiros = new LinkedHashSet<>();

    @ManyToMany
    @JoinTable(
            name = "categoria_caracteristica",
            joinColumns = @JoinColumn(name = "id_categoria"),
            inverseJoinColumns = @JoinColumn(name = "id_caracteristica")
    )
    private Set<Caracteristica> caracteristicas = new LinkedHashSet<>();
}
