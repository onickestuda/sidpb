import type {
  MapOccurrenceDto,
  MapOccurrenceSourceDto,
  Occurrence,
  OccurrenceFeature,
  OccurrenceFeatureCollection,
  OccurrenceFilters,
  OccurrenceProperties,
} from "@/entities/occurrence/occurrence.types"
import { CURATION_LABELS, UNLOCATED_LABEL } from "./occurrence.types"

export function occurrenceFeatureToOccurrence(feature: OccurrenceFeature): Occurrence {
  const [lon, lat] = feature.geometry.coordinates
  return { ...feature.properties, coordinates: [lon, lat] }
}

export function occurrenceCollectionToOccurrences(
  collection?: OccurrenceFeatureCollection | null
) {
  return collection?.features.map(occurrenceFeatureToOccurrence) ?? []
}

// Case- and accent-insensitive text: "Miíase" and "miiase" compare equal.
function foldText(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
}

function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
}

function includesAny(value: string | undefined, filters?: string[]) {
  if (!filters || filters.length === 0) return true
  if (!value) return false

  const normalized = slugify(value)
  return filters.some((filter) => {
    const normalizedFilter = slugify(filter)
    return normalized.includes(normalizedFilter) || normalizedFilter.includes(normalized)
  })
}

function sourceToArticle(source: MapOccurrenceSourceDto) {
  const date = source.data ?? ""
  const year = Number(date.slice(0, 4))
  const fallbackId = source.idFonte ?? source.nomeFonte ?? source.titulo ?? "fonte-sem-id"

  return {
    id: String(fallbackId),
    title: source.titulo ?? source.nomeFonte ?? "Fonte sem titulo",
    authors: source.autores ?? [],
    year: Number.isFinite(year) ? year : 0,
    journal: source.nomeFonte ?? undefined,
    url: source.url ?? undefined,
    type: source.tipoFonte ?? "outro",
  }
}

function toNumber(value: number | string | null) {
  if (value === null || value === "") return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function hasValidCoordinates(latitude: number | null, longitude: number | null) {
  return (
    latitude !== null &&
    longitude !== null &&
    latitude >= -90 &&
    latitude <= 90 &&
    longitude >= -180 &&
    longitude <= 180
  )
}

function dtoToProperties(dto: MapOccurrenceDto): OccurrenceProperties {
  const hasPoint = hasValidCoordinates(toNumber(dto.latitude), toNumber(dto.longitude))
  return {
    id: dto.chave ?? String(dto.idOcorrencia),
    disease: dto.doencaNomeCientifico ?? "Não informado",
    vector: dto.vetorNomeCientifico ?? "",
    parasite: dto.parasitoNomeCientifico ?? undefined,
    date: dto.dataOcorrencia ?? "",
    city: dto.cidade ?? "Município não informado",
    state: dto.uf ?? "UF não informada",
    host: dto.hospedeiroEspecie ?? "Não informado",
    hostCategory: dto.categoriaHospedeiro ?? "Não informado",
    outcome: dto.desfecho ?? undefined,
    curation: dto.curadoria ?? "CURADA",
    locationPrecision: dto.precisaoLocal ?? (hasPoint ? "EXATA" : "SEM_LOCAL"),
    submissionId: dto.idSubmissao ?? undefined,
    extractionModel: dto.modeloExtracao ?? undefined,
    extras: dto.outros ?? {},
    articles: (dto.fontes ?? []).map(sourceToArticle),
  }
}

export function mapOccurrenceDtoToFeature(dto: MapOccurrenceDto): OccurrenceFeature | null {
  const latitude = toNumber(dto.latitude)
  const longitude = toNumber(dto.longitude)
  if (latitude === null || longitude === null || !hasValidCoordinates(latitude, longitude)) return null

  return {
    type: "Feature",
    geometry: { type: "Point", coordinates: [longitude, latitude] },
    properties: dtoToProperties(dto),
  }
}

export function mapOccurrenceDtosToFeatureCollection(
  occurrences: MapOccurrenceDto[]
): OccurrenceFeatureCollection {
  const features: OccurrenceFeature[] = []
  const unlocated: OccurrenceProperties[] = []
  for (const dto of occurrences) {
    const feature = mapOccurrenceDtoToFeature(dto)
    if (feature) features.push(feature)
    else unlocated.push(dtoToProperties(dto))
  }

  return {
    type: "FeatureCollection",
    features,
    unlocated,
    totalOccurrences: occurrences.length,
    // Occurrences known to have no point are listed apart; only unexpected gaps count as invalid.
    invalidCoordinatesCount: unlocated.filter((item) => item.locationPrecision === "EXATA" || item.locationPrecision === "MUNICIPIO").length,
  }
}

function matchesFilters(properties: OccurrenceProperties, filters: OccurrenceFilters, search: string, located: boolean) {
  const states = filters.states ?? []
  const wantsUnlocated = states.includes(UNLOCATED_LABEL)
  const realStates = states.filter((state) => state !== UNLOCATED_LABEL)
  const stateMatches = located
    ? realStates.length === 0 ? !wantsUnlocated : includesAny(properties.state, realStates)
    : states.length === 0 || wantsUnlocated

  return (
    includesAny(properties.disease, filters.diseases) &&
    (!filters.vectors?.length ||
      includesAny(properties.vector, filters.vectors) ||
      includesAny(properties.parasite, filters.vectors)) &&
    includesAny(properties.host, filters.hosts) &&
    stateMatches &&
    (!filters.curation?.length || filters.curation.includes(CURATION_LABELS[properties.curation])) &&
    (!filters.articles?.length ||
      properties.articles.some((article) => filters.articles?.includes(article.id))) &&
    (!search ||
      foldText(
        [
          properties.city,
          properties.state,
          properties.disease,
          properties.vector,
          properties.parasite,
          properties.host,
        ].join(" ")
      ).includes(search))
  )
}

export function filterOccurrenceCollection(
  collection: OccurrenceFeatureCollection | null,
  filters: OccurrenceFilters
): OccurrenceFeatureCollection | null {
  if (!collection) return null

  const search = filters.search ? foldText(filters.search.trim()) : ""
  return {
    ...collection,
    features: collection.features.filter((feature) => matchesFilters(feature.properties, filters, search, true)),
    unlocated: (collection.unlocated ?? []).filter((properties) => matchesFilters(properties, filters, search, false)),
  }
}
