/* Fails the build when content could put an unsupported claim in front of a judge. */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { loadContent } from "./content";

const { sources, claims, passages, projects, judged } = loadContent();
const errors: string[] = [];
const sourceIds = new Set(sources.map((s) => s.id));
const claimById = new Map(claims.map((c) => [c.id, c]));
const projectIds = new Set(projects.map((p) => p.id));
const passageIds = new Set(passages.map((p) => p.id));
const ALLOWED_URL = /^https:\/\/(github\.com\/azizmessaoud\/|azizmessaoud\.github\.io\/projectx0|builder\.aws\.com\/)/;

for (const s of sources) if (!ALLOWED_URL.test(s.url)) errors.push(`source ${s.id}: URL outside the allowed evidence hosts`);
for (const c of claims) {
  c.sources.forEach((id) => sourceIds.has(id) || errors.push(`claim ${c.id}: unknown source ${id}`));
  if (c.status === "caveated" && !c.limitations.length) errors.push(`claim ${c.id}: caveated without limitations`);
}
for (const p of passages) {
  if (!projectIds.has(p.projectId)) errors.push(`passage ${p.id}: unknown project`);
  p.sources.forEach((id) => sourceIds.has(id) || errors.push(`passage ${p.id}: unknown source ${id}`));
  if (p.anchors.length !== p.sources.length) errors.push(`passage ${p.id}: one anchor per source`);
  for (const id of p.claimIds) {
    const c = claimById.get(id);
    if (!c) errors.push(`passage ${p.id}: unknown claim ${id}`);
    else if (c.status === "unresolved" || c.status === "prohibited") errors.push(`passage ${p.id}: publishes ${c.status} claim ${id}`);
    else if (c.status === "caveated" && !p.limitations.length && !c.limitations.length) errors.push(`passage ${p.id}: caveated claim ${id} shown without limitations`);
  }
}
for (const q of judged) q.relevant.forEach((id) => passageIds.has(id) || errors.push(`judged ${q.id}: unknown passage ${id}`));

/* An "AWS Certified" claim in prose still fails the build. It is allowed only as a certification entry,
 * which the schema forces to carry the issuer's https verification link. */
const AWS_CLAIM = /aws certified/i;

/* Deny-list (register §C): contextual phrases, so honest text like "PostgreSQL is only planned" passes. */
const DENY: RegExp[] = [
  /87\s?% answer accuracy/i, /\+?34\s?% ndcg/i, /map@0\.5\s?=\s?0\.91/i, /24\s?fps/i, /4\.3\s?\/\s?5/i, /2,?400 bilingual/i,
  /3\+ years/i, /4 production ai projects/i, /production[- ]grade/i, /systems i've shipped/i, /that actually ship/i,
  /traffix[^.]{0,60}\b(yolo|deepsort|computer vision|gradio)/i, /hr[^.]{0,40}agentic rag/i, /search ranking engine/i,
  /huggingface\.co\/spaces/i, /respond[s]? within 24 hours/i, /sudo hire/i, /aziz@ai-os/i,
  /−?41\s?% car wait/i, /487\s?(→|->)\s?241/i, /0\.24\s?(→|->|to)\s?0\.74/i,
  /deployed on aws amplify/i, /live on aws/i, /92\.3\s?%/i,
  /measures? (your|my) (intelligence|skill)/i, /\+216/, /pyspark/i,
];
function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? (f === "generated" ? [] : walk(p)) : /\.(tsx?|ya?ml|html|css)$/.test(f) ? [p] : [];
  });
}
const root = new URL("..", import.meta.url).pathname;
const rendered = [...walk(join(root, "src")), ...walk(join(root, "content")), join(root, "index.html")];
for (const file of rendered) {
  if (file.endsWith("validate-content.ts")) continue;
  const text = readFileSync(file, "utf8");
  if (AWS_CLAIM.test(text) && !file.endsWith("certifications.yaml")) errors.push(`${file.replace(root, "")}: "AWS Certified" outside certifications.yaml`);
  for (const re of DENY) if (re.test(text) && !(file.endsWith("claims.yaml") && /0\.24/.test(re.source))) errors.push(`${file.replace(root, "")}: matches deny-list ${re}`);
}

if (errors.length) { console.error(`content validation FAILED (${errors.length})\n- ` + errors.join("\n- ")); process.exit(1); }
console.log(`content validation passed: ${passages.length} passages, ${claims.length} claims, ${judged.length} judged questions`);
