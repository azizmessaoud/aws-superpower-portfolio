/* Typo tolerance: Damerau-Levenshtein distance (insert, delete, replace, swap neighbours). */
export function distance(a: string, b: string, max = 3): number {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > max) return max + 1;
  const prev2: number[] = [];
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) cur[j] = Math.min(cur[j], prev2[j - 2] + 1);
    }
    prev2.length = 0; prev2.push(...prev);
    prev = cur;
  }
  return prev[b.length];
}

/** How many typos a word of this length may contain: none for 3 letters or fewer, where a change is a different word;
 * one for 4 letters, but only if the first letter is right ("bild" for "build", never "tool" for "pool"). */
export const allowedTypos = (w: string) => (w.length >= 9 ? 2 : w.length >= 4 ? 1 : 0);
export const sameStart = (a: string, b: string) => a.length > 4 || a[0] === b[0];

export const isNear = (word: string, target: string) => {
  const k = allowedTypos(target);
  return k > 0 && sameStart(target, word) && distance(word, target, k) <= k;
};
