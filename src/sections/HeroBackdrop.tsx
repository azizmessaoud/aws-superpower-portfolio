import { useEffect, useRef, useState } from "react";

/* The hero's background: a slow close-up of a nerve network, graded to the site's palette (verdigris on graphite) and looped seamlessly
 * (public/hero-bg.mp4 and .webm, about 230 kB each, plus a poster frame). It is atmosphere, so it never costs anything that matters:
 *  - with reduced motion, Save-Data or reduced-data it is the still poster, not video, and no video bytes are fetched;
 *  - it plays only while the hero is on screen and the tab is visible;
 *  - if the video cannot play, the poster simply stays.
 * It sits on its own layer behind the 3D brain and the text, so it can never cover either. */
const wantsStill = () => {
  const conn = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
  return !!conn?.saveData || matchMedia("(prefers-reduced-data: reduce)").matches;
};

export default function HeroBackdrop({ reduced }: { reduced: boolean }) {
  const box = useRef<HTMLDivElement>(null);
  const vid = useRef<HTMLVideoElement>(null);
  const [still] = useState(wantsStill);
  const [playing, setPlaying] = useState(false);
  const moving = !reduced && !still;

  useEffect(() => {
    const v = vid.current, b = box.current;
    if (!moving || !v || !b) return;
    let visible = true;
    const sync = () => { if (visible && !document.hidden) v.play().catch(() => { /* blocked or unsupported: the poster stays */ }); else v.pause(); };
    const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; sync(); }, { threshold: 0 });
    io.observe(b);
    document.addEventListener("visibilitychange", sync);
    sync();
    return () => { io.disconnect(); document.removeEventListener("visibilitychange", sync); v.pause(); };
  }, [moving]);

  return (
    <div className="hero-bg" ref={box} aria-hidden="true" data-moving={moving ? "" : undefined}>
      <img className="hero-bg-still" src="/hero-bg-poster.jpg" alt="" width={480} height={832} decoding="async" fetchPriority="low" />
      {moving && (
        <video ref={vid} className={`hero-bg-video${playing ? " is-playing" : ""}`} muted loop playsInline autoPlay preload="auto" poster="/hero-bg-poster.jpg" tabIndex={-1} onPlaying={() => setPlaying(true)}>
          <source src="/hero-bg.mp4" type='video/mp4; codecs="avc1.4D401F"' />
          <source src="/hero-bg.webm" type='video/webm; codecs="vp9"' />
        </video>
      )}
    </div>
  );
}
