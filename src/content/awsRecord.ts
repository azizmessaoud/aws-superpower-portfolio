import type { AwsStatus } from "./schema";

/* One wording for the AWS record, used by the AWS section and the answer engine, so they cannot disagree.
 * A reachable address and a console build record are different evidence; the second may be missing. */
export function endpointLine(aws: AwsStatus): string {
  const c = aws.endpointCheck!;
  return `Endpoint checked ${c.on}: ${c.result}`;
}

export function consoleRecordLine(aws: AwsStatus): string {
  const r = aws.consoleRecord;
  return r
    ? `Amplify console build record: build ${r.buildId}, captured ${r.capturedOn}; screenshot ${r.screenshot}.`
    : "Amplify console build record: not captured yet (no build ID or console screenshot is recorded here).";
}
