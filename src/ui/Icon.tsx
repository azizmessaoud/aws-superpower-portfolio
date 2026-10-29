/* Stroke icons in the prototype's own style (24 viewBox, stroke 2, round joins). */
const PATHS = {
  arrow: "M5 12h14M13 6l6 6-6 6",
  down: "M12 5v14M5 12l7 7 7-7",
  external: "M15 3h6v6M10 14 21 3M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6",
  menu: "M4 7h16M4 12h16M4 17h16",
  close: "M6 6l12 12M18 6 6 18",
  pause: "M9 5v14M15 5v14",
  play: "M7 5l12 7-12 7z",
  search: "M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM21 21l-5-5",
  mail: "M3 6h18v12H3zM3 7l9 6 9-6",
  copy: "M9 9h11v11H9zM5 15H4V4h11v1",
  check: "M5 12l5 5 9-10",
  alert: "M12 8v5M12 16.5v.5M10.3 4.3 2.6 18a2 2 0 0 0 1.7 3h15.4a2 2 0 0 0 1.7-3L13.7 4.3a2 2 0 0 0-3.4 0z",
  /* skill domains */
  ranking: "M4 6h16M4 12h10M4 18h5M18 14v6M15 17l3 3 3-3",
  agents: "M12 3v4M5 10l3 2M19 10l-3 2M12 21v-4M7 18l3-2M17 18l-3-2M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z",
  document: "M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9zM14 3v6h6M8 13h8M8 17h5",
  retrieval: "M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM21 21l-5-5M8 11h6",
  data: "M12 3c4.4 0 8 1.3 8 3s-3.6 3-8 3-8-1.3-8-3 3.6-3 8-3zM4 6v12c0 1.7 3.6 3 8 3s8-1.3 8-3V6M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3",
  api: "M8 9l-4 3 4 3M16 9l4 3-4 3M14 5l-4 14",
  toolkit: "M3 7h18v12H3zM8 7V5h8v2M3 12h18",
  terminal: "M4 17l6-6-6-6M12 19h8",
} as const;

export default function Icon({ name }: { name: keyof typeof PATHS }) {
  return (
    <svg className="icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d={PATHS[name]} />
    </svg>
  );
}
