import { useEffect, useRef, useState } from "react";

/* The page's background: a slow close-up of a nerve network, graded to the site's palette (verdigris on graphite) and looped seamlessly
 * (public/page-bg.mp4 and .webm, about 230 kB each, plus a poster frame; rebuilt by scripts/make-page-video.sh). It is one fixed layer behind
 * every section (z-index -1, so it can never paint over text); the sections' own backgrounds are translucent graphite, which is what keeps
 * text readable over it (an e2e test measures every section across the whole loop). It is atmosphere, so it never costs anything that matters:
 *  - with reduced motion, Save-Data or reduced-data it is the still poster, not video, and no video bytes are fetched;
 *  - it plays only while the tab is visible;
 *  - if the video cannot play, the poster simply stays. */
const wantsStill = () => {
  const conn = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
  return !!conn?.saveData || matchMedia("(prefers-reduced-data: reduce)").matches;
};

export default function PageBackdrop({ reduced }: { reduced: boolean }) {
  const vid = useRef<HTMLVideoElement>(null);
  const [still] = useState(wantsStill);
  const [playing, setPlaying] = useState(false);
  const moving = !reduced && !still;

  useEffect(() => {
    const v = vid.current;
    if (!moving || !v) return;
    const sync = () => { if (!document.hidden) v.play().catch(() => { /* blocked or unsupported: the poster stays */ }); else v.pause(); };
    document.addEventListener("visibilitychange", sync);
    sync();
    return () => { document.removeEventListener("visibilitychange", sync); v.pause(); };
  }, [moving]);

  return (
    <div className="page-bg" aria-hidden="true" data-moving={moving ? "" : undefined}>
      <img className="page-bg-still" src="/page-bg-poster.jpg" alt="" width={480} height={832} decoding="async" fetchPriority="low" />
      {moving && (
        <video ref={vid} className={`page-bg-video${playing ? " is-playing" : ""}`} muted loop playsInline autoPlay preload="auto" poster="/page-bg-poster.jpg" tabIndex={-1} onPlaying={() => setPlaying(true)}>
          <source src="/page-bg.mp4" type='video/mp4; codecs="avc1.4D401F"' />
          <source src="/page-bg.webm" type='video/webm; codecs="vp9"' />
        </video>
      )}
    </div>
  );
}
