import { describe, expect, it } from "vitest";
import { AwsStatus } from "../../src/content/schema";
import portfolio from "../../src/generated/portfolio.json";

const base = portfolio.aws as unknown as AwsStatus;
const ok = { on: "2026-11-01", method: "Fetched by the test", result: "HTTP 200" };

describe("AWS status schema: a live address and a console record are different evidence", () => {
  it("the shipped record parses, is live, and names the endpoint check", () => {
    expect(AwsStatus.safeParse(base).success).toBe(true);
    expect(base.deployed).toBe(true);
    expect(base.endpointCheck?.result).toContain("200");
  });
  it("refuses deployed: true without an endpoint check or without a URL", () => {
    expect(AwsStatus.safeParse({ ...base, endpointCheck: undefined }).success).toBe(false);
    expect(AwsStatus.safeParse({ ...base, liveUrl: undefined }).success).toBe(false);
  });
  it("refuses a URL or console record while deployed is false", () => {
    expect(AwsStatus.safeParse({ ...base, deployed: false }).success).toBe(false);
    expect(AwsStatus.safeParse({ ...base, deployed: false, liveUrl: undefined, endpointCheck: undefined }).success).toBe(true);
  });
  it("accepts a live site with no console record, and requires both build ID and screenshot when one is given", () => {
    expect(AwsStatus.safeParse({ ...base, endpointCheck: ok, consoleRecord: undefined }).success).toBe(true);
    expect(AwsStatus.safeParse({ ...base, consoleRecord: { buildId: "3", capturedOn: "2026-11-01" } }).success).toBe(false);
    expect(AwsStatus.safeParse({ ...base, consoleRecord: { buildId: "3", screenshot: "reports/screens/b.png", capturedOn: "2026-11-01" } }).success).toBe(true);
  });
  it("only Amplify Hosting is connected; the backend services stay planned", () => {
    expect(base.connected.map((c) => c.name)).toEqual(["AWS Amplify Hosting"]);
    expect(base.planned.map((p) => p.name)).toEqual(expect.arrayContaining(["AWS Lambda", "Amazon Bedrock", "Amazon API Gateway"]));
  });
});
