"use client";

import type { UseFormReturn } from "react-hook-form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { ArticleData } from "@/entities/submission/submission.types";

export interface ArticleFormValues {
  title: string; authors: string; year: string; doi: string; disease: string;
  parasite: string; vector: string; host: string; state: string; municipality: string;
  latitude: string; longitude: string; source: string; notes: string;
}

export const EMPTY_ARTICLE: ArticleFormValues = {
  title: "", authors: "", year: "", doi: "", disease: "", parasite: "", vector: "",
  host: "", state: "", municipality: "", latitude: "", longitude: "", source: "", notes: "",
};

export function articleToForm(data: ArticleData): ArticleFormValues {
  return Object.fromEntries(Object.keys(EMPTY_ARTICLE).map((key) => [key,
    key === "authors" ? (data.authors ?? []).join("\n") : String(data[key as keyof ArticleData] ?? ""),
  ])) as unknown as ArticleFormValues;
}

export function formToArticle(values: ArticleFormValues): ArticleData {
  const text = (value: string) => value.trim() || null;
  const number = (value: string) => value.trim() ? Number(value) : null;
  return {
    title: values.title.trim(), authors: values.authors.split(/\r?\n/).map(v => v.trim()).filter(Boolean),
    year: number(values.year), doi: text(values.doi), disease: text(values.disease),
    parasite: text(values.parasite), vector: text(values.vector), host: text(values.host),
    state: text(values.state), municipality: text(values.municipality),
    latitude: number(values.latitude), longitude: number(values.longitude), source: text(values.source), notes: text(values.notes),
  };
}

const FIELDS: { key: keyof ArticleFormValues; label: string; max: number; type?: string; min?: number; numericMax?: number }[] = [
  { key: "title", label: "Título do artigo", max: 500 },
  { key: "year", label: "Ano", max: 4, type: "number", min: 1500, numericMax: 2100 },
  { key: "doi", label: "DOI", max: 200 },
  { key: "source", label: "Revista / fonte", max: 200 },
  { key: "disease", label: "Doença", max: 200 },
  { key: "parasite", label: "Parasito", max: 200 },
  { key: "vector", label: "Agente etiológico", max: 200 },
  { key: "host", label: "Hospedeiro", max: 200 },
  { key: "state", label: "Estado", max: 100 },
  { key: "municipality", label: "Município", max: 200 },
  { key: "latitude", label: "Latitude", max: 30, type: "number", min: -90, numericMax: 90 },
  { key: "longitude", label: "Longitude", max: 30, type: "number", min: -180, numericMax: 180 },
];

export function ArticleFields({ form, prefix, disabled = false }: { form: UseFormReturn<ArticleFormValues>; prefix: string; disabled?: boolean }) {
  const { register, formState: { errors } } = form;
  return (
    <fieldset disabled={disabled} className="grid gap-4 md:grid-cols-2">
      {FIELDS.map(({ key, label, max, type, min, numericMax }) => (
        <div key={key} className={key === "title" ? "space-y-2 md:col-span-2" : "space-y-2"}>
          <Label htmlFor={`${prefix}-${key}`}>{label}{key === "title" ? " *" : ""}</Label>
          <Input id={`${prefix}-${key}`} type={type ?? "text"} required={key === "title"}
            maxLength={max} min={min} max={numericMax} step={key === "year" ? 1 : "any"}
            {...register(key, { validate: key === "title" ? value => Boolean(value.trim()) || "Informe o título." : undefined })} />
          {errors[key] && <p role="alert" className="text-sm text-destructive">{errors[key]?.message}</p>}
        </div>
      ))}
      <div className="space-y-2 md:col-span-2">
        <Label htmlFor={`${prefix}-authors`}>Autores (um por linha)</Label>
        <Textarea id={`${prefix}-authors`} maxLength={10050} rows={3} {...register("authors")} />
      </div>
      <div className="space-y-2 md:col-span-2">
        <Label htmlFor={`${prefix}-notes`}>Observações</Label>
        <Textarea id={`${prefix}-notes`} maxLength={4000} rows={3} {...register("notes")} />
      </div>
    </fieldset>
  );
}
