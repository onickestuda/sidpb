import type { Article } from "@/entities/article/article.types"

export type OccurrenceCuration = "CURADA" | "NAO_CURADA"
export type LocationPrecision = "EXATA" | "MUNICIPIO" | "ESTADO" | "SEM_LOCAL"

/** Filter option that selects occurrences without a confirmed location (never drawn on the map). */
export const UNLOCATED_LABEL = "Sem local confirmado"

export const CURATION_LABELS: Record<OccurrenceCuration, string> = {
  CURADA: "Curadas",
  NAO_CURADA: "Não curadas",
}

/** Fields shared by every occurrence, located on the map or not. */
interface OccurrenceData {
  disease: string
  vector: string
  parasite?: string
  date: string
  city: string
  state: string
  host: string
  hostCategory: string
  hostSex?: string
  hostAge?: string
  outcome?: string
  /** CURADA: confirmed by a human curator; NAO_CURADA: extracted automatically, not verified yet. */
  curation: OccurrenceCuration
  /** How precise the position is: EXATA, MUNICIPIO (municipality centroid), ESTADO or SEM_LOCAL. */
  locationPrecision: LocationPrecision
  submissionId?: number
  extractionModel?: string
  /** Information outside the fixed schema (body part, treatment, evidence quotes with page...). */
  extras: Record<string, unknown>
  articles: Article[]
}

export interface Occurrence extends OccurrenceData {
  id: string
  coordinates: [number, number]
}

export interface OccurrenceProperties extends OccurrenceData {
  id: string
}

export interface OccurrenceFeature {
  type: "Feature"
  geometry: {
    type: "Point"
    coordinates: [number, number]
  }
  properties: OccurrenceProperties
}

export interface OccurrenceFeatureCollection {
  type: "FeatureCollection"
  features: OccurrenceFeature[]
  totalOccurrences?: number
  invalidCoordinatesCount?: number
  /** Occurrences without a point on the map (state only or no location); listed apart, never guessed. */
  unlocated?: OccurrenceProperties[]
}

export interface OccurrenceFilters {
  diseases?: string[]
  articles?: string[]
  vectors?: string[]
  hosts?: string[]
  states?: string[]
  /** Curation labels from CURATION_LABELS ("Curadas" / "Não curadas"). */
  curation?: string[]
  geographicLevel?: "country" | "state" | "city"
  region?: string | null
  search?: string
}

export interface MapOccurrenceSourceDto {
  idFonte: number | null
  nomeFonte: string | null
  tipoFonte: string | null
  autores: string[] | null
  titulo: string | null
  url: string | null
  data: string | null
}

export interface MapOccurrenceDto {
  idOcorrencia: number
  idLocal: number | null
  cidade: string | null
  uf: string | null
  bairro: string | null
  latitude: number | string | null
  longitude: number | string | null
  doencaNomeCientifico: string | null
  hospedeiroEspecie: string | null
  categoriaHospedeiro: string | null
  parasitoNomeCientifico: string | null
  vetorNomeCientifico: string | null
  dataOcorrencia: string | null
  desfecho: string | null
  fontes: MapOccurrenceSourceDto[] | null
  chave?: string | null
  curadoria?: OccurrenceCuration | null
  precisaoLocal?: LocationPrecision | null
  idSubmissao?: number | null
  modeloExtracao?: string | null
  outros?: Record<string, unknown> | null
}
