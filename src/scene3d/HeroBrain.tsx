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
import { useEffect, useMemo, useRef } from "react";
import { BufferAttribute, BufferGeometry, Group, PerspectiveCamera, Scene as ThreeScene, WebGLRenderer } from "three";
import type { Scene as HeroScene } from "../scene/scene";
import type { MindState } from "../mind/state";
import { loadBrain } from "./brainAsset";
import { chooseTier, isSoftwareRenderer } from "./capability";
import { createGovernor } from "./governor";
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
  /* One canvas per run of the effect below: its teardown force-loses the GPU context, and a lost context stays lost on the same element, so a
   * second run on it (the 2D scene is replaced right after reduced motion is switched) would find a dead renderer and drop to the 2D hero.
   * The key changes exactly when the effect's inputs change, so every run gets a fresh element. */
  const generation = useRef(0);
  const canvasKey = useMemo(() => ++generation.current, [scene, reduced]); // eslint-disable-line react-hooks/exhaustive-deps
  const mindRef = useRef(mind);
  const flash = useRef(0);
  const tip = useRef<HTMLDivElement>(null);
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
      /* ?gov=off (the tests) turns the governor and this check off together */
      const governorOn = new URLSearchParams(location.search).get("gov") !== "off";
      if (governorOn) {
        const gl = renderer.getContext(), info = gl.getExtension("WEBGL_debug_renderer_info");
        const gpu = info ? String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL)) : "";
        if (isSoftwareRenderer(gpu)) { fail(`software renderer: ${gpu}`); return; } /* no GPU acceleration: the 2D hero, at once, not after seconds of a stalled page */
      }
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
      /* 1.25 at most: the strands are thin light on a dark ground, so the extra pixels of a 1.75 canvas (3x the fill of 1.0) cost far more than they show */
      let dpr = Math.min(window.devicePixelRatio || 1, 1.25);
      let curS = 0, clock = 0, last = 0, t0 = 0, frames = 0, level = 0, degraded = false, drawn = false;
      const governor = createGovernor();
      /* the pointer, relative to the brain itself: where it is (x, y, -1..1), and how close (near, 0..1). Springs, so the motion is the same at any frame rate. */
      const pointer = { x: 0, y: 0, tx: 0, ty: 0, near: 0, tnear: 0, hold: 0 };
      /* grab and turn: a press on the brain starts a drag that follows the hand, keeps its momentum when let go, and eases back to rest by itself */
      const drag = { on: false, yaw: 0, pitch: 0, vy: 0, vp: 0, id: -1, lx: 0, ly: 0, lt: 0, moved: 0, t0: 0 };
      /* a click on the brain makes it fire: many pulses racing along the fibres, easing off over about two seconds */
      const burst = { v: 0, count: 0 }; const tap = { id: -1, x: 0, y: 0, t: 0 };
      const YAW_MAX = 1.15, PITCH_MAX = 0.5;

      const draw =(time: number, dt = 0.016, reveal = 1) => {
        const target = MOODS[mindRef.current], k = 1 - Math.exp(-dt * 4);
        flash.current *= Math.exp(-dt * 2.2);
        burst.v *= Math.exp(-dt * 1.5);
        mood.gain += (baseGain + target.gain + flash.current * 0.8 + pointer.near * 1.2 + burst.v * 1.1 - mood.gain) * k;
        mood.pulseOn += (target.pulseOn - mood.pulseOn) * k;
        mood.speed += (target.speed + pointer.near * 0.7 + burst.v * 2.2 - mood.speed) * k;
        mood.gap += (target.gap * (1 - 0.82 * burst.v) - mood.gap) * k;
        clock += dt * mood.speed;
        fib.setMood({ gain: mood.gain, pulseOn: mood.pulseOn, pulseSpeed: mood.speed, pulseGap: mood.gap });
        fib.setPulseClock(reduced ? STILL_TIME * 0.7 : clock);
        fib.setReveal(reveal);
        if (!degraded) parts.setAmount(reveal);
        /* slow sway and float; the brain turns a little toward the pointer (about 15 degrees at most) and leans in as it comes close: never a spin */
        const kp = 1 - Math.exp(-dt * 5.5);
        pointer.x += (pointer.tx - pointer.x) * kp; pointer.y += (pointer.ty - pointer.y) * kp; pointer.near += (pointer.tnear - pointer.near) * kp;
        pointer.hold += ((drag.on ? 1 : 0) - pointer.hold) * kp;                  /* the pointer-follow steps aside while you hold the brain */
        if (!drag.on) {
          drag.yaw += drag.vy * dt; drag.pitch += drag.vp * dt;                     /* momentum after letting go */
          const slow = Math.exp(-dt * 3.2); drag.vy *= slow; drag.vp *= slow;
          const home = Math.exp(-dt * 1.25); drag.yaw *= home; drag.pitch *= home;  /* and an easy return to rest */
        }
        drag.yaw = clamp(drag.yaw, -YAW_MAX, YAW_MAX); drag.pitch = clamp(drag.pitch, -PITCH_MAX, PITCH_MAX);
        group.rotation.y = reduced ? 0.08 : 0.14 * Math.sin(time * 0.17) + pointer.x * 0.26 * (1 - pointer.hold) + drag.yaw;
        group.rotation.x = reduced ? 0 : pointer.y * 0.13 * (1 - pointer.hold) + drag.pitch;
        group.scale.setScalar(reduced ? 1 : 1 + pointer.near * 0.05 + burst.v * 0.03);
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
          /* While the brain flies to the nav it is only moved by CSS (layout() above), so the last drawn picture is carried along and nothing is
           * redrawn: the flight costs no GPU time and stays smooth however slow the machine is. Drawing resumes when it lands or flies back. */
          const flight = scene.getHeroState().travel;
          if (drawn && !reduced && flight > 0.002 && flight < 0.998) { last = 0; raf = requestAnimationFrame(tick); return; }
          const seconds = last ? (now - last) / 1000 : 0;
          const dt = last ? Math.min(seconds, 0.1) : 0.016; last = now;
          draw(time, dt, reveal);
          sizeChanged = false;
          frames++;
          /* the governor: judge the real frame rate, step the quality down once, and give up if it is still slow */
          if (governorOn && seconds > 0) {
            const verdict = governor.feed(seconds);
            level = governor.level;
            if (verdict === "degrade") { degraded = true; dpr = 1; renderer.setPixelRatio(1); renderer.setSize(curS, curS, false); parts.setAmount(0); fib.setBeads(false); }
            else if (verdict === "fail") { fail("frames too slow"); return; }
          }
          raf = requestAnimationFrame(tick);
        } catch (e) { fail(`render: ${(e as Error).message}`); }
      };
      const wake = () => { if (!alive) return; if (reduced) { still(); return; } if (!raf && !document.hidden) raf = requestAnimationFrame(tick); };

      /* pointer position against the brain's own canvas (it moves and shrinks with the flight, so read it fresh) */
      const rel = (e: PointerEvent) => { const r = el.getBoundingClientRect(), half = Math.max(r.width, 1) / 2; return { dx: (e.clientX - (r.left + half)) / half, dy: (e.clientY - (r.top + r.height / 2)) / half }; };
      const root = document.documentElement;
      const grab = (v: "" | "over" | "drag") => { if ((root.dataset.brainGrab ?? "") !== v) { if (v) root.dataset.brainGrab = v; else delete root.dataset.brainGrab; } };
      const isControl = (e: PointerEvent) => !!(e.target as Element | null)?.closest?.("a, button, input, textarea, select, summary, label");
      /* on the brain, and not mid-flight (a drag only makes sense while it sits in the hero) */
      const overBrain = (e: PointerEvent) => { const { dx, dy } = rel(e); return Math.hypot(dx, dy) < 0.9 && scene.getHeroState().travel < 0.02; };
      /* what a click on the brain does: it fires, and the question box takes focus (on a phone it scrolls into view without raising the keyboard) */
      const activate = (touch: boolean) => {
        burst.v = 1; burst.count++; flash.current = 1.6; wake();
        const ask = document.getElementById("hero-ask") as HTMLInputElement | null;
        if (!ask) return;
        if (touch) ask.scrollIntoView({ block: "center", behavior: "smooth" });
        else ask.focus({ preventScroll: true });
      };
      const moveTip = (e: PointerEvent) => {
        const t = tip.current; if (!t) return;
        const w = t.offsetWidth || 160;
        t.style.transform = `translate3d(${Math.min(e.clientX + 16, innerWidth - w - 12).toFixed(0)}px, ${(e.clientY + 20).toFixed(0)}px, 0)`;
      };
      const onMove = (e: PointerEvent) => {
        if (e.pointerType === "touch") return;
        moveTip(e);
        if (drag.on && e.pointerId === drag.id) {
          drag.moved += Math.hypot(e.clientX - drag.lx, e.clientY - drag.ly);
          const dtm = Math.max(1, e.timeStamp - drag.lt) / 1000, ddx = (e.clientX - drag.lx) * 0.0085, ddy = (e.clientY - drag.ly) * 0.006;
          drag.yaw += ddx; drag.pitch += ddy;
          drag.vy = drag.vy * 0.6 + (ddx / dtm) * 0.4; drag.vp = drag.vp * 0.6 + (ddy / dtm) * 0.4;   /* a smoothed hand velocity, for the momentum */
          drag.lx = e.clientX; drag.ly = e.clientY; drag.lt = e.timeStamp; wake();
        } else grab(!isControl(e) && overBrain(e) ? "over" : "");
        const { dx, dy } = rel(e), d = Math.hypot(dx, dy);
        pointer.tx = clamp(dx / 2.2, -1, 1); pointer.ty = clamp(dy / 2.2, -1, 1);
        const t = clamp((d - 0.35) / 1.1, 0, 1); pointer.tnear = 1 - t * t * (3 - 2 * t); /* 1 on the brain, easing to 0 about 1.5 radii away */
      };
      /* a press or tap on the brain makes it flash once; presses on links, buttons and fields are left alone */
      const onDown = (e: PointerEvent) => {
        if ((e.target as Element | null)?.closest?.("a, button, input, textarea, select, summary, label")) return;
        const { dx, dy } = rel(e);
        if (Math.hypot(dx, dy) < 0.95) { flash.current = 1.9; wake(); }
        if (e.pointerType !== "touch" && e.button === 0 && overBrain(e)) {          /* touch keeps vertical swipes for scrolling the page */
          drag.on = true; drag.id = e.pointerId; drag.lx = e.clientX; drag.ly = e.clientY; drag.lt = e.timeStamp; drag.t0 = e.timeStamp; drag.moved = 0; drag.vy = 0; drag.vp = 0; grab("drag");
        } else if (e.pointerType === "touch" && Math.hypot(dx, dy) < 0.95) { tap.id = e.pointerId; tap.x = e.clientX; tap.y = e.clientY; tap.t = e.timeStamp; }
      };
      const onUp = (e: PointerEvent) => {
        if (tap.id === e.pointerId) {                                                /* a tap: a short press that did not travel */
          const isTap = e.type === "pointerup" && e.timeStamp - tap.t < 350 && Math.hypot(e.clientX - tap.x, e.clientY - tap.y) < 10; tap.id = -1;
          if (isTap && !isControl(e)) activate(true);
        }
        if (!drag.on || e.pointerId !== drag.id) return;
        const wasClick = e.type === "pointerup" && drag.moved < 5 && e.timeStamp - drag.t0 < 450;   /* a click, not a drag */
        drag.on = false; grab(!isControl(e) && overBrain(e) ? "over" : ""); if (wasClick) activate(false); wake();
      };
      const onBlur = () => { if (drag.on) { drag.on = false; grab(""); } };
      window.addEventListener("scroll", wake, { passive: true });
      window.addEventListener("resize", wake);
      document.addEventListener("visibilitychange", wake);
      if (!reduced) { window.addEventListener("pointermove", onMove, { passive: true }); window.addEventListener("pointerdown", onDown, { passive: true }); window.addEventListener("pointerup", onUp, { passive: true }); window.addEventListener("pointercancel", onUp, { passive: true }); window.addEventListener("blur", onBlur); }
      undo.push(() => { window.removeEventListener("pointerup", onUp); window.removeEventListener("pointercancel", onUp); window.removeEventListener("blur", onBlur); grab(""); window.removeEventListener("pointerdown", onDown); window.removeEventListener("scroll", wake); window.removeEventListener("resize", wake); document.removeEventListener("visibilitychange", wake); window.removeEventListener("pointermove", onMove); });
      refresh.current = wake;

      /* hooks for tests and for debugging: how many frames were drawn, and how much of the canvas is lit */
      (window as unknown as { __brain3d?: object }).__brain3d = {
        tier, get frames() { return frames; }, get level() { return level; }, get size() { return curS; },
        /** the brain's turn toward the pointer (radians) and how close the pointer is (0..1), so a test can check the reaction exactly instead of comparing frames */
        get pose() { return { yaw: group.rotation.y, pitch: group.rotation.x, near: pointer.near, scale: group.scale.x, dragYaw: drag.yaw, dragging: drag.on, burst: burst.v, clicks: burst.count }; },
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

  return (
    <>
      <canvas key={canvasKey} ref={canvas} className="brain3d" aria-hidden="true" />
      {/* a label that follows the pointer while it is over the brain, so the two things you can do with it are discoverable */}
      <div className="brain-tip" ref={tip} aria-hidden="true"><b>Click</b> to ask <i>·</i> <b>drag</b> to turn</div>
    </>
  );
}
