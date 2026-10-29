import Icon from "../../ui/Icon";

export function Evidence({ links }: { links: { label: string; url: string }[] }) {
  return (
    <ul className="evidence">
      {links.map((l) => (
        <li key={l.url}><a href={l.url}>{l.label} <Icon name="external" /><span className="sr-only"> (opens GitHub)</span></a></li>
      ))}
    </ul>
  );
}
