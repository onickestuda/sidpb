package com.nca.sistema_miiase_app.dto.response.mapa;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

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
