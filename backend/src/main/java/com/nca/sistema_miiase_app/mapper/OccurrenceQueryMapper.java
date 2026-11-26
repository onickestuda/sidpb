package com.nca.sistema_miiase_app.mapper;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.List;
import java.util.Objects;
import java.util.Optional;

import org.springframework.stereotype.Component;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.nca.sistema_miiase_app.domain.entity.Fonte;
import com.nca.sistema_miiase_app.domain.entity.Local;
import com.nca.sistema_miiase_app.domain.entity.Ocorrencia;
import com.nca.sistema_miiase_app.domain.entity.Vetor;
import com.nca.sistema_miiase_app.domain.repository.OcorrenciaRepository;
import com.nca.sistema_miiase_app.dto.response.ocorrencia.OcorrenciaDetalheResponseDto;
import com.nca.sistema_miiase_app.dto.response.ocorrencia.OcorrenciaResumoResponseDto;

@Component
public class OccurrenceQueryMapper {

    private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();

    public OcorrenciaDetalheResponseDto toDetalheDto(Ocorrencia ocorrencia) {
        if (ocorrencia == null) {
            return null;
        }

        OcorrenciaDetalheResponseDto dto = new OcorrenciaDetalheResponseDto();
        dto.setIdOcorrencia(ocorrencia.getId());
        dto.setDataOcorrencia(ocorrencia.getData());
        dto.setParteCorpo(ocorrencia.getParteCorpo());
        dto.setTratamento(ocorrencia.getTratamento());
        dto.setDesfecho(ocorrencia.getDesfecho());

        dto.setLocal(new OcorrenciaDetalheResponseDto.LocalResumoDto(
                getUf(ocorrencia.getLocal()),
                getCidade(ocorrencia.getLocal()),
                ocorrencia.getLocal().getBairro(),
                getLongitude(ocorrencia.getLocal()),
                getLatitude(ocorrencia.getLocal())
        ));

        dto.setHospedeiro(new OcorrenciaDetalheResponseDto.HospedeiroResumoDto(
                ocorrencia.getHospedeiro().getId(),
                ocorrencia.getSexoHospedeiro(),
                ocorrencia.getIdadeHospedeiro(),
                ocorrencia.getHospedeiro().getNomeCientifico()
        ));

        dto.setDoenca(new OcorrenciaDetalheResponseDto.DoencaResumoDto(
                ocorrencia.getDoenca().getId(),
                ocorrencia.getDoenca().getNomeCientifico(),
                toJson(ocorrencia.getDoenca().getSinonimos())
        ));

        Vetor vetor = ocorrencia.getVetor();
        if (vetor != null) {
            dto.setVetor(new OcorrenciaDetalheResponseDto.VetorResumoDto(
                    vetor.getId(),
                    vetor.getNomeCientifico(),
                    toJson(vetor.getSinonimos())
            ));
        }

        List<OcorrenciaDetalheResponseDto.FonteResumoDto> fontes = ocorrencia.getFontes()
                .stream()
                .filter(Objects::nonNull)
                .map(this::toFonteResumoDto)
                .toList();
        dto.setFontes(fontes);

        return dto;
    }

    public OcorrenciaResumoResponseDto toResumoDto(OcorrenciaRepository.OcorrenciaResumoProjection projection) {
        if (projection == null) {
            return null;
        }

        return new OcorrenciaResumoResponseDto(
                projection.getIdOcorrencia(),
                projection.getDataOcorrencia(),
                projection.getDoencaNomeCientifico(),
                projection.getDoencaNomeComum(),
                projection.getHospedeiroEspecie(),
                projection.getLocalUf(),
                projection.getLocalCidade(),
                projection.getLocalBairro(),
                projection.getVetorNomeCientifico(),
                projection.getTipoFonte(),
                projection.getNomeFonte()
        );
    }

    public List<OcorrenciaResumoResponseDto> toResumoDtoList(List<OcorrenciaRepository.OcorrenciaResumoProjection> projections) {
        if (projections == null || projections.isEmpty()) {
            return Collections.emptyList();
        }

        List<OcorrenciaResumoResponseDto> dtos = new ArrayList<>(projections.size());
        for (OcorrenciaRepository.OcorrenciaResumoProjection projection : projections) {
            dtos.add(toResumoDto(projection));
        }
        return dtos;
    }

    public OcorrenciaResumoResponseDto toResumoDto(Ocorrencia ocorrencia) {
        if (ocorrencia == null) {
            return null;
        }

        Optional<Fonte> primeiraFontePorId = ocorrencia.getFontes()
                .stream()
                .filter(Objects::nonNull)
                .filter(fonte -> fonte.getId() != null)
                .min(Comparator.comparing(Fonte::getId));

        String tipoFonte = primeiraFontePorId.map(Fonte::getTipoFonte).orElse(null);
        String nomeFonte = primeiraFontePorId.map(Fonte::getNomeFonte).orElse(null);
        String vetorNomeCientifico = Optional.ofNullable(ocorrencia.getVetor())
                .map(Vetor::getNomeCientifico)
                .orElse(null);

        return new OcorrenciaResumoResponseDto(
                ocorrencia.getId(),
                ocorrencia.getData(),
                ocorrencia.getDoenca().getNomeCientifico(),
                toJson(ocorrencia.getDoenca().getSinonimos()),
                ocorrencia.getHospedeiro().getNomeCientifico(),
                getUf(ocorrencia.getLocal()),
                getCidade(ocorrencia.getLocal()),
                ocorrencia.getLocal().getBairro(),
                vetorNomeCientifico,
                tipoFonte,
                nomeFonte
        );
    }

    public List<OcorrenciaResumoResponseDto> toResumoDtoListFromEntity(List<Ocorrencia> ocorrencias) {
        if (ocorrencias == null || ocorrencias.isEmpty()) {
            return Collections.emptyList();
        }

        List<OcorrenciaResumoResponseDto> dtos = new ArrayList<>(ocorrencias.size());
        for (Ocorrencia ocorrencia : ocorrencias) {
            dtos.add(toResumoDto(ocorrencia));
        }
        return dtos;
    }

    private OcorrenciaDetalheResponseDto.FonteResumoDto toFonteResumoDto(Fonte fonte) {
        return new OcorrenciaDetalheResponseDto.FonteResumoDto(
                fonte.getId(),
                fonte.getNomeFonte(),
                fonte.getTipoFonte(),
                toJson(fonte.getAutores()),
                fonte.getTitulo(),
                fonte.getUrl(),
                fonte.getData()
        );
    }

    private String getUf(Local local) {
        if (local == null || local.getMunicipio() == null || local.getMunicipio().getEstado() == null) {
            return null;
        }
        return local.getMunicipio().getEstado().getSigla();
    }

    private String getCidade(Local local) {
        if (local == null || local.getMunicipio() == null) {
            return null;
        }
        return local.getMunicipio().getNome();
    }

    private BigDecimal getLatitude(Local local) {
        if (local == null) {
            return null;
        }
        if (local.getLatitudeOcorrencia() != null) {
            return local.getLatitudeOcorrencia();
        }
        return local.getMunicipio() == null ? null : local.getMunicipio().getLatitudeMunicipio();
    }

    private BigDecimal getLongitude(Local local) {
        if (local == null) {
            return null;
        }
        if (local.getLongitudeOcorrencia() != null) {
            return local.getLongitudeOcorrencia();
        }
        return local.getMunicipio() == null ? null : local.getMunicipio().getLongitudeMunicipio();
    }

    private String toJson(List<String> values) {
        try {
            return OBJECT_MAPPER.writeValueAsString(values == null ? List.of() : values);
        } catch (JsonProcessingException ex) {
            throw new IllegalStateException("Nao foi possivel serializar JSON", ex);
        }
    }
}
