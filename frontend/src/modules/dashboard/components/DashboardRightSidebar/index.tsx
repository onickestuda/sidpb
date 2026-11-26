"use client";

import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Occurrence } from "@/entities/occurrence/occurrence.types";
import { useMapStore } from "@/modules/map/store/mapStore";
import { OccurrenceDetails } from "@/modules/occurrences/components/OccurrencePanel/OccurrenceDetails";
import { OccurrenceSources } from "@/modules/occurrences/components/OccurrencePanel/OccurrenceSources";
import {
  OCCURRENCES_PER_PAGE,
  formatOccurrenceDisplayDate,
  occurrenceDateKey,
  occurrenceField,
  occurrenceLocation,
  sharedOccurrenceLocation,
  sortOccurrences,
  type OccurrenceSortOrder,
} from "@/modules/occurrences/utils/occurrence-presentation";

export function DashboardRightSidebar({ occurrences }: { occurrences: Occurrence[] }) {
  const selectedOccurrence = useMapStore((state) => state.selectedOccurrence);
  const setSelectedOccurrence = useMapStore((state) => state.setSelectedOccurrence);
  const clearOccurrenceSelection = useMapStore((state) => state.clearOccurrenceSelection);
  const [page, setPage] = useState(1);
  const [order, setOrder] = useState<OccurrenceSortOrder>("newest");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const sorted = useMemo(() => sortOccurrences(occurrences, order), [occurrences, order]);
  const totalPages = Math.ceil(sorted.length / OCCURRENCES_PER_PAGE);
  const currentPage = Math.min(page, Math.max(1, totalPages));
  const start = (currentPage - 1) * OCCURRENCES_PER_PAGE;
  const pageItems = sorted.slice(start, start + OCCURRENCES_PER_PAGE);
  const location = sharedOccurrenceLocation(occurrences);
  const canSort = occurrences.filter((item) => occurrenceDateKey(item.date) !== null).length > 1;

  useLayoutEffect(() => {
    setPage(1);
    setExpandedId(null);
  }, [occurrences, order]);

  useLayoutEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
  }, [occurrences, currentPage, order]);

  function selectOccurrence(occurrence: Occurrence) {
    setSelectedOccurrence(occurrence);
    const map = useMapStore.getState().map;
    const point: [number, number] = [occurrence.coordinates[1], occurrence.coordinates[0]];
    if (map && !map.getBounds().contains(point)) {
      map.panTo(point, { animate: true, duration: 0.3 });
    }
  }

  if (occurrences.length === 0) return null;

  return (
    <aside aria-label="Ocorrências selecionadas" className="flex h-full w-80 flex-col overflow-hidden border-l border-border bg-background xl:w-96">
      <header className="shrink-0 space-y-3 border-b border-border px-4 py-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold">{occurrences.length} {occurrences.length === 1 ? "ocorrência" : "ocorrências"}</h2>
            {location && <p className="mt-1 text-xs text-muted-foreground">{location}</p>}
          </div>
          <Button variant="ghost" size="icon" className="size-8 shrink-0" aria-label="Fechar painel de ocorrências" onClick={clearOccurrenceSelection}>
            <X className="size-4" aria-hidden="true" />
          </Button>
        </div>
        {canSort && (
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            Ordenar:
            <select value={order} onChange={(event) => setOrder(event.target.value as OccurrenceSortOrder)}
              className="min-w-0 flex-1 border border-border bg-background px-2 py-1.5 text-foreground">
              <option value="newest">Mais recentes</option>
              <option value="oldest">Mais antigas</option>
            </select>
          </label>
        )}
      </header>

      <div ref={scrollRef} data-occurrence-scroll className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain p-3">
        {pageItems.map((occurrence) => {
          const selected = selectedOccurrence?.id === occurrence.id;
          const expanded = expandedId === occurrence.id;
          const fields = [
            ["Hospedeiro", occurrenceField(occurrence.host)],
            ["Agente etiológico", occurrenceField(occurrence.vector)],
            ["Parasito", occurrenceField(occurrence.parasite)],
          ].filter(([, value]) => value);
          return (
            <article key={occurrence.id} data-occurrence-id={occurrence.id}
              className={`border bg-card transition-colors ${selected ? "border-primary ring-1 ring-primary/30" : "border-border"}`}>
              <button type="button" aria-pressed={selected}
                aria-label={`Selecionar ocorrência ${occurrence.id}`}
                onClick={() => selectOccurrence(occurrence)}
                className="block w-full space-y-2 p-3 text-left hover:bg-muted/30 focus-visible:outline-2 focus-visible:outline-primary">
                <h3 className="text-sm font-semibold">{occurrenceField(occurrence.disease) ?? `Ocorrência #${occurrence.id}`}</h3>
                <p className="text-xs text-muted-foreground">
                  {[occurrenceLocation(occurrence), formatOccurrenceDisplayDate(occurrence.date)].filter(Boolean).join(" · ")}
                </p>
                {fields.length > 0 && (
                  <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-2 gap-y-1 text-xs">
                    {fields.map(([label, value]) => (
                      <div key={label} className="contents">
                        <dt className="text-muted-foreground">{label}:</dt>
                        <dd className="break-words">{value}</dd>
                      </div>
                    ))}
                  </dl>
                )}
              </button>
              <div className="flex flex-wrap items-center gap-3 px-3 pb-3">
                <Button variant="outline" size="sm" aria-expanded={expanded}
                  aria-controls={`occurrence-details-${occurrence.id}`}
                  onClick={() => {
                    selectOccurrence(occurrence);
                    setExpandedId(expanded ? null : occurrence.id);
                  }}>
                  {expanded ? "Ocultar detalhes" : "Ver detalhes"}
                </Button>
                <OccurrenceSources articles={occurrence.articles ?? []} compact />
              </div>
              {expanded && (
                <div id={`occurrence-details-${occurrence.id}`} className="border-t border-border p-3">
                  <OccurrenceDetails occurrence={occurrence} />
                </div>
              )}
            </article>
          );
        })}
      </div>

      {totalPages > 1 && (
        <footer className="shrink-0 space-y-2 border-t border-border px-4 py-3 text-xs">
          <p className="text-center text-muted-foreground" aria-live="polite">
            {start + 1}–{Math.min(start + OCCURRENCES_PER_PAGE, sorted.length)} de {sorted.length}
          </p>
          <nav aria-label="Paginação de ocorrências" className="flex items-center justify-between gap-2">
            <Button variant="outline" size="icon" className="size-8" aria-label="Página anterior" disabled={currentPage === 1}
              onClick={() => setPage(currentPage - 1)}><ChevronLeft className="size-4" /></Button>
            <span>Página {currentPage} de {totalPages}</span>
            <Button variant="outline" size="icon" className="size-8" aria-label="Próxima página" disabled={currentPage === totalPages}
              onClick={() => setPage(currentPage + 1)}><ChevronRight className="size-4" /></Button>
          </nav>
        </footer>
      )}
    </aside>
  );
}
