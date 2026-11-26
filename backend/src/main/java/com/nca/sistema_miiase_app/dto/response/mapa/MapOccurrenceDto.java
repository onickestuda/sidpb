package com.nca.sistema_miiase_app.dto.response.mapa;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.LinkedHashMap;
import java.util.Map;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class MapOccurrenceDto {

    private Integer idOcorrencia;
    private Integer idLocal;
    private String cidade;
    private String uf;
    private String bairro;
    private BigDecimal latitude;
    private BigDecimal longitude;
    private String doencaNomeCientifico;
    private String hospedeiroEspecie;
    private String categoriaHospedeiro;
    private String parasitoNomeCientifico;
    private String vetorNomeCientifico;
    private LocalDate dataOcorrencia;
    private String desfecho;
    private List<FonteDto> fontes = new ArrayList<>();
    /** "O-<id>" for normalized occurrences, "E-<id>" for LLM-extracted ones: unique across both. */
    private String chave;
    /** CURADA or NAO_CURADA (extracted and not yet reviewed by a human curator). */
    private String curadoria = "CURADA";
    /** EXATA, MUNICIPIO (municipality centroid), ESTADO or SEM_LOCAL (no point on the map). */
    private String precisaoLocal;
    private Integer idSubmissao;
    private String modeloExtracao;
    /** Information outside the fixed schema: body part, treatment, outcome, evidence quotes... */
    private Map<String, Object> outros = new LinkedHashMap<>();

    public MapOccurrenceDto(Integer idOcorrencia, Integer idLocal, String cidade, String uf, String bairro,
                            BigDecimal latitude, BigDecimal longitude, String doencaNomeCientifico,
                            String hospedeiroEspecie, String categoriaHospedeiro, String parasitoNomeCientifico,
                            String vetorNomeCientifico, LocalDate dataOcorrencia, String desfecho, List<FonteDto> fontes) {
        this.idOcorrencia = idOcorrencia;
        this.idLocal = idLocal;
        this.cidade = cidade;
        this.uf = uf;
        this.bairro = bairro;
        this.latitude = latitude;
        this.longitude = longitude;
        this.doencaNomeCientifico = doencaNomeCientifico;
        this.hospedeiroEspecie = hospedeiroEspecie;
        this.categoriaHospedeiro = categoriaHospedeiro;
        this.parasitoNomeCientifico = parasitoNomeCientifico;
        this.vetorNomeCientifico = vetorNomeCientifico;
        this.dataOcorrencia = dataOcorrencia;
        this.desfecho = desfecho;
        this.fontes = fontes;
        this.chave = idOcorrencia == null ? null : "O-" + idOcorrencia;
    }

    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    public static class FonteDto {
        private Integer idFonte;
        private String nomeFonte;
        private String tipoFonte;
        private List<String> autores = new ArrayList<>();
        private String titulo;
        private String url;
        private LocalDate data;
    }
}
