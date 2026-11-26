"use client";

import { useEffect, useMemo } from "react";

import { occurrenceFeatureToOccurrence } from "@/entities/occurrence/occurrence.mappers";
import type { OccurrenceFeatureCollection } from "@/entities/occurrence/occurrence.types";
import type { MapController } from "@/modules/map/types/map-controller.types";

import { DashboardLeftSidebar } from "../DashboardLeftSidebar";
import { DashboardRightSidebar } from "../DashboardRightSidebar";
import { useMapStore } from "@/modules/map/store/mapStore";

interface DashboardContentProps {
  map: MapController;
  occurrences?: OccurrenceFeatureCollection | null;
  children: React.ReactNode;
}

export function DashboardContent({
  occurrences,
  children,
}: DashboardContentProps) {
  const selectedOccurrences = useMapStore((state) => state.selectedOccurrences);
  const clearOccurrenceSelection = useMapStore((state) => state.clearOccurrenceSelection);

  useEffect(() => () => clearOccurrenceSelection(), [clearOccurrenceSelection]);

  const occurrenceList = useMemo(
    () =>
      occurrences?.features.map(
        occurrenceFeatureToOccurrence
      ) ?? [],
    [occurrences]
  );

  return (
    <section data-dashboard-map-layout className="flex min-h-0 min-w-0 flex-1 overflow-hidden bg-background">
      <DashboardLeftSidebar
        occurrences={occurrenceList}
      />

      <div className="relative min-h-0 min-w-0 flex-1 overflow-hidden">
        {children}
      </div>

      <div
        className={`min-h-0 shrink-0 overflow-hidden transition-[width] duration-300 motion-reduce:transition-none ${
          selectedOccurrences.length > 0 ? "w-80 xl:w-96" : "w-0"
        }`}
      >
        {selectedOccurrences.length > 0 && (
          <DashboardRightSidebar occurrences={selectedOccurrences} />
        )}
      </div>
    </section>
  );
}
