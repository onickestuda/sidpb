import type { Occurrence } from "@/entities/occurrence/occurrence.types";

export const OCCURRENCES_PER_PAGE = 10;
export type OccurrenceSortOrder = "newest" | "oldest";

// The API mapper uses these labels for absent fields. Keep them out of the cards.
export function occurrenceField(value?: string) {
  const trimmed = value?.trim();
  const normalized = trimmed?.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  if (!normalized || normalized === "-" || normalized.includes("nao informad")) return undefined;
  return trimmed;
}

export function occurrenceLocation(occurrence: Occurrence) {
  return [occurrenceField(occurrence.city), occurrenceField(occurrence.state)]
    .filter(Boolean).join(" - ");
}

export function sharedOccurrenceLocation(occurrences: Occurrence[]) {
  const first = occurrences[0];
  if (!first || !occurrenceField(first.city) || !occurrenceField(first.state)) return undefined;
  return occurrences.every((item) => item.city === first.city && item.state === first.state)
    ? occurrenceLocation(first)
    : undefined;
}

export function validSourceUrl(value?: string) {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url.href : undefined;
  } catch {
    return undefined;
  }
}

// Accept the model's ISO dates and partial dates without guessing locale formats.
export function occurrenceDateKey(value: string): number | null {
  const match = /^(\d{4})(?:-(\d{2})(?:-(\d{2}))?)?(?:T.*)?$/.exec(value.trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2] ?? 1);
  const day = Number(match[3] ?? 1);
  if (year < 1000 || month < 1 || month > 12 || day < 1) return null;
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return date.getTime();
}

export function formatOccurrenceDisplayDate(value: string) {
  const key = occurrenceDateKey(value);
  if (key === null) return occurrenceField(value);
  if (/^\d{4}(?:-\d{2})?$/.test(value.trim())) return value.trim();
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit", month: "short", year: "numeric", timeZone: "UTC",
  }).format(new Date(key));
}

export function sortOccurrences(occurrences: Occurrence[], order: OccurrenceSortOrder) {
  return [...occurrences].sort((left, right) => {
    const a = occurrenceDateKey(left.date);
    const b = occurrenceDateKey(right.date);
    if (a === null) return b === null ? 0 : 1;
    if (b === null) return -1;
    return order === "newest" ? b - a : a - b;
  });
}
