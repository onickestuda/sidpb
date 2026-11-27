"use client";

import { useMemo } from "react";

import type { Occurrence, OccurrenceProperties } from "@/entities/occurrence/occurrence.types";
import { CURATION_LABELS, UNLOCATED_LABEL } from "@/entities/occurrence/occurrence.types";
import { occurrenceField } from "@/modules/occurrences/utils/occurrence-presentation";

export interface DashboardFilterOption {
  label: string;
  count: number;
}

export interface DashboardFilterOptions {
  diseases: DashboardFilterOption[];
  vectors: DashboardFilterOption[];
  hosts: DashboardFilterOption[];
  states: DashboardFilterOption[];
  curation: DashboardFilterOption[];
}

function createOptions(
  values: string[]
): DashboardFilterOption[] {
  const counts = new Map<string, number>();

  values.forEach((value) => {
    // Placeholders for absent data ("Não informado", "-") are not filter options.
    if (!occurrenceField(value)) return;

    counts.set(
      value,
      (counts.get(value) ?? 0) + 1
    );
  });

  return Array.from(counts.entries())
    .map(([label, count]) => ({
      label,
      count,
    }))
    .sort((a, b) =>
      a.label.localeCompare(b.label, "pt-BR", {
        sensitivity: "base",
      })
    );
}

export function useDashboardFilterOptions(
  located: Occurrence[] = [],
  unlocated: OccurrenceProperties[] = []
): DashboardFilterOptions {
  return useMemo(() => {
    // Occurrences without a point still count in every facet; their location is its own option.
    const occurrences: OccurrenceProperties[] = [...located, ...unlocated];
    return {
      diseases: createOptions(
        occurrences.map(
          (occurrence) => occurrence.disease
        )
      ),

      vectors: createOptions(
        occurrences.flatMap(
          (occurrence) => Array.from(new Set([occurrence.vector, occurrence.parasite ?? ""]))
        )
      ),

      hosts: createOptions(
        occurrences.map(
          (occurrence) => occurrence.host
        )
      ),

      states: [
        ...createOptions(located.map((occurrence) => occurrence.state)),
        ...(unlocated.length > 0 ? [{ label: UNLOCATED_LABEL, count: unlocated.length }] : []),
      ],

      curation: createOptions(
        occurrences.map((occurrence) => CURATION_LABELS[occurrence.curation])
      ),
    };
  }, [located, unlocated]);
}
