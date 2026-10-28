import { readFileSync } from "node:fs";
import { parse } from "yaml";
import { z } from "zod";
import { Claim, Judged, Passage, Project, Source } from "../src/content/schema";

const read = <T extends z.ZodTypeAny>(file: string, schema: T): z.infer<T>[] =>
  z.array(schema).parse(parse(readFileSync(new URL(`../content/${file}`, import.meta.url), "utf8")));

export function loadContent() {
  return {
    sources: read("sources.yaml", Source),
    claims: read("claims.yaml", Claim),
    passages: read("passages.yaml", Passage),
    projects: read("projects.yaml", Project),
    judged: read("judged.yaml", Judged),
    synonyms: parse(readFileSync(new URL("../content/synonyms.yaml", import.meta.url), "utf8")) as Record<string, string[]>,
  };
}
