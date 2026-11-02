import { useEffect, useRef, useState } from "react";

/* True once the element has scrolled into view (and stays true). The data pictures on the cards use it to play once, when you reach them,
 * so the motion shows the result at the moment you are looking at it. Without IntersectionObserver the final state is simply shown. */
export function useInView<T extends Element>(threshold = 0.4) {
  const ref = useRef<T>(null);
  const [seen, setSeen] = useState(() => typeof IntersectionObserver === "undefined");
  useEffect(() => {
    const el = ref.current;
    if (!el || seen) return;
    const io = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) { setSeen(true); io.disconnect(); } }, { threshold });
    io.observe(el);
    return () => io.disconnect();
  }, [seen, threshold]);
  return [ref, seen] as const;
}
