"use client";

import type { Occurrence, OccurrenceProperties } from "@/entities/occurrence/occurrence.types";

import { useDashboardFilterOptions } from "../../hooks/useDashboardFilterOptions";

import { LeftSidebarFilters } from "./LeftSidebarFilters";
import { LeftSidebarTools } from "./LeftSidebarTools";

interface DashboardLeftSidebarProps {
  occurrences: Occurrence[];
  unlocated?: OccurrenceProperties[];
}

export function DashboardLeftSidebar({
  occurrences,
  unlocated = [],
}: DashboardLeftSidebarProps) {
  const filterOptions =
    useDashboardFilterOptions(occurrences, unlocated);

  return (
    <aside className="flex h-full w-72 shrink-0 flex-col border-r border-border bg-background">
      <div className="shrink-0">
        <LeftSidebarTools />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <LeftSidebarFilters
          options={filterOptions}
        />
      </div>
    </aside>
  );
}