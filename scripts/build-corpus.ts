/* Builds src/generated/corpus.json from content/*.yaml: the only content the browser receives. */
import { mkdirSync, writeFileSync } from "node:fs";
import type { Corpus, Portfolio } from "../src/content/schema";
import { loadContent } from "./content";

const { sources, passages, projects, synonyms, certifications, smallProjects } = loadContent();
const sourceById = new Map(sources.map((s) => [s.id, s]));
const titleById = new Map(projects.map((p) => [p.id, p.title]));
const LABEL: Record<string, string> = { repo: "README", report: "Report", notebook: "Notebook", site: "Live portfolio source", cv: "CV", official: "Official page" };

const corpus: Corpus = {
  passages: passages.map((p) => ({
    id: p.id,
    projectId: p.projectId,
    projectTitle: titleById.get(p.projectId) ?? p.projectId,
    title: p.title,
    text: p.text,
    context: p.context,
    limitations: p.limitations,
    evidence: p.sources.map((id, i) => {
      const s = sourceById.get(id)!;
      const file = s.url.split("/").pop()!;
      return { label: `${LABEL[s.kind]} · ${file}${s.ref ? ` @ ${s.ref.split(" ")[0]}` : ""}`, url: s.url + (p.anchors[i] ?? "") };
    }),
    tags: p.tags,
  })),
  synonyms,
};

mkdirSync(new URL("../src/generated/", import.meta.url), { recursive: true });
writeFileSync(new URL("../src/generated/corpus.json", import.meta.url), JSON.stringify(corpus, null, 1));
console.log(`corpus: ${corpus.passages.length} passages`);

const portfolio: Portfolio = { certifications, smallProjects };
writeFileSync(new URL("../src/generated/portfolio.json", import.meta.url), JSON.stringify(portfolio, null, 1));
console.log(`portfolio: ${certifications.length} certifications, ${smallProjects.length} smaller projects`);
