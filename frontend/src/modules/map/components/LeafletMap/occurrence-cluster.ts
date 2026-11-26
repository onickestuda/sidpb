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
