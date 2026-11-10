import { readFileSync, statSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";

/* The link preview (what a chat, LinkedIn or the Builder Center shows for the address) comes from tags in index.html. Crawlers do not run the
 * page's JavaScript, so the tags must be static, the URLs absolute, and the image a real file of the declared size. */
const html = readFileSync(new URL("../../index.html", import.meta.url), "utf8");
const awsStatus = parse(readFileSync(new URL("../../content/aws-status.yaml", import.meta.url), "utf8")) as { liveUrl: string };

const tag = (attr: "property" | "name", key: string) => {
  const m = html.match(new RegExp(`<meta\\s+${attr}="${key}"\\s+content="([^"]*)"`));
  return m ? m[1] : undefined;
};

/* width and height of a baseline or progressive JPEG, read from its start-of-frame marker */
function jpegSize(buf: Buffer): { w: number; h: number } {
  let i = 2;
  while (i < buf.length) {
    if (buf[i] !== 0xff) { i++; continue; }
    const marker = buf[i + 1]!;
    if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) return { h: buf.readUInt16BE(i + 5), w: buf.readUInt16BE(i + 7) };
    i += 2 + buf.readUInt16BE(i + 2);
  }
  throw new Error("no JPEG frame header");
}

describe("link preview tags in index.html", () => {
  const live = awsStatus.liveUrl;

  it("points the page address at the live URL recorded in aws-status.yaml", () => {
    expect(tag("property", "og:url")).toBe(live);
    expect(html).toContain(`<link rel="canonical" href="${live}" />`);
  });

  it("has a title, a description and a site name", () => {
    expect(tag("property", "og:title")).toBeTruthy();
    expect(tag("property", "og:description")).toBeTruthy();
    expect(tag("property", "og:site_name")).toBeTruthy();
    expect(tag("name", "twitter:title")).toBe(tag("property", "og:title"));
    expect(tag("name", "twitter:description")).toBe(tag("property", "og:description"));
  });

  it("uses a large image card with an absolute image address on the live site", () => {
    expect(tag("name", "twitter:card")).toBe("summary_large_image");
    const image = tag("property", "og:image");
    expect(image).toBe(`${live}og-image.jpg`);
    expect(tag("name", "twitter:image")).toBe(image);
    expect(tag("property", "og:image:alt")).toBeTruthy();
    expect(tag("name", "twitter:image:alt")).toBeTruthy();
  });

  it("declares the size of the image file that is really in public/, and keeps it small enough for every previewer", () => {
    const path = new URL("../../public/og-image.jpg", import.meta.url);
    const buf = readFileSync(path);
    expect(buf.subarray(0, 3).toString("hex")).toBe("ffd8ff"); /* a JPEG */
    const { w, h } = jpegSize(buf);
    expect({ w, h }).toEqual({ w: 1200, h: 630 });
    expect(tag("property", "og:image:width")).toBe(String(w));
    expect(tag("property", "og:image:height")).toBe(String(h));
    expect(tag("property", "og:image:type")).toBe("image/jpeg");
    expect(statSync(path).size).toBeLessThan(300 * 1024); /* well under the 5 MB limits; small cards load fast */
  });

  it("makes no claim in the preview text that the page itself does not make", () => {
    /* the description is the one already shown in the page's own meta description; it must not mention an AWS service or a metric */
    const text = [tag("property", "og:title"), tag("property", "og:description")].join(" ");
    expect(text).not.toMatch(/amplify|lambda|bedrock|\d\s?%|precision@|hit@/i);
  });
});
