package com.nca.sistema_miiase_app.service.analytics;

import java.math.BigDecimal;
import java.util.Comparator;
import java.util.List;
import java.util.Objects;
import java.util.Optional;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.nca.sistema_miiase_app.domain.entity.Fonte;
import com.nca.sistema_miiase_app.domain.entity.Local;
import com.nca.sistema_miiase_app.domain.entity.Municipio;
import com.nca.sistema_miiase_app.domain.entity.Ocorrencia;
import com.nca.sistema_miiase_app.domain.repository.OcorrenciaRepository;
import com.nca.sistema_miiase_app.dto.filter.ocorrencia.OcorrenciaFiltroDto;
import com.nca.sistema_miiase_app.dto.response.mapa.MapDataResponseDto;
import com.nca.sistema_miiase_app.dto.response.mapa.MapOccurrenceDto;
import com.nca.sistema_miiase_app.dto.response.mapa.MapPointDto;

@Service
@Transactional(readOnly = true)
public class MapDataService {

    private final OcorrenciaRepository ocorrenciaRepository;
    private final OcorrenciaFiltroNormalizer ocorrenciaFiltroNormalizer;

    public MapDataService(
            OcorrenciaRepository ocorrenciaRepository,
            OcorrenciaFiltroNormalizer ocorrenciaFiltroNormalizer
    ) {
        this.ocorrenciaRepository = ocorrenciaRepository;
        this.ocorrenciaFiltroNormalizer = ocorrenciaFiltroNormalizer;
    }

    public MapDataResponseDto buscarPontosMapa(OcorrenciaFiltroDto filtros) {
        OcorrenciaFiltroNormalizer.FiltroNormalizado filtroNormalizado = ocorrenciaFiltroNormalizer.normalizar(filtros);

        List<MapPointDto> pontos = ocorrenciaRepository.findPontosMapaAgregadosFiltrados(
                        filtroNormalizado.uf(),
                        filtroNormalizado.cidade(),
                        filtroNormalizado.anoInicial(),
                        filtroNormalizado.anoFinal(),
                        filtroNormalizado.categoriaHospedeiro(),
                        filtroNormalizado.doencaId(),
                        filtroNormalizado.vetorId(),
                        filtroNormalizado.parasitaId(),
                        filtroNormalizado.fonteId(),
                        filtroNormalizado.tipoFonte()
                ).stream()
                .map(this::toMapPointDto)
                .toList();

        long totalOcorrencias = pontos.stream()
                .map(MapPointDto::getTotalOcorrencias)
                .filter(total -> total != null)
                .mapToLong(Long::longValue)
                .sum();

        return new MapDataResponseDto(totalOcorrencias, pontos);
    }

    public List<MapOccurrenceDto> buscarOcorrenciasMapa() {
        return ocorrenciaRepository.findOcorrenciasParaMapa()
                .stream()
                .map(this::toMapOccurrenceDto)
                .toList();
    }

    private MapPointDto toMapPointDto(OcorrenciaRepository.PontoMapaProjection projection) {
        return new MapPointDto(
                projection.getIdLocal(),
                projection.getCidade(),
                projection.getUf(),
                projection.getLatitude(),
                projection.getLongitude(),
                projection.getTotalOcorrencias()
        );
    }

    private MapOccurrenceDto toMapOccurrenceDto(Ocorrencia ocorrencia) {
        Local local = ocorrencia.getLocal();
        Municipio municipio = local == null ? null : local.getMunicipio();

        return new MapOccurrenceDto(
                ocorrencia.getId(),
                local == null ? null : local.getId(),
                municipio == null ? null : municipio.getNome(),
                municipio == null || municipio.getEstado() == null ? null : municipio.getEstado().getSigla(),
                local == null ? null : local.getBairro(),
                getLatitude(local),
                getLongitude(local),
                ocorrencia.getDoenca().getNomeCientifico(),
                ocorrencia.getHospedeiro().getNomeCientifico(),
                ocorrencia.getHospedeiro().getCategoria().getNomeCategoria(),
                ocorrencia.getParasito().getNomeCientifico(),
                ocorrencia.getVetor() == null ? null : ocorrencia.getVetor().getNomeCientifico(),
                ocorrencia.getData(),
                ocorrencia.getDesfecho(),
                ocorrencia.getFontes()
                        .stream()
                        .filter(Objects::nonNull)
                        .sorted(Comparator.comparing(Fonte::getId, Comparator.nullsLast(Integer::compareTo)))
                        .map(this::toFonteDto)
                        .toList()
        );
    }

    private MapOccurrenceDto.FonteDto toFonteDto(Fonte fonte) {
        return new MapOccurrenceDto.FonteDto(
                fonte.getId(),
                fonte.getNomeFonte(),
                fonte.getTipoFonte(),
                Optional.ofNullable(fonte.getAutores()).orElse(List.of()),
                fonte.getTitulo(),
                fonte.getUrl(),
                fonte.getData()
        );
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
}
