# Adding content later

All three are plain text files. After editing, run `npm run build` (it validates, regenerates data, type-checks and builds). If it fails, the message names the file and the field.

## A new certification (for example AWS Cloud Practitioner)

Open `content/certifications.yaml` and add an entry **at the top of its group**:

```yaml
- kind: main                      # main = professional credential, learning = course
  issuer: AWS
  title: "Cloud Practitioner"
  detail: "AWS Certified Cloud Practitioner"
  year: "2026"                    # the year you passed, in quotes
  href: "https://www.credly.com/badges/..."   # the issuer's own verification page, https only
```

Rules the build enforces: `href` must be an https link, `year` must look like `2026`, and the words "AWS Certified" are only allowed inside this file, so a certificate must exist (with its verification link) before the claim can appear anywhere on the site. Add only what you have earned. A certificate you are still studying for does not go in this file.

Optional: `extra: { label: "...", href: "https://..." }` adds a second link (a letter, a transcript).

## A new smaller project

Open `content/small-projects.yaml` and add a card at the top:

```yaml
- title: "Project name"
  text: "One or two sentences. Say if it is a team project and what you did."
  tags: ["Python", "FastAPI"]
  link: "View code"
  href: "https://github.com/..."
```

## A full project case (like TraffiX, FlyRank, HR)

These are hand-built because each has its own diagram and numbers. A new one needs: a component in `src/sections/projects/`, an entry in `content/projects.yaml`, sources and claims in `content/sources.yaml` and `content/claims.yaml`, and passages in `content/passages.yaml` so the terminal can answer questions about it. Every number needs a claim with a source link; the build rejects passages that cite unsupported claims.

## AWS status (the one place AWS facts live)

`content/aws-status.yaml` feeds the AWS section, the question box and the terminal. Rules the build enforces: `deployed: true` needs both `liveUrl` and `buildRecord`; a service under `connected` needs a link to the file or console record that proves it and cannot also be under `planned`. Never infer a deployment from `amplify.yml`, or a service from a dependency or a plan.

## A new skill domain

Add an entry to `content/skills.yaml` with a link to where you used the tool. The Skills section and the "what tools did Aziz use?" answer both read it.

