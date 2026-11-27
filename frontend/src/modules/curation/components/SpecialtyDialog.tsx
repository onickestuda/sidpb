"use client";

import { useMemo, useState } from "react";
import { Search, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { CurationFacetOption, CurationFacets, SpecialtySelection } from "@/entities/submission/submission.types";
import { FilterOption } from "@/modules/dashboard/components/DashboardLeftSidebar/FilterOption";
import { FilterSection } from "@/modules/dashboard/components/DashboardLeftSidebar/FilterSection";

export type SpecialtyKey = keyof SpecialtySelection;
export const EMPTY_SELECTION: SpecialtySelection = { diseases: [], vectors: [], hosts: [], states: [] };

/** Same groups as the map filters, without "Curadoria". */
const CATEGORIES: [SpecialtyKey, string][] = [
  ["diseases", "Doenças"], ["vectors", "Agentes etiológicos"], ["hosts", "Hospedeiros"], ["states", "Estados"],
];

export const selectionCount = (selection: SpecialtySelection) =>
  CATEGORIES.reduce((total, [key]) => total + selection[key].length, 0);

// Case- and accent-insensitive: "miiase" finds "Miíase".
const fold = (value: string) => value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

interface SpecialtyDialogProps {
  facets: CurationFacets | undefined;
  selection: SpecialtySelection;
  saving: boolean;
  /** Applies the selection to the queue and saves it in the curator's account. */
  onApply(selection: SpecialtySelection): Promise<unknown>;
}

export function SpecialtyDialog({ facets, selection, saving, onApply }: SpecialtyDialogProps) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<SpecialtySelection>(selection);
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState<Partial<Record<SpecialtyKey, boolean>>>({});
  const [error, setError] = useState<string | null>(null);
  const active = selectionCount(selection);
  const searching = query.trim() !== "";

  function openDialog(next: boolean) {
    if (next) { setDraft(selection); setQuery(""); setExpanded({}); setError(null); }
    setOpen(next);
  }

  // Options of each category, keeping selected values visible even when absent from the current tab.
  const options = useMemo(() => {
    const term = fold(query.trim());
    return Object.fromEntries(CATEGORIES.map(([key]) => {
      const known = facets?.[key] ?? [];
      const all: CurationFacetOption[] = [...known,
        ...draft[key].filter((label) => !known.some((option) => option.label === label)).map((label) => ({ label, count: 0 }))];
      return [key, term ? all.filter((option) => fold(option.label).includes(term)) : all];
    })) as Record<SpecialtyKey, CurationFacetOption[]>;
  }, [facets, draft, query]);

  const toggle = (key: SpecialtyKey, label: string) => setDraft((current) => ({
    ...current, [key]: current[key].includes(label) ? current[key].filter((item) => item !== label) : [...current[key], label],
  }));

  async function apply() {
    setError(null);
    try {
      await onApply(draft);
      setOpen(false);
    } catch {
      setError("Não foi possível salvar a especialidade. Tente novamente.");
    }
  }

  return (
    <>
      <Button type="button" variant="outline" onClick={() => openDialog(true)} aria-haspopup="dialog">
        <SlidersHorizontal className="size-4" aria-hidden />Filtrar especialidade
        {active > 0 && (
          <span aria-label={`${active} filtros ativos`}
            className="min-w-5 bg-primary px-1.5 py-0.5 text-center text-[11px] font-semibold leading-none text-primary-foreground">
            {active}
          </span>
        )}
      </Button>

      <Dialog open={open} onOpenChange={openDialog}>
        <DialogContent className="flex max-h-[85vh] flex-col gap-0 p-0 sm:max-w-3xl">
          <DialogHeader className="border-b border-border px-6 py-4">
            <DialogTitle>Especialidade</DialogTitle>
            <DialogDescription className="sr-only">Selecione doenças, agentes etiológicos, hospedeiros e estados da fila de curadoria.</DialogDescription>
          </DialogHeader>

          <div className="border-b border-border px-6 py-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
              <Input type="search" value={query} onChange={(event) => setQuery(event.target.value)}
                placeholder="Buscar em todas as categorias" aria-label="Buscar especialidade" className="pl-9" />
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto">
            {!facets ? <p className="px-6 py-4 text-sm text-muted-foreground">Carregando...</p> : CATEGORIES.map(([key, title]) => (
              <FilterSection key={key} title={title} activeCount={draft[key].length}
                open={searching || Boolean(expanded[key])}
                onOpenChange={(next) => setExpanded((current) => ({ ...current, [key]: next }))}>
                {options[key].length === 0 ? (
                  <p className="py-1 text-xs text-muted-foreground">
                    {searching ? "Nenhum registro correspondente." : "Nenhuma opção disponível."}
                  </p>
                ) : (
                  <div className="grid gap-x-4 sm:grid-cols-2">
                    {options[key].map((option) => (
                      <FilterOption key={option.label} label={option.label} count={option.count}
                        checked={draft[key].includes(option.label)} onChange={() => toggle(key, option.label)} />
                    ))}
                  </div>
                )}
              </FilterSection>
            ))}
          </div>

          <DialogFooter className="items-center border-t border-border px-6 py-3 sm:justify-between">
            {error ? <p role="alert" className="text-xs text-destructive">{error}</p> : <span />}
            <div className="flex gap-2">
              <Button type="button" variant="ghost" disabled={selectionCount(draft) === 0} onClick={() => setDraft(EMPTY_SELECTION)}>
                Limpar
              </Button>
              <Button type="button" disabled={saving} onClick={() => void apply()}>
                {saving ? "Salvando..." : "Aplicar e salvar"}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
