package com.nca.sistema_miiase_app.domain.repository;

import java.time.LocalDate;
import java.util.List;

import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.Repository;

import com.nca.sistema_miiase_app.domain.entity.Ocorrencia;

public interface EstatisticasRepository extends Repository<Ocorrencia, Integer> {

    @Query("select count(o) from Ocorrencia o")
    long countTotalOcorrencias();

    @Query("""
            select d.id as doencaId, d.nomeCientifico as nomeCientifico, count(o) as total
            from Ocorrencia o
            join o.doenca d
            group by d.id, d.nomeCientifico
            order by count(o) desc
            """)
    List<ContagemPorDoencaProjection> countOcorrenciasPorDoenca();

    @Query("""
            select e.sigla as uf, count(o) as total
            from Ocorrencia o
            join o.local l
            join l.municipio m
            join m.estado e
            group by e.sigla
            order by count(o) desc
            """)
    List<ContagemPorUfProjection> countOcorrenciasPorUf();

    @Query("""
            select m.nome as cidade, count(o) as total
            from Ocorrencia o
            join o.local l
            join l.municipio m
            group by m.nome
            order by count(o) desc
            """)
    List<ContagemPorCidadeProjection> countOcorrenciasPorCidade();

    @Query("""
            select v.id as vetorId, v.nomeCientifico as nomeCientifico, count(o) as total
            from Ocorrencia o
            join o.vetor v
            group by v.id, v.nomeCientifico
            order by count(o) desc
            """)
    List<ContagemPorVetorProjection> countOcorrenciasPorVetor();

    @Query("""
            select p.id as parasitoId, p.nomeCientifico as nomeCientifico, count(o) as total
            from Ocorrencia o
            join o.parasito p
            group by p.id, p.nomeCientifico
            order by count(o) desc
            """)
    List<ContagemPorParasitoProjection> countOcorrenciasPorParasito();

    @Query(
            value = """
                    select date_trunc('month', o.data)::date as periodo, count(*) as total
                    from "ocorrencia" o
                    group by date_trunc('month', o.data)::date
                    order by periodo
                    """,
            nativeQuery = true
    )
    List<SerieTemporalMensalProjection> serieTemporalMensalOcorrencias();

    interface ContagemPorDoencaProjection {
        Integer getDoencaId();
        String getNomeCientifico();
        Long getTotal();
    }

    interface ContagemPorUfProjection {
        String getUf();
        Long getTotal();
    }

    interface ContagemPorCidadeProjection {
        String getCidade();
        Long getTotal();
    }

    interface ContagemPorVetorProjection {
        Integer getVetorId();
        String getNomeCientifico();
        Long getTotal();
    }

    interface ContagemPorParasitoProjection {
        Integer getParasitoId();
        String getNomeCientifico();
        Long getTotal();
    }

    interface SerieTemporalMensalProjection {
        LocalDate getPeriodo();
        Long getTotal();
    }
}
