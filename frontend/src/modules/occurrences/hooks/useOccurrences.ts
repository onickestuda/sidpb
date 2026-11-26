"use client"

import { useEffect, useMemo } from "react"
import type {
  OccurrenceFeatureCollection,
  OccurrenceFilters,
} from "@/entities/occurrence/occurrence.types"
import { useFiltersStore } from "@/modules/filters/store/filtersStore"
import { CURATION_LABELS, UNLOCATED_LABEL } from "@/entities/occurrence/occurrence.types"
import { useApiQuery } from "@/lib/useApiQuery"
import {
  applyOccurrenceFilters,
  fetchDashboardOccurrences,
} from "@/modules/occurrences/services/occurrences.service"

interface UseOccurrencesOptions {
  filters?: OccurrenceFilters
  enabled?: boolean
}

export function useOccurrences(options: UseOccurrencesOptions = {}) {
  const storeFilters = useFiltersStore()
  const setSelectedDiseases = useFiltersStore((state) => state.setSelectedDiseases)
  const setSelectedVectors = useFiltersStore((state) => state.setSelectedVectors)
  const setSelectedHosts = useFiltersStore((state) => state.setSelectedHosts)
  const setSelectedStates = useFiltersStore((state) => state.setSelectedStates)
  const setSelectedCuration = useFiltersStore((state) => state.setSelectedCuration)

  const filters = useMemo<OccurrenceFilters>(
    () => ({
      diseases: storeFilters.selectedDiseases,
      vectors: storeFilters.selectedVectors,
      hosts: storeFilters.selectedHosts,
      states: storeFilters.selectedStates,
      curation: storeFilters.selectedCuration,
      ...options.filters,
    }),
    [
      options.filters?.articles,
      options.filters?.diseases,
      options.filters?.hosts,
      options.filters?.search,
      options.filters?.states,
      options.filters?.vectors,

      storeFilters.selectedDiseases,
      storeFilters.selectedHosts,
      storeFilters.selectedVectors,
      storeFilters.selectedStates,
      storeFilters.selectedCuration,
    ]
  )

  const query = useApiQuery<OccurrenceFeatureCollection>(
    ["dashboard-occurrences"],
    fetchDashboardOccurrences,
    {
      enabled: options.enabled ?? true,
    }
  )

  useEffect(() => {
    if (!query.data) return

    const unlocated = query.data.unlocated ?? []
    const values = [...query.data.features.map((feature) => feature.properties), ...unlocated].reduce(
      (accumulator, properties) => {
        accumulator.diseases.add(properties.disease)
        accumulator.vectors.add(properties.vector)
        if (properties.parasite) {
          accumulator.vectors.add(properties.parasite)
        }
        accumulator.hosts.add(properties.host)
        accumulator.states.add(properties.state)
        accumulator.curation.add(CURATION_LABELS[properties.curation])
        return accumulator
      },
      {
        diseases: new Set<string>(),
        vectors: new Set<string>(),
        hosts: new Set<string>(),
        states: new Set<string>(unlocated.length > 0 ? [UNLOCATED_LABEL] : []),
        curation: new Set<string>(),
      }
    )

    const filterKnownValues = (selected: string[], knownValues: Set<string>) =>
      selected.filter((value) => knownValues.has(value))

    const nextDiseases = filterKnownValues(storeFilters.selectedDiseases, values.diseases)
    const nextVectors = filterKnownValues(storeFilters.selectedVectors, values.vectors)
    const nextHosts = filterKnownValues(storeFilters.selectedHosts, values.hosts)
    const nextStates = filterKnownValues(storeFilters.selectedStates, values.states)
    const nextCuration = filterKnownValues(storeFilters.selectedCuration, values.curation)

    if (nextDiseases.length !== storeFilters.selectedDiseases.length) {
      setSelectedDiseases(nextDiseases)
    }

    if (nextVectors.length !== storeFilters.selectedVectors.length) {
      setSelectedVectors(nextVectors)
    }

    if (nextHosts.length !== storeFilters.selectedHosts.length) {
      setSelectedHosts(nextHosts)
    }

    if (nextStates.length !== storeFilters.selectedStates.length) {
      setSelectedStates(nextStates)
    }

    if (nextCuration.length !== storeFilters.selectedCuration.length) {
      setSelectedCuration(nextCuration)
    }
  }, [
    query.data,
    setSelectedDiseases,
    setSelectedHosts,
    setSelectedStates,
    setSelectedVectors,
    setSelectedCuration,
    storeFilters.selectedCuration,
    storeFilters.selectedDiseases,
    storeFilters.selectedHosts,
    storeFilters.selectedStates,
    storeFilters.selectedVectors,
  ])

  const filteredData = useMemo(
    () => applyOccurrenceFilters(query.data, filters),
    [query.data, filters]
  )

  return {
    ...query,
    data: filteredData,
  }
}
