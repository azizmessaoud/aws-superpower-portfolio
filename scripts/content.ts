import { readFileSync } from "node:fs";
import { parse } from "yaml";
import { z } from "zod";
import { AwsStatus, Certification, Claim, GlossaryTerm, InterviewQuestion, SkillDomain, Judged, Passage, Project, SmallProject, Source } from "../src/content/schema";

const read = <T extends z.ZodTypeAny>(file: string, schema: T): z.infer<T>[] =>
  z.array(schema).parse(parse(readFileSync(new URL(`../content/${file}`, import.meta.url), "utf8")));

export function loadContent() {
  return {
    sources: read("sources.yaml", Source),
    claims: read("claims.yaml", Claim),
    passages: read("passages.yaml", Passage),
    projects: read("projects.yaml", Project),
    judged: read("judged.yaml", Judged),
    skills: read("skills.yaml", SkillDomain),
    interview: read("interview.yaml", InterviewQuestion),
    glossary: read("glossary.yaml", GlossaryTerm),
    awsStatus: AwsStatus.parse(parse(readFileSync(new URL("../content/aws-status.yaml", import.meta.url), "utf8"))),
    certifications: read("certifications.yaml", Certification),
    smallProjects: read("small-projects.yaml", SmallProject),
    synonyms: parse(readFileSync(new URL("../content/synonyms.yaml", import.meta.url), "utf8")) as Record<string, string[]>,
  };
}
