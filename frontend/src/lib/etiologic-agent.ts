/**
 * "Agente etiológico" is the parasite. The data still has two fields (parasite and the former "vetor"),
 * so the screens show both merged under one label: trimmed, without repeated values (case-insensitive).
 */
export function etiologicAgent(...values: (string | null | undefined)[]): string | null {
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const value of values) {
    const trimmed = value?.trim();
    if (!trimmed || seen.has(trimmed.toLowerCase())) continue;
    seen.add(trimmed.toLowerCase());
    unique.push(trimmed);
  }
  return unique.length > 0 ? unique.join(" / ") : null;
}
