package com.nca.sistema_miiase_app.domain.entity;

import java.time.LocalDate;
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
import jakarta.persistence.ManyToMany;
import jakarta.persistence.Table;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.Setter;

@Entity
@Getter
@Setter
@Table(name = "fonte")
public class Fonte {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id_fonte")
    private Integer id;

    @Size(max = 200)
    @Column(name = "nome_fonte", length = 200)
    private String nomeFonte;

    @Size(max = 100)
    @Column(name = "tipo_fonte", length = 100)
    private String tipoFonte;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "autores", nullable = false, columnDefinition = "jsonb")
    private List<String> autores = new ArrayList<>();

    @Size(max = 500)
    @Column(name = "titulo", length = 500)
    private String titulo;

    @Size(max = 1000)
    @Column(name = "url", length = 1000)
    private String url;

    @Column(name = "data")
    private LocalDate data;

    @ManyToMany(mappedBy = "fontes")
    private Set<Ocorrencia> ocorrencias = new LinkedHashSet<>();

    public Fonte() {
    }
}
