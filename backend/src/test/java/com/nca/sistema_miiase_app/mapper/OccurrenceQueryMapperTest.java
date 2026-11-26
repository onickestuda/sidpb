package com.nca.sistema_miiase_app.mapper;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

import org.junit.jupiter.api.Test;

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
import com.nca.sistema_miiase_app.domain.repository.OcorrenciaRepository;
import com.nca.sistema_miiase_app.dto.response.ocorrencia.OcorrenciaDetalheResponseDto;
import com.nca.sistema_miiase_app.dto.response.ocorrencia.OcorrenciaResumoResponseDto;

class OccurrenceQueryMapperTest {

    private final OccurrenceQueryMapper mapper = new OccurrenceQueryMapper();

    @Test
    void deveConverterProjectionParaResumoDto() {
        OcorrenciaRepository.OcorrenciaResumoProjection projection = new OcorrenciaRepository.OcorrenciaResumoProjection() {
            @Override
            public Integer getIdOcorrencia() { return 11; }
            @Override
            public LocalDate getDataOcorrencia() { return LocalDate.of(2026, 5, 2); }
            @Override
            public String getDoencaNomeCientifico() { return "Doenca X"; }
            @Override
            public String getDoencaNomeComum() { return "[\"Bicheira\"]"; }
            @Override
            public String getHospedeiroEspecie() { return "Canis lupus"; }
            @Override
            public String getLocalUf() { return "RJ"; }
            @Override
            public String getLocalCidade() { return "Rio de Janeiro"; }
            @Override
            public String getLocalBairro() { return "Centro"; }
            @Override
            public String getVetorNomeCientifico() { return "C. hominivorax"; }
            @Override
            public String getTipoFonte() { return "artigo"; }
            @Override
            public String getNomeFonte() { return "Fonte A"; }
        };

        OcorrenciaResumoResponseDto dto = mapper.toResumoDto(projection);

        assertEquals(11, dto.getIdOcorrencia());
        assertEquals("[\"Bicheira\"]", dto.getDoencaNomeComum());
        assertEquals("Fonte A", dto.getNomeFonte());
    }

    @Test
    void deveConverterEntityParaResumoDtoSelecionandoMenorIdFonte() {
        Ocorrencia ocorrencia = buildOcorrenciaBase();

        Fonte fonteId5 = new Fonte();
        fonteId5.setId(5);
        fonteId5.setNomeFonte("Fonte Cinco");
        fonteId5.setTipoFonte("tese");

        Fonte fonteId2 = new Fonte();
        fonteId2.setId(2);
        fonteId2.setNomeFonte("Fonte Dois");
        fonteId2.setTipoFonte("artigo");

        Set<Fonte> fontes = new LinkedHashSet<>();
        fontes.add(fonteId5);
        fontes.add(fonteId2);
        ocorrencia.setFontes(fontes);

        OcorrenciaResumoResponseDto dto = mapper.toResumoDto(ocorrencia);

        assertEquals("Fonte Dois", dto.getNomeFonte());
        assertEquals("artigo", dto.getTipoFonte());
        assertEquals("[\"Nome Comum\"]", dto.getDoencaNomeComum());
        assertEquals("Homo sapiens", dto.getHospedeiroEspecie());
        assertEquals("SP", dto.getLocalUf());
        assertEquals("Campinas", dto.getLocalCidade());
    }

    @Test
    void deveConverterEntityParaDetalheDto() {
        Ocorrencia ocorrencia = buildOcorrenciaBase();

        Fonte fonte = new Fonte();
        fonte.setId(1);
        fonte.setNomeFonte("Fonte Principal");
        fonte.setTipoFonte("artigo");
        fonte.setAutores(List.of("Autora A", "Autor B"));
        fonte.setData(LocalDate.of(2024, 1, 1));

        ocorrencia.setFontes(Set.of(fonte));

        OcorrenciaDetalheResponseDto dto = mapper.toDetalheDto(ocorrencia);

        assertNotNull(dto.getLocal());
        assertNotNull(dto.getHospedeiro());
        assertNotNull(dto.getDoenca());
        assertNotNull(dto.getVetor());
        assertEquals(1, dto.getFontes().size());
        assertEquals("F", dto.getHospedeiro().getSexo());
        assertEquals("35", dto.getHospedeiro().getIdade());
        assertEquals("[\"Autora A\",\"Autor B\"]", dto.getFontes().getFirst().getAutor());
    }

    @Test
    void deveConverterListaProjectionParaResumoDtoList() {
        OcorrenciaRepository.OcorrenciaResumoProjection projection = new OcorrenciaRepository.OcorrenciaResumoProjection() {
            @Override
            public Integer getIdOcorrencia() { return 12; }
            @Override
            public LocalDate getDataOcorrencia() { return LocalDate.of(2026, 5, 3); }
            @Override
            public String getDoencaNomeCientifico() { return "Doenca Y"; }
            @Override
            public String getDoencaNomeComum() { return "[]"; }
            @Override
            public String getHospedeiroEspecie() { return "Felis catus"; }
            @Override
            public String getLocalUf() { return "MG"; }
            @Override
            public String getLocalCidade() { return "Belo Horizonte"; }
            @Override
            public String getLocalBairro() { return "Savassi"; }
            @Override
            public String getVetorNomeCientifico() { return "Vetor Y"; }
            @Override
            public String getTipoFonte() { return null; }
            @Override
            public String getNomeFonte() { return null; }
        };

        List<OcorrenciaResumoResponseDto> dtos = mapper.toResumoDtoList(List.of(projection));
        assertEquals(1, dtos.size());
        assertEquals(12, dtos.getFirst().getIdOcorrencia());
    }

    private Ocorrencia buildOcorrenciaBase() {
        Doenca doenca = new Doenca();
        doenca.setId(100);
        doenca.setNomeCientifico("Doenca Teste");
        doenca.setSinonimos(List.of("Nome Comum"));

        Hospedeiro hospedeiro = new Hospedeiro();
        hospedeiro.setId(200);
        hospedeiro.setNomeCientifico("Homo sapiens");

        Regiao regiao = new Regiao();
        regiao.setId(1);
        regiao.setSigla("SE");
        regiao.setNome("Sudeste");

        Estado estado = new Estado();
        estado.setId(35);
        estado.setSigla("SP");
        estado.setNome("Sao Paulo");
        estado.setRegiao(regiao);

        Municipio municipio = new Municipio();
        municipio.setId(3509502);
        municipio.setNome("Campinas");
        municipio.setLatitudeMunicipio(new BigDecimal("-22.9053"));
        municipio.setLongitudeMunicipio(new BigDecimal("-47.0632"));
        municipio.setEstado(estado);

        Local local = new Local();
        local.setId(300);
        local.setMunicipio(municipio);
        local.setBairro("Centro");
        local.setLongitudeOcorrencia(new BigDecimal("-47.0608"));
        local.setLatitudeOcorrencia(new BigDecimal("-22.9056"));

        Parasito parasito = new Parasito();
        parasito.setId(350);
        parasito.setNomeCientifico("Parasito Teste");

        Vetor vetor = new Vetor();
        vetor.setId(400);
        vetor.setNomeCientifico("Cochliomyia hominivorax");
        vetor.setSinonimos(List.of("mosca-da-bicheira"));

        Ocorrencia ocorrencia = new Ocorrencia();
        ocorrencia.setId(500);
        ocorrencia.setData(LocalDate.of(2026, 5, 10));
        ocorrencia.setParteCorpo("perna");
        ocorrencia.setTratamento("limpeza");
        ocorrencia.setDesfecho("cura");
        ocorrencia.setSexoHospedeiro("F");
        ocorrencia.setIdadeHospedeiro("35");
        ocorrencia.setDoenca(doenca);
        ocorrencia.setParasito(parasito);
        ocorrencia.setHospedeiro(hospedeiro);
        ocorrencia.setLocal(local);
        ocorrencia.setVetor(vetor);
        return ocorrencia;
    }
}
