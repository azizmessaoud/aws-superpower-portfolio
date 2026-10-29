import { z } from "zod";

export const Status = z.enum(["supported", "caveated", "unresolved", "prohibited"]);

export const Source = z.object({
  id: z.string(),
  kind: z.enum(["repo", "report", "notebook", "site", "cv", "official"]),
  url: z.string().url(),
  ref: z.string().optional(),
  checkedOn: z.string(),
});

export const Metric = z.object({
  name: z.string(),
  value: z.string(),
  definition: z.string().min(10),
  conditions: z.string().min(5),
  baseline: z.string().optional(),
});

export const Claim = z.object({
  id: z.string(),
  projectId: z.string(),
  status: Status,
  sources: z.array(z.string()).min(1),
  metric: Metric.optional(),
  limitations: z.array(z.string()),
});

export const Passage = z.object({
  id: z.string(),
  projectId: z.string(),
  claimIds: z.array(z.string()).min(1),
  title: z.string(),
  text: z.string().min(40),
  context: z.string(),
  limitations: z.array(z.string()),
  sources: z.array(z.string()).min(1),
  anchors: z.array(z.string()),
  tags: z.array(z.string()),
  /** Question words this passage argues against (e.g. "faster" for the slower-ambulance result). */
  challenges: z.array(z.string()).default([]),
});

export const Project = z.object({
  id: z.string(),
  title: z.string(),
  framing: z.string(),
  layout: z.enum(["control-hierarchy", "ranking-queue", "pipeline", "none"]),
  repoUrl: z.string().url(),
});

const https = z.string().url().refine((u) => u.startsWith("https://"), "must be an https URL");

/** A credential in the Certifications section; href is the issuer's own verification page. */
export const Certification = z.object({
  kind: z.enum(["main", "learning"]),
  issuer: z.string().min(2),
  title: z.string().min(3),
  detail: z.string().min(3),
  year: z.string().regex(/^20\d\d$/),
  href: https,
  extra: z.object({ label: z.string(), href: https }).optional(),
});

/** A card under "Smaller projects". */
export const SmallProject = z.object({
  title: z.string().min(3),
  text: z.string().min(20),
  tags: z.array(z.string()).min(1),
  link: z.string().min(3),
  href: https,
});

export const Judged = z.object({
  id: z.string(),
  question: z.string(),
  relevant: z.array(z.string()),
  note: z.string().optional(),
});

export type Source = z.infer<typeof Source>;
export type Claim = z.infer<typeof Claim>;
export type Passage = z.infer<typeof Passage>;
export type Project = z.infer<typeof Project>;
export type Judged = z.infer<typeof Judged>;

/** A passage as shipped to the browser: sources resolved to evidence links. */
export interface CorpusPassage {
  id: string;
  projectId: string;
  projectTitle: string;
  title: string;
  text: string;
  context: string;
  limitations: string[];
  evidence: { label: string; url: string }[];
  tags: string[];
  challenges: string[];
}

export type Certification = z.infer<typeof Certification>;
export type SmallProject = z.infer<typeof SmallProject>;

/** Portfolio lists shipped to the browser beside the corpus. */
export interface Portfolio {
  certifications: Certification[];
  smallProjects: SmallProject[];
  skills: SkillDomain[];
  interview: InterviewQuestion[];
  aws: AwsStatus;
}

export interface Corpus {
  passages: CorpusPassage[];
  synonyms: Record<string, string[]>;
}

/** content/aws-status.yaml: the only place AWS facts live. The site never says more than this file proves. */
export const AwsStatus = z.object({
  checkedOn: z.string(),
  deployed: z.boolean(),
  /** Required when deployed: the public URL, and a pointer to the Amplify build record that proves it. */
  liveUrl: https.optional(),
  buildRecord: z.string().min(10).optional(),
  buildChain: z.array(z.string()).min(1),
  verified: z.array(z.object({ text: z.string(), href: https })).min(1),
  /** Services actually connected. Each needs a link to the file or console record that proves it. */
  connected: z.array(z.object({ name: z.string(), evidence: https })),
  planned: z.array(z.object({ name: z.string(), note: z.string() })),
  costSafety: z.array(z.string()).min(1),
});
export type AwsStatus = z.infer<typeof AwsStatus>;

export const SkillDomain = z.object({
  icon: z.enum(["ranking", "agents", "document", "retrieval", "data", "api", "toolkit"]),
  title: z.string(),
  chips: z.array(z.string()).min(1),
  hi: z.array(z.string()).default([]),
  where: z.string().optional(),
  href: https.optional(),
});
export type SkillDomain = z.infer<typeof SkillDomain>;

export const InterviewQuestion = z.object({ question: z.string().min(10), passage: z.string() });
export type InterviewQuestion = z.infer<typeof InterviewQuestion>;
