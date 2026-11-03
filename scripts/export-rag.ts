import { mkdir, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import corpus from "../src/generated/corpus.json";

const output = resolve("backend/kb-data");
await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
await writeFile(resolve("backend/ask/corpus.json"), JSON.stringify(corpus), "utf8");

for (const passage of corpus.passages) {
  const evidence = passage.evidence.map((source) => `- ${source.label}: ${source.url}`).join("\n");
  const text = [
    `Portfolio passage ID: ${passage.id}`,
    `Project: ${passage.projectTitle}`,
    `Passage: ${passage.title}`,
    `Context: ${passage.context}`,
    `Verified notes: ${passage.text}`,
    `Limitations:\n${passage.limitations.map((item) => `- ${item}`).join("\n") || "- None stated."}`,
    `Evidence:\n${evidence}`,
  ].join("\n\n");
  await writeFile(resolve(output, `${passage.id}.txt`), `${text}\n`, "utf8");
}

console.log(`Exported ${corpus.passages.length} checked passages to ${output}`);
