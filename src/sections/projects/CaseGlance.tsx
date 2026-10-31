import { CASES } from "./summary";

/* The top of each case study: result and caveat first, then the ownership boundary, from the shared summary. */
export default function CaseGlance({ id }: { id: (typeof CASES)[number]["id"] }) {
  const c = CASES.find((x) => x.id === id)!;
  return (
    <dl className="glance" aria-label={`${c.title} at a glance`}>
      <div className="glance-row"><dt>Result</dt><dd>{c.result}</dd></div>
      <div className="glance-row glance-caveat"><dt>Caveat</dt><dd>{c.caveat}</dd></div>
      {c.myPart && <div className="glance-row"><dt>My part</dt><dd>{c.myPart}</dd></div>}
      <div className="glance-row"><dt>Boundary</dt><dd>{c.boundary}</dd></div>
    </dl>
  );
}
