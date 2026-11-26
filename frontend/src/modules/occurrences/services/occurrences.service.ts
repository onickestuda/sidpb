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
import { apiRequest } from "@/lib/apiClient"

// Falhas da API sobem para a interface, que exibe o estado de erro do mapa.
// Nunca substituir por dados ficticios: o mapa apresenta dados cientificos.
export async function fetchDashboardOccurrences(signal?: AbortSignal) {
  const occurrences = await apiRequest<MapOccurrenceDto[]>("/api/mapa/ocorrencias", {
    signal,
  })

  return mapOccurrenceDtosToFeatureCollection(occurrences)
}

export function applyOccurrenceFilters(
  collection: OccurrenceFeatureCollection | null,
  filters: OccurrenceFilters
) {
  return filterOccurrenceCollection(collection, filters)
}
