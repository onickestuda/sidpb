package com.nca.sistema_miiase_app.domain.repository;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.nca.sistema_miiase_app.domain.entity.Ocorrencia;

public interface OcorrenciaRepository extends JpaRepository<Ocorrencia, Integer> {

    @Query(
            value = """
                    select
                        o.id_ocorrencia as idOcorrencia,
                        o.data as dataOcorrencia,
                        d.nome_cientifico as doencaNomeCientifico,
                        d.sinonimos::text as doencaNomeComum,
                        h.nome_cientifico as hospedeiroEspecie,
                        e.sigla as localUf,
                        m.nome as localCidade,
                        l.bairro as localBairro,
                        v.nome_cientifico as vetorNomeCientifico,
                        f.tipo_fonte as tipoFonte,
                        f.nome_fonte as nomeFonte
                    from "ocorrencia" o
                    join "doenca" d on d.id_doenca = o.id_doenca
                    join "hospedeiro" h on h.id_hospedeiro = o.id_hospedeiro
                    join "local" l on l.id_local = o.id_local
                    join "municipio" m on m.id_municipio = l.id_municipio
                    join "estado" e on e.id_estado = m.id_estado
                    left join "vetor" v on v.id_vetor = o.id_vetor
                    left join (
                        select of1.id_ocorrencia, min(of1.id_fonte) as id_fonte
                        from "ocorrencia_fonte" of1
                        group by of1.id_ocorrencia
                    ) of_min on of_min.id_ocorrencia = o.id_ocorrencia
                    left join "fonte" f on f.id_fonte = of_min.id_fonte
                    where o.id_ocorrencia = :id
                    """,
            nativeQuery = true
    )
    Optional<OcorrenciaResumoProjection> findResumoById(@Param("id") Integer id);

    @Query(
            value = """
                    select
                        o.id_ocorrencia as idOcorrencia,
                        o.data as dataOcorrencia,
                        d.nome_cientifico as doencaNomeCientifico,
                        d.sinonimos::text as doencaNomeComum,
                        h.nome_cientifico as hospedeiroEspecie,
                        e.sigla as localUf,
                        m.nome as localCidade,
                        l.bairro as localBairro,
                        v.nome_cientifico as vetorNomeCientifico,
                        f.tipo_fonte as tipoFonte,
                        f.nome_fonte as nomeFonte
                    from "ocorrencia" o
                    join "doenca" d on d.id_doenca = o.id_doenca
                    join "hospedeiro" h on h.id_hospedeiro = o.id_hospedeiro
                    join "categoria_hospedeiro" ch on ch.id_categoria = h.id_categoria
                    join "local" l on l.id_local = o.id_local
                    join "municipio" m on m.id_municipio = l.id_municipio
                    join "estado" e on e.id_estado = m.id_estado
                    left join "vetor" v on v.id_vetor = o.id_vetor
                    left join (
                        select of1.id_ocorrencia, min(of1.id_fonte) as id_fonte
                        from "ocorrencia_fonte" of1
                        group by of1.id_ocorrencia
                    ) of_min on of_min.id_ocorrencia = o.id_ocorrencia
                    left join "fonte" f on f.id_fonte = of_min.id_fonte
                    where (:uf is null or e.sigla = :uf)
                      and (:cidade is null or lower(m.nome) = lower(:cidade))
                      and (:anoInicial is null or extract(year from o.data) >= :anoInicial)
                      and (:anoFinal is null or extract(year from o.data) <= :anoFinal)
                      and (:doencaId is null or o.id_doenca = :doencaId)
                      and (:vetorId is null or o.id_vetor = :vetorId)
                      and (:parasitaId is null or o.id_parasito = :parasitaId)
                      and (
                            (:fonteId is null and :tipoFonte is null)
                            or exists (
                                select 1
                                from "ocorrencia_fonte" of2
                                join "fonte" f2 on f2.id_fonte = of2.id_fonte
                                where of2.id_ocorrencia = o.id_ocorrencia
                                  and (:fonteId is null or f2.id_fonte = :fonteId)
                                  and (:tipoFonte is null or lower(f2.tipo_fonte) = lower(:tipoFonte))
                            )
                      )
                      and (:categoriaHospedeiro is null or ch.nome_categoria = :categoriaHospedeiro)
                    order by o.data desc, o.id_ocorrencia desc
                    """,
            nativeQuery = true
    )
    List<OcorrenciaResumoProjection> findOcorrenciasParaResumoFiltradas(
            @Param("uf") String uf,
            @Param("cidade") String cidade,
            @Param("anoInicial") Integer anoInicial,
            @Param("anoFinal") Integer anoFinal,
            @Param("categoriaHospedeiro") String categoriaHospedeiro,
            @Param("doencaId") Integer doencaId,
            @Param("vetorId") Integer vetorId,
            @Param("parasitaId") Integer parasitaId,
            @Param("fonteId") Integer fonteId,
            @Param("tipoFonte") String tipoFonte
    );

    @Query(
            value = """
                    select
                        l.id_local as idLocal,
                        m.nome as cidade,
                        e.sigla as uf,
                        coalesce(l.latitude_ocorrencia, m.latitude_municipio) as latitude,
                        coalesce(l.longitude_ocorrencia, m.longitude_municipio) as longitude,
                        count(distinct o.id_ocorrencia) as totalOcorrencias
                    from "ocorrencia" o
                    join "hospedeiro" h on h.id_hospedeiro = o.id_hospedeiro
                    join "categoria_hospedeiro" ch on ch.id_categoria = h.id_categoria
                    join "local" l on l.id_local = o.id_local
                    join "municipio" m on m.id_municipio = l.id_municipio
                    join "estado" e on e.id_estado = m.id_estado
                    where (:uf is null or e.sigla = :uf)
                      and (:cidade is null or lower(m.nome) = lower(:cidade))
                      and (:anoInicial is null or extract(year from o.data) >= :anoInicial)
                      and (:anoFinal is null or extract(year from o.data) <= :anoFinal)
                      and (:doencaId is null or o.id_doenca = :doencaId)
                      and (:vetorId is null or o.id_vetor = :vetorId)
                      and (:parasitaId is null or o.id_parasito = :parasitaId)
                      and (
                            (:fonteId is null and :tipoFonte is null)
                            or exists (
                                select 1
                                from "ocorrencia_fonte" of2
                                join "fonte" f2 on f2.id_fonte = of2.id_fonte
                                where of2.id_ocorrencia = o.id_ocorrencia
                                  and (:fonteId is null or f2.id_fonte = :fonteId)
                                  and (:tipoFonte is null or lower(f2.tipo_fonte) = lower(:tipoFonte))
                            )
                      )
                      and (:categoriaHospedeiro is null or ch.nome_categoria = :categoriaHospedeiro)
                    group by
                        l.id_local,
                        m.nome,
                        e.sigla,
                        l.latitude_ocorrencia,
                        l.longitude_ocorrencia,
                        m.latitude_municipio,
                        m.longitude_municipio
                    order by totalOcorrencias desc, l.id_local asc
                    """,
            nativeQuery = true
    )
    List<PontoMapaProjection> findPontosMapaAgregadosFiltrados(
            @Param("uf") String uf,
            @Param("cidade") String cidade,
            @Param("anoInicial") Integer anoInicial,
            @Param("anoFinal") Integer anoFinal,
            @Param("categoriaHospedeiro") String categoriaHospedeiro,
            @Param("doencaId") Integer doencaId,
            @Param("vetorId") Integer vetorId,
            @Param("parasitaId") Integer parasitaId,
            @Param("fonteId") Integer fonteId,
            @Param("tipoFonte") String tipoFonte
    );

    @Query("""
            select distinct o
            from Ocorrencia o
            join fetch o.local l
            join fetch l.municipio m
            join fetch m.estado e
            join fetch o.hospedeiro h
            join fetch h.categoria c
            join fetch o.doenca d
            join fetch o.parasito p
            left join fetch o.vetor v
            left join fetch o.fontes f
            order by o.data desc, o.id desc
            """)
    List<Ocorrencia> findOcorrenciasParaMapa();

    @Query("""
            select distinct o
            from Ocorrencia o
            join fetch o.local l
            join fetch l.municipio m
            join fetch m.estado e
            join fetch o.hospedeiro h
            join fetch h.categoria c
            join fetch o.doenca d
            join fetch o.parasito p
            left join fetch o.vetor v
            left join fetch o.fontes f
            where o.id = :id
            """)
    Optional<Ocorrencia> findDetalheById(@Param("id") Integer id);

    interface OcorrenciaResumoProjection {
        Integer getIdOcorrencia();
        LocalDate getDataOcorrencia();
        String getDoencaNomeCientifico();
        String getDoencaNomeComum();
        String getHospedeiroEspecie();
        String getLocalUf();
        String getLocalCidade();
        String getLocalBairro();
        String getVetorNomeCientifico();
        String getTipoFonte();
        String getNomeFonte();
    }

    interface PontoMapaProjection {
        Integer getIdLocal();
        String getCidade();
        String getUf();
        BigDecimal getLatitude();
        BigDecimal getLongitude();
        Long getTotalOcorrencias();
    }
}
