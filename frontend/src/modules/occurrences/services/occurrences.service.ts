"use client"

import {
  filterOccurrenceCollection,
  mapOccurrenceDtosToFeatureCollection,
} from "@/entities/occurrence/occurrence.mappers"
import type {
  MapOccurrenceDto,
  OccurrenceFeatureCollection,
  OccurrenceFeature,
  OccurrenceFilters,
} from "@/entities/occurrence/occurrence.types"
import { mockGeoJsonData } from "@/features/articles/data/articles.mock"
import { ApiError, apiRequest } from "@/services/apiClient"

function getMockDashboardOccurrences(): OccurrenceFeatureCollection {
  const features: OccurrenceFeature[] = mockGeoJsonData.features.map((feature) => ({
    type: "Feature",
    geometry: {
      type: "Point",
      coordinates: [...feature.geometry.coordinates],
    },
    properties: {
      ...feature.properties,
      articles: feature.properties.articles.map((article) => ({ ...article })),
    },
  }))

  return {
    type: "FeatureCollection",
    features,
    totalOccurrences: features.length,
    invalidCoordinatesCount: 0,
  }
}

export async function fetchDashboardOccurrences(signal?: AbortSignal) {
  try {
    const occurrences = await apiRequest<MapOccurrenceDto[]>("/api/mapa/ocorrencias", {
      signal,
    })

    return mapOccurrenceDtosToFeatureCollection(occurrences)
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw error
    }

    console.error("Erro tecnico ao carregar ocorrencias do mapa.", error)

    if (error instanceof ApiError && error.status > 0) {
      console.warn(`Usando ocorrencias mockadas. API respondeu HTTP ${error.status}.`)
      return getMockDashboardOccurrences()
    }

    console.warn("Usando ocorrencias mockadas. Nao foi possivel conectar a API de ocorrencias.")
    return getMockDashboardOccurrences()
  }
}

export function applyOccurrenceFilters(
  collection: OccurrenceFeatureCollection | null,
  filters: OccurrenceFilters
) {
  return filterOccurrenceCollection(collection, filters)
}
