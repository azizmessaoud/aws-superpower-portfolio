/* Scroll reveals and parallax for everything below the first screen, on Framer Motion.
 * Why a library now: reveals are staggered and tied to the viewport; the first screen keeps its CSS intro and the canvas.
 * Rules this file keeps:
 *   - opacity and transform only (nothing that moves layout);
 *   - reduced motion renders plain elements with no animation at all;
 *   - LazyMotion with domAnimation, so only the small feature set ships;
 *   - each element animates once, then stays put. */
import { createElement, useRef, type CSSProperties, type ElementType, type ReactNode } from "react";
import { LazyMotion, domAnimation, m, useReducedMotion, useScroll, useTransform } from "framer-motion";

const EASE = [0.16, 1, 0.3, 1] as const;

export function MotionRoot({ children }: { children: ReactNode }) {
  return <LazyMotion features={domAnimation} strict>{children}</LazyMotion>;
}

/** Spread onto an `m.*` element: `<m.li {...useReveal()(i)} />`. Returns `{}` when the visitor prefers reduced motion. */
export function useReveal() {
  const reduced = useReducedMotion();
  return (index = 0, rise = 18) => reduced ? {} : {
    initial: { opacity: 0, y: rise },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true, margin: "0px 0px -8% 0px" },
    transition: { duration: 0.6, ease: EASE, delay: Math.min(index, 6) * 0.06 },
  };
}

interface RevealProps { children: ReactNode; className?: string; index?: number; as?: "div" | "li" | "section" | "header"; rise?: number }
/** Fades and lifts its children into view once. */
export function Reveal({ children, className, index = 0, as = "div", rise }: RevealProps) {
  const reveal = useReveal();
  const Tag = m[as];
  return <Tag className={className} {...reveal(index, rise)}>{children}</Tag>;
}

/** A slow vertical drift while the element crosses the screen: ±`range` px, so it reads as depth, not movement. */
export function Parallax({ children, className, range = 14, as = "div" }: { children: ReactNode; className?: string; range?: number; as?: ElementType }) {
  const reduced = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const y = useTransform(scrollYProgress, [0, 1], [range, -range]);
  if (reduced) return createElement(as, { className }, children);
  const style: CSSProperties = {};
  return <m.div ref={ref} className={className} style={{ ...style, y }}>{children}</m.div>;
}
