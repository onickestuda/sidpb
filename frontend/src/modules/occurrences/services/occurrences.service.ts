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
  "Não foi possível carregar as ocorrências. Verifique sua conexão e tente novamente."

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
    // Erros 4xx da API ja trazem mensagem para o usuario. Falhas do servidor (5xx),
    // de rede, timeout ou corpo nao-JSON (ex.: 502 do proxy) recebem texto amigavel.
    const userFacing = error instanceof ApiError && error.status >= 400 && error.status < 500
    throw userFacing ? error : new Error(LOAD_ERROR_MESSAGE)
  }
}

export function applyOccurrenceFilters(
  collection: OccurrenceFeatureCollection | null,
  filters: OccurrenceFilters
) {
  return filterOccurrenceCollection(collection, filters)
}
