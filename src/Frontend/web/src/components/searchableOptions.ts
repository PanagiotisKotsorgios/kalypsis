/** Greek searches should not depend on accents, case or final sigma. */
export function normalizeOptionSearch(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("el-GR").replace(/ς/g, "σ").trim();
}

function fuzzyScore(hay: string, needle: string): number {
  let hi = 0, ni = 0, score = 0, streak = 0;
  while (hi < hay.length && ni < needle.length) {
    if (hay[hi] === needle[ni]) { score += 2 + streak++; ni++; }
    else streak = 0;
    hi++;
  }
  return ni === needle.length ? Math.max(0, score - Math.min(hay.length, 30) * .1) : 0;
}

export function filterSearchOptions<T extends { label: string; hint?: string }>(options: readonly T[], query: string, maxShown = 400, fuzzyMinChars = 3): T[] {
  const needle = normalizeOptionSearch(query);
  if (!needle) return options.slice(0, maxShown);
  return options.map((option, index) => {
    const label = normalizeOptionSearch(option.label), hint = normalizeOptionSearch(option.hint ?? "");
    const exact = label.includes(needle) || hint.includes(needle);
    const score = exact ? 1000 : needle.length >= fuzzyMinChars ? Math.max(fuzzyScore(label, needle), fuzzyScore(hint, needle)) : 0;
    return { option, index, score };
  }).filter(row => row.score > 0).sort((a, b) => b.score - a.score || a.index - b.index).slice(0, maxShown).map(row => row.option);
}
