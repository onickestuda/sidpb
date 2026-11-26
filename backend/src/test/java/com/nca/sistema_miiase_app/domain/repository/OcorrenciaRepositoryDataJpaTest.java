package com.nca.sistema_miiase_app.domain.repository;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;

import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.data.jpa.test.autoconfigure.DataJpaTest;
import org.springframework.boot.jdbc.test.autoconfigure.AutoConfigureTestDatabase;
import org.springframework.test.context.ActiveProfiles;

import com.nca.sistema_miiase_app.domain.entity.CategoriaHospedeiro;
import com.nca.sistema_miiase_app.domain.entity.Doenca;
import com.nca.sistema_miiase_app.domain.entity.Estado;
import com.nca.sistema_miiase_app.domain.entity.Fonte;
import com.nca.sistema_miiase_app.domain.entity.Hospedeiro;
import com.nca.sistema_miiase_app.domain.entity.Local;
import com.nca.sistema_miiase_app.domain.entity.Municipio;
import com.nca.sistema_miiase_app.domain.entity.Ocorrencia;
import com.nca.sistema_miiase_app.domain.entity.Parasito;
import com.nca.sistema_miiase_app.domain.entity.Regiao;
import com.nca.sistema_miiase_app.domain.entity.Vetor;

@DataJpaTest
@ActiveProfiles("test")
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
class OcorrenciaRepositoryDataJpaTest {

    @Autowired
    private EntityManager entityManager;

    @Autowired
    private OcorrenciaRepository ocorrenciaRepository;

    @Test
    void deveRetornarTodasOcorrenciasSemFiltro() {
        BaseIds ids = persistirMassaParaFiltros();

        List<OcorrenciaRepository.OcorrenciaResumoProjection> resultados = ocorrenciaRepository
                .findOcorrenciasParaResumoFiltradas(null, null, null, null, null, null, null, null, null, null);

        assertEquals(4, resultados.size());
        assertEquals(ids.ocorrencia4Id(), resultados.get(0).getIdOcorrencia());
        assertEquals(ids.ocorrencia1Id(), resultados.get(3).getIdOcorrencia());
    }

    @Test
    void deveFiltrarPorUf() {
        persistirMassaParaFiltros();

        List<OcorrenciaRepository.OcorrenciaResumoProjection> resultados = ocorrenciaRepository
                .findOcorrenciasParaResumoFiltradas("MA", null, null, null, null, null, null, null, null, null);

        assertEquals(2, resultados.size());
    }

    @Test
    void deveFiltrarPorCidadeComCaseInsensitive() {
        persistirMassaParaFiltros();

        List<OcorrenciaRepository.OcorrenciaResumoProjection> resultados = ocorrenciaRepository
                .findOcorrenciasParaResumoFiltradas(null, "sao luis", null, null, null, null, null, null, null, null);

        assertEquals(1, resultados.size());
        assertEquals("Sao Luis", resultados.getFirst().getLocalCidade());
    }

    @Test
    void deveFiltrarPorIntervaloDeAnosInclusivo() {
        persistirMassaParaFiltros();

        List<OcorrenciaRepository.OcorrenciaResumoProjection> resultados = ocorrenciaRepository
                .findOcorrenciasParaResumoFiltradas(null, null, 2021, 2022, null, null, null, null, null, null);

        assertEquals(2, resultados.size());
        assertEquals(LocalDate.of(2022, 5, 5), resultados.get(0).getDataOcorrencia());
        assertEquals(LocalDate.of(2021, 3, 20), resultados.get(1).getDataOcorrencia());
    }

    @Test
    void deveFiltrarPorDoenca() {
        BaseIds ids = persistirMassaParaFiltros();

        List<OcorrenciaRepository.OcorrenciaResumoProjection> resultados = ocorrenciaRepository
                .findOcorrenciasParaResumoFiltradas(null, null, null, null, null, ids.doencaAId(), null, null, null, null);

        assertEquals(2, resultados.size());
    }

    @Test
    void deveFiltrarPorVetorEParasitaComAndCoerente() {
        BaseIds ids = persistirMassaParaFiltros();

        List<OcorrenciaRepository.OcorrenciaResumoProjection> resultados = ocorrenciaRepository
                .findOcorrenciasParaResumoFiltradas(
                        null, null, null, null, null, null,
                        ids.vetorAId(), ids.parasitaAId(), null, null
                );

        assertEquals(2, resultados.size());
    }

    @Test
    void deveRetornarVazioQuandoVetorEParasitaNaoCombinam() {
        BaseIds ids = persistirMassaParaFiltros();

        List<OcorrenciaRepository.OcorrenciaResumoProjection> resultados = ocorrenciaRepository
                .findOcorrenciasParaResumoFiltradas(
                        null, null, null, null, null, null,
                        ids.vetorAId(), ids.parasitaBId(), null, null
                );

        assertTrue(resultados.isEmpty());
    }

    @Test
    void deveFiltrarPorFonteETipoFonteComAnd() {
        BaseIds ids = persistirMassaParaFiltros();

        List<OcorrenciaRepository.OcorrenciaResumoProjection> resultados = ocorrenciaRepository
                .findOcorrenciasParaResumoFiltradas(
                        null, null, null, null, null, null, null, null,
                        ids.fonteArtigoId(), "artigo"
                );

        assertEquals(2, resultados.size());
    }

    @Test
    void deveRetornarVazioQuandoFonteETipoNaoCombinam() {
        BaseIds ids = persistirMassaParaFiltros();

        List<OcorrenciaRepository.OcorrenciaResumoProjection> resultados = ocorrenciaRepository
                .findOcorrenciasParaResumoFiltradas(
                        null, null, null, null, null, null, null, null,
                        ids.fonteArtigoId(), "tese"
                );

        assertTrue(resultados.isEmpty());
    }

    @Test
    void deveFiltrarPorCategoriaHospedeiro() {
        persistirMassaParaFiltros();

        List<OcorrenciaRepository.OcorrenciaResumoProjection> resultados = ocorrenciaRepository
                .findOcorrenciasParaResumoFiltradas(
                        null, null, null, null, "HUMANO", null, null, null, null, null
                );

        assertEquals(1, resultados.size());
        assertEquals("Homo sapiens", resultados.getFirst().getHospedeiroEspecie());
    }

    @Test
    void deveAgregarPontosMapaPorLocal() {
        persistirMassaParaFiltros();

        List<OcorrenciaRepository.PontoMapaProjection> resultados = ocorrenciaRepository
                .findPontosMapaAgregadosFiltrados(null, null, null, null, null, null, null, null, null, null);

        assertEquals(4, resultados.size());
        long total = resultados.stream().mapToLong(OcorrenciaRepository.PontoMapaProjection::getTotalOcorrencias).sum();
        assertEquals(4L, total);
    }

    @Test
    void deveSomarOcorrenciasNoMesmoPontoDeMapa() {
        BaseIds ids = persistirMassaParaFiltros();
        Ocorrencia base = entityManager.find(Ocorrencia.class, ids.ocorrencia1Id());

        criarOcorrencia(
                LocalDate.of(2024, 1, 10),
                base.getLocal(),
                base.getHospedeiro(),
                base.getDoenca(),
                base.getParasito(),
                base.getVetor(),
                base.getFontes()
        );
        entityManager.flush();
        entityManager.clear();

        List<OcorrenciaRepository.PontoMapaProjection> resultados = ocorrenciaRepository
                .findPontosMapaAgregadosFiltrados(null, null, null, null, null, null, null, null, null, null);

        assertEquals(4, resultados.size());
        long total = resultados.stream().mapToLong(OcorrenciaRepository.PontoMapaProjection::getTotalOcorrencias).sum();
        assertEquals(5L, total);

        OcorrenciaRepository.PontoMapaProjection pontoSaoLuis = resultados.stream()
                .filter(ponto -> "Sao Luis".equals(ponto.getCidade()) && "MA".equals(ponto.getUf()))
                .findFirst()
                .orElseThrow();
        assertEquals(2L, pontoSaoLuis.getTotalOcorrencias());
    }

    @Test
    void deveFiltrarPontosMapaPorVetorParasitaEFonteTipoFonte() {
        BaseIds ids = persistirMassaParaFiltros();

        List<OcorrenciaRepository.PontoMapaProjection> porVetorParasita = ocorrenciaRepository
                .findPontosMapaAgregadosFiltrados(
                        null, null, null, null, null, null,
                        ids.vetorAId(), ids.parasitaAId(), null, null
                );
        assertEquals(2, porVetorParasita.size());

        List<OcorrenciaRepository.PontoMapaProjection> porFonteTipoFonte = ocorrenciaRepository
                .findPontosMapaAgregadosFiltrados(
                        null, null, null, null, null, null,
                        null, null, ids.fonteArtigoId(), "artigo"
                );
        assertEquals(2, porFonteTipoFonte.size());
    }

    @Test
    void deveUsarCoordenadasDoLocalComFallbackParaMunicipio() {
        persistirMassaParaFiltros();

        List<OcorrenciaRepository.PontoMapaProjection> resultados = ocorrenciaRepository
                .findPontosMapaAgregadosFiltrados(null, null, null, null, null, null, null, null, null, null);

        OcorrenciaRepository.PontoMapaProjection pontoSaoLuis = resultados.stream()
                .filter(ponto -> "Sao Luis".equals(ponto.getCidade()) && "MA".equals(ponto.getUf()))
                .findFirst()
                .orElseThrow();

        assertEquals(0, pontoSaoLuis.getLatitude().compareTo(new BigDecimal("-2.5307")));
        assertEquals(0, pontoSaoLuis.getLongitude().compareTo(new BigDecimal("-44.3028")));

        OcorrenciaRepository.PontoMapaProjection pontoNiteroi = resultados.stream()
                .filter(ponto -> "Niteroi".equals(ponto.getCidade()) && "RJ".equals(ponto.getUf()))
                .findFirst()
                .orElseThrow();

        assertEquals(0, pontoNiteroi.getLatitude().compareTo(new BigDecimal("-22.8832")));
        assertEquals(0, pontoNiteroi.getLongitude().compareTo(new BigDecimal("-43.1034")));
    }

    @Test
    void deveBuscarResumoPorId() {
        BaseIds ids = persistirMassaParaFiltros();

        Optional<OcorrenciaRepository.OcorrenciaResumoProjection> resultado =
                ocorrenciaRepository.findResumoById(ids.ocorrencia1Id());

        assertTrue(resultado.isPresent());
        assertEquals(ids.ocorrencia1Id(), resultado.get().getIdOcorrencia());
        assertEquals("artigo", resultado.get().getTipoFonte());
        assertEquals("[\"A\"]", resultado.get().getDoencaNomeComum());
    }

    private BaseIds persistirMassaParaFiltros() {
        Regiao nordeste = obterOuCriarRegiao(2, "NE", "Nordeste");
        Regiao sudeste = obterOuCriarRegiao(3, "SE", "Sudeste");

        Estado maranhao = obterOuCriarEstado(21, "MA", "Maranhao", nordeste);
        Estado saoPaulo = obterOuCriarEstado(35, "SP", "Sao Paulo", sudeste);
        Estado rioJaneiro = obterOuCriarEstado(33, "RJ", "Rio de Janeiro", sudeste);

        Municipio saoLuis = obterOuCriarMunicipio(2111300, "Sao Luis", "-2.5299", "-44.3019", maranhao);
        Municipio imperatriz = obterOuCriarMunicipio(2105302, "Imperatriz", "-5.5263", "-47.4916", maranhao);
        Municipio campinas = obterOuCriarMunicipio(3509502, "Campinas", "-22.9053", "-47.0632", saoPaulo);
        Municipio niteroi = obterOuCriarMunicipio(3303302, "Niteroi", "-22.8832", "-43.1034", rioJaneiro);

        CategoriaHospedeiro categoriaHumano = obterOuCriarCategoria("HUMANO");
        CategoriaHospedeiro categoriaCompanhia = obterOuCriarCategoria("ANIMAL_COMPANHIA");
        CategoriaHospedeiro categoriaSelvagem = obterOuCriarCategoria("ANIMAL_SELVAGEM");
        CategoriaHospedeiro categoriaProducao = obterOuCriarCategoria("ANIMAL_PRODUCAO");

        Doenca doencaA = new Doenca();
        doencaA.setNomeCientifico("Doenca A");
        doencaA.setSinonimos(List.of("A"));
        entityManager.persist(doencaA);

        Doenca doencaB = new Doenca();
        doencaB.setNomeCientifico("Doenca B");
        doencaB.setSinonimos(List.of("B"));
        entityManager.persist(doencaB);

        Parasito parasitaA = new Parasito();
        parasitaA.setNomeCientifico("Parasito A");
        entityManager.persist(parasitaA);

        Parasito parasitaB = new Parasito();
        parasitaB.setNomeCientifico("Parasito B");
        entityManager.persist(parasitaB);

        doencaA.getParasitos().add(parasitaA);
        doencaB.getParasitos().add(parasitaB);

        Vetor vetorA = new Vetor();
        vetorA.setNomeCientifico("Vetor A");
        vetorA.setSinonimos(List.of("VA"));
        entityManager.persist(vetorA);

        Vetor vetorB = new Vetor();
        vetorB.setNomeCientifico("Vetor B");
        vetorB.setSinonimos(List.of("VB"));
        entityManager.persist(vetorB);

        vetorA.getParasitos().add(parasitaA);
        vetorB.getParasitos().add(parasitaB);

        Fonte fonteArtigo = new Fonte();
        fonteArtigo.setNomeFonte("Fonte Artigo");
        fonteArtigo.setTipoFonte("artigo");
        fonteArtigo.setAutores(List.of("Autor A"));
        fonteArtigo.setData(LocalDate.of(2020, 1, 1));
        entityManager.persist(fonteArtigo);

        Fonte fonteRelatorio = new Fonte();
        fonteRelatorio.setNomeFonte("Fonte Relatorio");
        fonteRelatorio.setTipoFonte("relatorio");
        fonteRelatorio.setAutores(List.of("Autor B"));
        fonteRelatorio.setData(LocalDate.of(2021, 1, 1));
        entityManager.persist(fonteRelatorio);

        Fonte fonteTese = new Fonte();
        fonteTese.setNomeFonte("Fonte Tese");
        fonteTese.setTipoFonte("tese");
        fonteTese.setAutores(List.of("Autor C"));
        fonteTese.setData(LocalDate.of(2022, 1, 1));
        entityManager.persist(fonteTese);

        Local localMaSaoLuis = criarLocal(saoLuis, "Centro", "-44.3028", "-2.5307");
        Local localMaImperatriz = criarLocal(imperatriz, "Centro", "-47.4917", "-5.5264");
        Local localSpCampinas = criarLocal(campinas, "Centro", "-47.0608", "-22.9056");
        Local localRjNiteroi = criarLocal(niteroi, "Centro", null, null);

        Hospedeiro hospedeiroHumano = criarHospedeiro("Homo sapiens", categoriaHumano);
        Hospedeiro hospedeiroCompanhia = criarHospedeiro("Canis lupus familiaris", categoriaCompanhia);
        Hospedeiro hospedeiroSelvagem = criarHospedeiro("Mazama americana", categoriaSelvagem);
        Hospedeiro hospedeiroProducao = criarHospedeiro("Bos taurus", categoriaProducao);

        entityManager.flush();

        Integer ocorrencia1Id = criarOcorrencia(
                LocalDate.of(2020, 1, 10),
                localMaSaoLuis,
                hospedeiroHumano,
                doencaA,
                parasitaA,
                vetorA,
                Set.of(fonteArtigo, fonteRelatorio)
        );

        Integer ocorrencia2Id = criarOcorrencia(
                LocalDate.of(2021, 3, 20),
                localMaImperatriz,
                hospedeiroCompanhia,
                doencaB,
                parasitaB,
                vetorB,
                Set.of(fonteTese)
        );

        Integer ocorrencia3Id = criarOcorrencia(
                LocalDate.of(2022, 5, 5),
                localSpCampinas,
                hospedeiroSelvagem,
                doencaA,
                parasitaA,
                vetorA,
                Set.of(fonteRelatorio)
        );

        Integer ocorrencia4Id = criarOcorrencia(
                LocalDate.of(2023, 7, 15),
                localRjNiteroi,
                hospedeiroProducao,
                doencaB,
                parasitaB,
                vetorB,
                Set.of(fonteArtigo)
        );

        entityManager.flush();
        entityManager.clear();

        return new BaseIds(
                doencaA.getId(),
                vetorA.getId(),
                parasitaA.getId(),
                parasitaB.getId(),
                fonteArtigo.getId(),
                ocorrencia1Id,
                ocorrencia2Id,
                ocorrencia3Id,
                ocorrencia4Id
        );
    }

    private Regiao obterOuCriarRegiao(Integer id, String sigla, String nome) {
        Regiao regiao = entityManager.find(Regiao.class, id);
        if (regiao == null) {
            regiao = new Regiao();
            regiao.setId(id);
            regiao.setSigla(sigla);
            regiao.setNome(nome);
            entityManager.persist(regiao);
        }
        return regiao;
    }

    private Estado obterOuCriarEstado(Integer id, String sigla, String nome, Regiao regiao) {
        Estado estado = entityManager.find(Estado.class, id);
        if (estado == null) {
            estado = new Estado();
            estado.setId(id);
            estado.setSigla(sigla);
            estado.setNome(nome);
            estado.setRegiao(regiao);
            entityManager.persist(estado);
        }
        return estado;
    }

    private Municipio obterOuCriarMunicipio(Integer id, String nome, String latitude, String longitude, Estado estado) {
        Municipio municipio = entityManager.find(Municipio.class, id);
        if (municipio == null) {
            municipio = new Municipio();
            municipio.setId(id);
            municipio.setNome(nome);
            municipio.setLatitudeMunicipio(new BigDecimal(latitude));
            municipio.setLongitudeMunicipio(new BigDecimal(longitude));
            municipio.setEstado(estado);
            entityManager.persist(municipio);
        }
        return municipio;
    }

    private CategoriaHospedeiro obterOuCriarCategoria(String nome) {
        Optional<CategoriaHospedeiro> existente = entityManager
                .createQuery(
                        "select c from CategoriaHospedeiro c where c.nomeCategoria = :nome",
                        CategoriaHospedeiro.class
                )
                .setParameter("nome", nome)
                .getResultStream()
                .findFirst();

        if (existente.isPresent()) {
            return existente.get();
        }

        CategoriaHospedeiro categoria = new CategoriaHospedeiro();
        categoria.setNomeCategoria(nome);
        entityManager.persist(categoria);
        return categoria;
    }

    private Local criarLocal(Municipio municipio, String bairro, String longitude, String latitude) {
        Local local = new Local();
        local.setMunicipio(municipio);
        local.setBairro(bairro);
        if (longitude != null) {
            local.setLongitudeOcorrencia(new BigDecimal(longitude));
        }
        if (latitude != null) {
            local.setLatitudeOcorrencia(new BigDecimal(latitude));
        }
        entityManager.persist(local);
        return local;
    }

    private Hospedeiro criarHospedeiro(String nomeCientifico, CategoriaHospedeiro categoria) {
        Hospedeiro hospedeiro = new Hospedeiro();
        hospedeiro.setNomeCientifico(nomeCientifico);
        hospedeiro.setCategoria(categoria);
        entityManager.persist(hospedeiro);
        return hospedeiro;
    }

    private Integer criarOcorrencia(
            LocalDate data,
            Local local,
            Hospedeiro hospedeiro,
            Doenca doenca,
            Parasito parasito,
            Vetor vetor,
            Set<Fonte> fontes
    ) {
        Ocorrencia ocorrencia = new Ocorrencia();
        ocorrencia.setData(data);
        ocorrencia.setParteCorpo("perna");
        ocorrencia.setTratamento("limpeza");
        ocorrencia.setDesfecho("cura");
        ocorrencia.setSexoHospedeiro("F");
        ocorrencia.setIdadeHospedeiro("30");
        ocorrencia.setEstagioVidaParasito("larva");
        ocorrencia.setDoenca(doenca);
        ocorrencia.setParasito(parasito);
        ocorrencia.setHospedeiro(hospedeiro);
        ocorrencia.setLocal(local);
        ocorrencia.setVetor(vetor);
        ocorrencia.setFontes(new LinkedHashSet<>(fontes));
        entityManager.persist(ocorrencia);
        entityManager.flush();
        return ocorrencia.getId();
    }

    private record BaseIds(
            Integer doencaAId,
            Integer vetorAId,
            Integer parasitaAId,
            Integer parasitaBId,
            Integer fonteArtigoId,
            Integer ocorrencia1Id,
            Integer ocorrencia2Id,
            Integer ocorrencia3Id,
            Integer ocorrencia4Id
    ) {
    }
}
