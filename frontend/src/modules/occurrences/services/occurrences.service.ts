"use client"

import {
  filterOccurrenceCollection,
  mapOccurrenceDtosToFeatureCollection,
} from "@/entities/occurrence/occurrence.mappers"
import type {
  MapOccurrenceDto,
  OccurrenceFeatureCollection,
  OccurrenceFilters,
} from "@/entities/occurrence/occurrence.types"
import { ApiError, apiRequest } from "@/lib/apiClient"

const LOAD_ERROR_MESSAGE =
  "Nao foi possivel carregar as ocorrencias. Verifique sua conexao e tente novamente."

// Falhas da API sobem para a interface, que exibe o estado de erro do mapa.
// Nunca substituir por dados ficticios: o mapa apresenta dados cientificos.
export async function fetchDashboardOccurrences(signal?: AbortSignal) {
  try {
    const occurrences = await apiRequest<MapOccurrenceDto[]>("/api/mapa/ocorrencias", {
      signal,
    })

    return mapOccurrenceDtosToFeatureCollection(occurrences)
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError" && signal?.aborted) {
      throw error
    }

    console.error("Erro tecnico ao carregar ocorrencias do mapa.", error)
    // Mensagens de ApiError ja sao escritas para o usuario; falhas de rede,
    // timeout ou corpo nao-JSON (ex.: 502 do proxy) recebem texto amigavel.
    throw error instanceof ApiError && error.status > 0 ? error : new Error(LOAD_ERROR_MESSAGE)
  }
}

export function applyOccurrenceFilters(
  collection: OccurrenceFeatureCollection | null,
  filters: OccurrenceFilters
) {
  return filterOccurrenceCollection(collection, filters)
}
