"use client";

import { AlertTriangle } from "lucide-react";
import dynamic from "next/dynamic";
import { useEffect, useMemo } from "react";

import { Spinner } from "@/components/ui/spinner";
import type {OccurrenceFeatureCollection} from "@/entities/occurrence/occurrence.types";
import type { MapController } from "@/modules/map/types/map-controller.types";
import { occurrenceFeatureToOccurrence } from "@/entities/occurrence/occurrence.mappers";
import { useMapStore } from "@/modules/map/store/mapStore";

const LeafletMap = dynamic(
  () => import("@/modules/map/components/LeafletMap"),
  {
    ssr: false,
  }
);

interface DashboardMapProps {
  map: MapController;
  occurrences?: OccurrenceFeatureCollection | null;
  isLoading?: boolean;
  error?: Error | null;
  emptyMessage?: string;
  invalidCoordinatesCount?: number;
}

export function DashboardMap({
  map,
  occurrences,
  isLoading = false,
  error,
  emptyMessage,
  invalidCoordinatesCount = 0,
}: DashboardMapProps) {
  const selectedOccurrence = useMapStore((state) => state.selectedOccurrence);
  const selectOccurrences = useMapStore((state) => state.selectOccurrences);
  const reconcileOccurrenceSelection = useMapStore((state) => state.reconcileOccurrenceSelection);
  const occurrenceList = useMemo(
    () => occurrences?.features.map(occurrenceFeatureToOccurrence) ?? [],
    [occurrences]
  );

  useEffect(() => {
    if (occurrences) reconcileOccurrenceSelection(occurrenceList);
  }, [occurrences, occurrenceList, reconcileOccurrenceSelection]);

  return (
    <div className="absolute inset-0">
      <LeafletMap
        mapView={map.mapView}
        occurrences={occurrences}
        onMapReady={map.registerMap}
        selectedOccurrence={selectedOccurrence}
        onOccurrenceClick={(occurrence) => {
          // At high zoom co-located markers overlap; retain the whole point's context.
          const group = occurrenceList.filter((item) =>
            item.coordinates[0] === occurrence.coordinates[0] &&
            item.coordinates[1] === occurrence.coordinates[1]
          );
          selectOccurrences(group);
        }}
        onClusterClick={selectOccurrences}
      />

      {(isLoading || error || emptyMessage) && (
        <div className="absolute left-1/2 top-4 z-20 w-[min(92vw,420px)] -translate-x-1/2 border border-border bg-background px-4 py-3 shadow-lg">
          {isLoading ? (
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <Spinner className="size-4" />
              Carregando ocorrencias do backend...
            </div>
          ) : error ? (
            <div className="flex items-start gap-3 text-sm text-destructive">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              <span>{error.message}</span>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">{emptyMessage}</p>
          )}
        </div>
      )}

      {!isLoading && !error && !emptyMessage && invalidCoordinatesCount > 0 && (
        <div className="absolute bottom-4 left-4 z-20 border border-border bg-background px-3 py-2 text-xs text-muted-foreground shadow-lg">
          {invalidCoordinatesCount} ocorrencia(s) sem coordenadas validas foram ocultadas.
        </div>
      )}
    </div>
  );
}
