"use client";

import { useEffect, useState } from "react";
import { Bookmark, BookmarkCheck, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { CurationFacetOption, CurationFacets } from "@/entities/submission/submission.types";

export type SpecialtyKey = "diseases" | "vectors" | "hosts" | "states";
export type SpecialtySelection = Record<SpecialtyKey, string[]>;

export const EMPTY_SELECTION: SpecialtySelection = { diseases: [], vectors: [], hosts: [], states: [] };
const CATEGORIES: [SpecialtyKey, string][] = [
  ["diseases", "Doenças"], ["vectors", "Agentes etiológicos"], ["hosts", "Hospedeiros"], ["states", "Estados"],
];

const storageKey = (userId: number) => `sidpb-minhas-areas:${userId}`;

/** "Minhas áreas": the curator's saved specialty selection, kept in this browser per account. */
export function loadMyAreas(userId: number): SpecialtySelection | null {
  try {
    const saved = window.localStorage.getItem(storageKey(userId));
    return saved ? { ...EMPTY_SELECTION, ...JSON.parse(saved) } : null;
  } catch { return null; }
}

function saveMyAreas(userId: number, selection: SpecialtySelection | null) {
  if (selection) window.localStorage.setItem(storageKey(userId), JSON.stringify(selection));
  else window.localStorage.removeItem(storageKey(userId));
}

const count = (selection: SpecialtySelection) => Object.values(selection).reduce((total, values) => total + values.length, 0);
const same = (a: SpecialtySelection | null, b: SpecialtySelection) =>
  Boolean(a) && CATEGORIES.every(([key]) => [...a![key]].sort().join("|") === [...b[key]].sort().join("|"));

function Chip({ option, selected, onToggle }: { option: CurationFacetOption; selected: boolean; onToggle(): void }) {
  return (
    <button type="button" onClick={onToggle} aria-pressed={selected}
      className={`inline-flex items-center gap-1.5 rounded-[2px] border px-2 py-1 text-xs transition-colors ${
        selected ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background hover:bg-muted"}`}>
      {option.label}<span className={selected ? "opacity-80" : "text-muted-foreground"}>{option.count}</span>
    </button>
  );
}

interface SpecialtyFiltersProps {
  userId: number;
  facets: CurationFacets | undefined;
  selection: SpecialtySelection;
  onChange(selection: SpecialtySelection): void;
}

/** Specialty filters of the curation queue, with counts, and the "Minhas áreas" preset. */
export function SpecialtyFilters({ userId, facets, selection, onChange }: SpecialtyFiltersProps) {
  const [myAreas, setMyAreas] = useState<SpecialtySelection | null>(null);
  useEffect(() => { setMyAreas(loadMyAreas(userId)); }, [userId]);

  const toggle = (key: SpecialtyKey, label: string) => onChange({
    ...selection, [key]: selection[key].includes(label) ? selection[key].filter((item) => item !== label) : [...selection[key], label],
  });
  const total = count(selection);
  const applied = same(myAreas, selection);

  return (
    <section className="space-y-3 rounded-[2px] border border-border p-4" aria-label="Filtrar por especialidade">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">Especialidade{total > 0 ? ` · ${total} selecionado(s)` : ""}</h3>
        <div className="flex flex-wrap gap-2">
          {myAreas && !applied && (
            <Button type="button" variant="outline" size="sm" onClick={() => onChange(myAreas)}>
              <BookmarkCheck className="size-4" />Aplicar minhas áreas
            </Button>
          )}
          {total > 0 && !applied && (
            <Button type="button" variant="outline" size="sm" onClick={() => { saveMyAreas(userId, selection); setMyAreas(selection); }}>
              <Bookmark className="size-4" />Salvar como minhas áreas
            </Button>
          )}
          {applied && (
            <Button type="button" variant="ghost" size="sm" onClick={() => { saveMyAreas(userId, null); setMyAreas(null); }}>
              Esquecer minhas áreas
            </Button>
          )}
          {total > 0 && (
            <Button type="button" variant="ghost" size="sm" onClick={() => onChange(EMPTY_SELECTION)}>
              <X className="size-4" />Limpar
            </Button>
          )}
        </div>
      </div>
      {applied && <p className="text-xs text-primary">Mostrando as submissões das suas áreas.</p>}
      {!facets ? <p className="text-xs text-muted-foreground">Carregando especialidades...</p> : (
        <div className="grid gap-3 lg:grid-cols-2">
          {CATEGORIES.map(([key, title]) => (
            <div key={key} className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground">{title}</p>
              {facets[key].length === 0 ? <p className="text-xs text-muted-foreground">Nenhum valor nesta fila.</p> : (
                <div className="flex max-h-28 flex-wrap gap-1.5 overflow-y-auto">
                  {/* Keep selected values visible even when they have no submission in the current tab. */}
                  {[...facets[key], ...selection[key].filter((label) => !facets[key].some((option) => option.label === label))
                    .map((label) => ({ label, count: 0 }))].map((option) => (
                    <Chip key={option.label} option={option} selected={selection[key].includes(option.label)}
                      onToggle={() => toggle(key, option.label)} />
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
