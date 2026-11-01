/* The hero's brain: a network of light in WebGL, drawn on its own canvas below the hero text.
 *
 *  - It follows the 2D scene's choreography instead of inventing its own: scroll progress, the eased flight to the nav, the dock
 *    position all come from `scene.getHeroState()`. The canvas is moved with a CSS transform (cheap, no re-render), and at the
 *    end of the flight it fades while the 2D scene fades its small docked brain in at the same spot.
 *  - It never draws over the words: placement puts it in the free area, and the canvas sits below the text in z-order.
 *  - It renders only while the hero is on screen, the tab is visible, and not docked. Otherwise the loop is stopped.
 *  - Reduced motion: stills only, no loop (re-drawn on resize or when the question state changes).
 *  - If anything fails (no WebGL, the file, a lost context, or frames too slow even after stepping down), it calls onFail and
 *    the page keeps the 2D hero. The page is complete without it. */
import { useEffect, useRef } from "react";
import { BufferAttribute, BufferGeometry, Group, PerspectiveCamera, Scene as ThreeScene, WebGLRenderer } from "three";
import type { Scene as HeroScene } from "../scene/scene";
import type { MindState } from "../mind/state";
import { loadBrain } from "./brainAsset";
import { chooseTier } from "./capability";
import { createFiberLayers, createGhostBody, createParticles } from "./layers";
import { CANVAS_PER_R, heroTransform, placeBrain } from "./placement";
import fullUrl from "./assets/brain-full.brain?url";
import mobileUrl from "./assets/brain-mobile.brain?url";

interface Props { scene: HeroScene | null; reduced: boolean; mind: MindState; onFail: (why: string) => void }

const FOV = 26, REVEAL_SECONDS = 2.6, STILL_TIME = 3.0;
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const easeInOut = (t: number) => t * t * (3 - 2 * t);

/* How the network looks for each state of the question lifecycle: brightness added, how fast and how often light travels.
 * A mood, not a meaning: it says what the page is doing, never what a model "thinks". The text status line is the primary signal. */
const MOODS: Record<MindState, { gain: number; pulseOn: number; speed: number; gap: number }> = {
  idle: { gain: 0, pulseOn: 1, speed: 0.7, gap: 5 },
  listening: { gain: 0.25, pulseOn: 1, speed: 0.7, gap: 4 },
  retrieving: { gain: 0.5, pulseOn: 1, speed: 1.2, gap: 2.2 },
  answering: { gain: 0.3, pulseOn: 1, speed: 0.9, gap: 3.5 },
  uncertain: { gain: -0.35, pulseOn: 0.25, speed: 0.5, gap: 7 },
  error: { gain: -0.5, pulseOn: 0, speed: 0.5, gap: 8 },
};

export default function HeroBrain({ scene, reduced, mind, onFail }: Props) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const mindRef = useRef(mind);
  const flash = useRef(0);
  const refresh = useRef<(() => void) | null>(null);
  useEffect(() => {
    if (mind === "answering" && mindRef.current !== "answering") flash.current = 1; /* one soft bloom when an answer arrives */
    mindRef.current = mind;
    refresh.current?.();
  }, [mind]);

  useEffect(() => {
    const el = canvas.current;
    if (!el || !scene) return;
    let alive = true, raf = 0;
    const abort = new AbortController();
    const undo: Array<() => void> = [];
    const teardown = () => { alive = false; if (raf) cancelAnimationFrame(raf); raf = 0; abort.abort(); undo.splice(0).reverse().forEach((f) => { try { f(); } catch { /* disposing twice is fine */ } }); el.style.opacity = "0"; el.style.visibility = "hidden"; };
    const fail = (why: string) => { if (!alive) return; teardown(); document.documentElement.dataset.brain = "canvas"; refresh.current = null; onFail(why); };
    refresh.current = null;

    (async () => {
      const tier = chooseTier();
      document.documentElement.dataset.brainTier = tier;
      let renderer: WebGLRenderer;
      try { renderer = new WebGLRenderer({ canvas: el, alpha: true, antialias: false, powerPreference: "high-performance" }); }
      catch { fail("no WebGL"); return; }
      undo.push(() => { renderer.dispose(); renderer.forceContextLoss(); }); /* hand the GPU context back at once */
      renderer.setClearColor(0x000000, 0);
      const onLost = (e: Event) => { e.preventDefault(); fail("WebGL context lost"); };
      el.addEventListener("webglcontextlost", onLost);
      undo.push(() => el.removeEventListener("webglcontextlost", onLost));

      let brain: Awaited<ReturnType<typeof loadBrain>>;
      try { brain = await loadBrain(tier === "mobile" ? mobileUrl : fullUrl, abort.signal); }
      catch (e) { if (alive) fail(`asset: ${(e as Error).message}`); return; }
      if (!alive) return;

      /* the scene: an invisible body that hides the far side, the fibre network, and a restrained scatter of particles */
      const geo = new BufferGeometry();
      geo.setAttribute("position", new BufferAttribute(brain.positions, 3));
      geo.setIndex(new BufferAttribute(brain.index, 1));
      geo.computeVertexNormals();
      const ghost = createGhostBody(geo, 0.1);
      const fib = createFiberLayers(brain.fibers, {});
      const parts = createParticles(brain.positions, (geo.getAttribute("normal") as BufferAttribute).array as Float32Array, tier === "mobile" ? 500 : 1100);
      const group = new Group();
      group.add(...ghost.objects, fib.ribbons, fib.nodes, fib.tips, parts.points);
      const three = new ThreeScene();
      three.add(group);
      const camera = new PerspectiveCamera(FOV, 1, 0.1, 50);
      const AZ = (20 * Math.PI) / 180, DIST = 4.05;
      camera.position.set(Math.cos(AZ) * DIST, -0.18, Math.sin(AZ) * DIST);
      camera.lookAt(0, -0.1, 0.02);
      undo.push(() => { geo.dispose(); ghost.dispose(); fib.dispose(); parts.dispose(); });

      const baseGain = tier === "mobile" ? 2.5 : 1.7;
      const mood = { gain: baseGain, pulseOn: 1, speed: 0.7, gap: 5 };
      let dpr = Math.min(window.devicePixelRatio || 1, tier === "mobile" ? 1.5 : 1.75);
      let curS = 0, clock = 0, last = 0, t0 = 0, frames = 0, level = 0, degraded = false, drawn = false;
      const dts: number[] = [];
      const pointer = { x: 0, y: 0, tx: 0, ty: 0 };
      const governorOn = new URLSearchParams(location.search).get("gov") !== "off";

      const draw = (time: number, dt = 0.016, reveal = 1) => {
        const target = MOODS[mindRef.current], k = 1 - Math.exp(-dt * 4);
        flash.current *= Math.exp(-dt * 2.2);
        mood.gain += (baseGain + target.gain + flash.current * 0.8 - mood.gain) * k;
        mood.pulseOn += (target.pulseOn - mood.pulseOn) * k;
        mood.speed += (target.speed - mood.speed) * k;
        mood.gap += (target.gap - mood.gap) * k;
        clock += dt * mood.speed;
        fib.setMood({ gain: mood.gain, pulseOn: mood.pulseOn, pulseSpeed: mood.speed, pulseGap: mood.gap });
        fib.setPulseClock(reduced ? STILL_TIME * 0.7 : clock);
        fib.setReveal(reveal);
        if (!degraded) parts.setAmount(reveal);
        /* slow sway and float, and a gentle pointer parallax: never a spin */
        pointer.x += (pointer.tx - pointer.x) * 0.05; pointer.y += (pointer.ty - pointer.y) * 0.05;
        group.rotation.y = reduced ? 0.08 : 0.14 * Math.sin(time * 0.17) + pointer.x * 0.07;
        group.rotation.x = reduced ? 0 : pointer.y * 0.04;
        group.position.y = reduced ? 0 : 0.012 * Math.sin(time * 0.6);
        fib.update(time, curS, curS, FOV, renderer.getPixelRatio());
        parts.update(time, curS, FOV, renderer.getPixelRatio());
        renderer.render(three, camera);
        drawn = true;
      };

      /* place the canvas for the current scroll/flight state; returns whether it should be drawing */
      let sizeChanged = false;
      const layout = (entrance: number): boolean => {
        const st = scene.getHeroState();
        const place = placeBrain(st.W, Math.min(st.stageH, st.H), st.text);
        const S = Math.max(120, Math.round(place.R * CANVAS_PER_R));
        if (Math.abs(S - curS) > 3) {
          curS = S; renderer.setPixelRatio(dpr); renderer.setSize(S, S, false);
          el.style.width = `${S}px`; el.style.height = `${S}px`; sizeChanged = true;
        }
        const t = heroTransform({ place, S, stageTop: st.stageTop, stageH: st.stageH, H: st.H, progress: st.progress, dockAt: st.dockAt, flight: reduced ? 0 : st.travel, entrance, dock: st.dock, reduced });
        /* whether to draw is about the hero being on screen, not about the entrance fade (which starts at 0) */
        const visible = t.away > 0.01 && st.stageTop + st.stageH > -S && !st.docked;
        const x = t.x, y = t.y, sc = t.scale, opacity = t.opacity;
        el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) scale(${sc.toFixed(4)})`;
        el.style.opacity = opacity.toFixed(3);
        el.style.visibility = visible ? "visible" : "hidden";
        return visible;
      };

      const still = () => { if (!alive) return; const vis = layout(1); if (vis && (sizeChanged || !drawn)) { draw(STILL_TIME, 0.016, 1); sizeChanged = false; } else if (vis) draw(STILL_TIME, 0.016, 1); };

      const tick = (now: number) => {
        raf = 0;
        if (!alive || document.hidden) return;
        try {
          if (!t0) t0 = now;
          const time = (now - t0) / 1000;
          const reveal = easeInOut(clamp((time - 0.15) / REVEAL_SECONDS, 0, 1));
          if (!layout(reveal)) { last = 0; return; } /* off screen or docked: park; a scroll wakes it */
          const dt = last ? Math.min((now - last) / 1000, 0.1) : 0.016; last = now;
          draw(time, dt, reveal);
          sizeChanged = false;
          frames++;
          /* the governor: judge the frame rate after the first frames, step the quality down once, and give up if it is still slow */
          if (governorOn && frames > 30 && level < 2) {
            dts.push(dt);
            if (dts.length >= 90) {
              const med = [...dts].sort((a, b) => a - b)[dts.length >> 1]!; dts.length = 0;
              if (level === 0 && med > 0.032) { level = 1; degraded = true; dpr = 1; renderer.setPixelRatio(1); renderer.setSize(curS, curS, false); parts.setAmount(0); fib.setBeads(false); }
              else if (level === 1 && med > 0.055) { fail("frames too slow"); return; }
              else level = 2;
            }
          }
          raf = requestAnimationFrame(tick);
        } catch (e) { fail(`render: ${(e as Error).message}`); }
      };
      const wake = () => { if (!alive) return; if (reduced) { still(); return; } if (!raf && !document.hidden) raf = requestAnimationFrame(tick); };

      const onMove = (e: PointerEvent) => { if (e.pointerType === "touch") return; pointer.tx = (e.clientX / innerWidth - 0.5) * 2; pointer.ty = (e.clientY / innerHeight - 0.5) * 2; };
      window.addEventListener("scroll", wake, { passive: true });
      window.addEventListener("resize", wake);
      document.addEventListener("visibilitychange", wake);
      if (!reduced) window.addEventListener("pointermove", onMove, { passive: true });
      undo.push(() => { window.removeEventListener("scroll", wake); window.removeEventListener("resize", wake); document.removeEventListener("visibilitychange", wake); window.removeEventListener("pointermove", onMove); });
      refresh.current = wake;

      /* hooks for tests and for debugging: how many frames were drawn, and how much of the canvas is lit */
      (window as unknown as { __brain3d?: object }).__brain3d = {
        tier, get frames() { return frames; }, get level() { return level; }, get size() { return curS; },
        litPixels() {
          draw(STILL_TIME, 0.016, 1);
          const gl = renderer.getContext(), w = gl.drawingBufferWidth, h = gl.drawingBufferHeight, buf = new Uint8Array(w * h * 4);
          gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, buf);
          let n = 0; for (let i = 3; i < buf.length; i += 4) if (buf[i]! > 8) n++;
          return { lit: n, total: w * h };
        },
      };
      document.documentElement.dataset.brain = "webgl";
      wake();
    })();

    return () => { teardown(); refresh.current = null; };
  }, [scene, reduced, onFail]);

  return <canvas ref={canvas} className="brain3d" aria-hidden="true" />;
}
