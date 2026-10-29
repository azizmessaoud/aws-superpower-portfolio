/* Lowercase, fold accents, drop stopwords (English + a few French), light suffix stemming. */
const STOP = new Set(
  ("a an and are as at be by can did do does for from has have how i in is it its me my of on or our so than that the their them " +
    "then there these they this to was we were what when where which who why will with you your yours know knows knew about into over per " +
    "le la les de des du un une et en dans pour par sur au aux est sont vous nous comment quel quelle ce ces que qui").split(" "),
);

export function stem(word: string): string {
  if (word.length <= 3) return word;
  if (word.endsWith("ies") && word.length > 4) return word.slice(0, -3) + "y";
  if (word.endsWith("sses")) return word.slice(0, -2);
  if (word.endsWith("ing") && word.length > 5) return word.slice(0, -3);
  if (word.endsWith("ed") && word.length > 4) return word.slice(0, -2);
  if (word.endsWith("ez") && word.length > 4) return word.slice(0, -2);
  if (/(ch|sh|x|ss)es$/.test(word)) return word.slice(0, -2);
  if (word.endsWith("s") && !/(ss|us|is)$/.test(word)) return word.slice(0, -1);
  return word;
}

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .split(/[^a-z0-9]+/)
    .filter((t) => t && !STOP.has(t))
    .map(stem);
}
