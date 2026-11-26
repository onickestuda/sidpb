import type { Occurrence } from "@/entities/occurrence/occurrence.types";
import { CLUSTER_MAX_ZOOM } from "./map-zoom";

export const MAX_CLUSTER_ITEMS_FOR_SIDEBAR = 40;

export function shouldOpenClusterSidebar(occurrences: Occurrence[], zoom: number) {
  return occurrences.length > 0 && (
    occurrences.length <= MAX_CLUSTER_ITEMS_FOR_SIDEBAR ||
    hasSameCoordinates(occurrences) ||
    zoom >= CLUSTER_MAX_ZOOM
  );
}

export function hasSameCoordinates(occurrences: Occurrence[]) {
  const coordinates = new Set(
    occurrences.map((occurrence) => occurrence.coordinates.join(","))
  );

  return coordinates.size === 1;
}

// Mirrors leaflet.markercluster's default icon factory (we do not override it):
// < 10 children -> small (green), < 100 -> medium (yellow), otherwise large (orange).
// Colors come from MarkerCluster.Default.css so the legend matches the map exactly.
export const CLUSTER_COUNT_BANDS = [
  { minCount: 2, className: "marker-cluster-small", label: "2 a 9 ocorrências", outer: "rgba(181, 226, 140, 0.6)", inner: "rgba(110, 204, 57, 0.6)" },
  { minCount: 10, className: "marker-cluster-medium", label: "10 a 99 ocorrências", outer: "rgba(241, 211, 87, 0.6)", inner: "rgba(240, 194, 12, 0.6)" },
  { minCount: 100, className: "marker-cluster-large", label: "100 ou mais ocorrências", outer: "rgba(253, 156, 115, 0.6)", inner: "rgba(241, 128, 23, 0.6)" },
] as const;
