/* The luminous layers drawn over the bare sculpture: fibres, pulses, branch nodes, then a restrained scatter of particles.
 * Every layer is additive light that sits on or just above the surface and is depth-tested against it, so the sculpture
 * stays visible and the far side of the brain stays hidden behind the near side. */
import {
  AddEquation, BufferAttribute, BufferGeometry, CustomBlending, DoubleSide, Mesh, MeshBasicMaterial, OneFactor, Points,
  ShaderMaterial, Vector2, Vector3, type Object3D,
} from "three";
import { mulberry32 } from "../scene/rng";
import { childCounts, type FiberNetwork } from "./fibers";

/* palette: the site's electric blue and violet, with a little ice-white */
/* the clip's colours: the cyan-blue accent, pale ice, and the clip's indigo where a fibre starts: indigo at the root, cyan-blue at the tips, so colour shows the direction of flow */
const COOL = "vec3(0.200, 0.573, 0.922)", COOL_LIGHT = "vec3(0.435, 0.710, 0.965)", WARM = "vec3(0.467, 0.529, 0.933)", ICE = "vec3(0.902, 0.933, 0.969)";

/* Light adds to what is behind it. On a transparent canvas that means premultiplied output (colour, plus an alpha equal to its
 * brightest channel) and One/One blending, so the page shows through everywhere the network is dark and nothing paints black. */
const ADD = { blending: CustomBlending, blendEquation: AddEquation, blendSrc: OneFactor, blendDst: OneFactor, blendEquationAlpha: AddEquation, blendSrcAlpha: OneFactor, blendDstAlpha: OneFactor } as const;
const EMIT_GLSL = /* glsl */ `vec4 emit(vec3 c) { return vec4(c, max(c.r, max(c.g, c.b))); }`;

/* One shared description of the pulses, so ribbons and nodes light up together. */
const PULSE_GLSL = /* glsl */ `
uniform float uTime;
uniform float uReveal;   /* 0..1: how far the network has grown out from its roots (the entrance) */
uniform float uMaxDist;
float grown(float dist) { float front = uReveal * (uMaxDist + 0.5); return smoothstep(front, front - 0.22, dist); }
float growFront(float dist) { float front = uReveal * (uMaxDist + 0.5); return uReveal < 0.999 ? exp(-pow((dist - front) / 0.1, 2.0)) : 0.0; }
uniform float uPulseOn;
uniform float uPulseClock; /* integrated on the CPU, so a change of speed never makes a pulse jump */
uniform float uPulseSpeed;
uniform float uPulseGap;
uniform float uPulseLen[8];
uniform float uPulsePhase[8];
float pulseAt(float mask, float dist) {
  float p = 0.0;
  for (int k = 0; k < 8; k++) {
    float member = mod(floor(mask / exp2(float(k)) + 0.01), 2.0);
    if (member < 0.5 || uPulseLen[k] <= 0.0) continue;
    float cycle = uPulseLen[k] + uPulseGap;
    float head = mod(uPulseClock + uPulsePhase[k] * cycle, cycle);
    float d = head - dist;                       /* > 0: behind the head */
    p += d < 0.0 ? exp(-pow(d / 0.03, 2.0)) : exp(-d / 0.2);
  }
  return min(p, 1.6) * uPulseOn;
}`;

export interface LayerOptions {
  /** pulses travelling at once are limited by the gap: a longer gap means fewer */
  pulseSpeed?: number;
  pulseGap?: number;
  particles?: number;
}

interface Shared { uniforms: Record<string, { value: unknown }> }

function pulseUniforms(f: FiberNetwork, o: LayerOptions) {
  const phase = new Float32Array(8);
  const rand = mulberry32(99);
  for (let k = 0; k < 8; k++) phase[k] = (k * 0.618034 + rand() * 0.2) % 1; /* spread the pulses out in time */
  return {
    uTime: { value: 0 }, uPulseClock: { value: 0 }, uPulseOn: { value: 1 }, uPulseSpeed: { value: o.pulseSpeed ?? 0.7 }, uPulseGap: { value: o.pulseGap ?? 5 },
    uPulseLen: { value: Array.from(f.pulseLen) }, uPulsePhase: { value: Array.from(phase) },
  };
}

/** Thick-to-thin fibres as camera-facing ribbons, and branch nodes as soft points. */
export function createFiberLayers(f: FiberNetwork, o: LayerOptions = {}) {
  const N = f.parent.length;
  let M = 0;
  for (let i = 0; i < N; i++) if (f.parent[i]! >= 0) M++;
  const pos = new Float32Array(M * 4 * 3), other = new Float32Array(M * 4 * 3);
  const end = new Float32Array(M * 4), side = new Float32Array(M * 4), flow = new Float32Array(M * 4), dist = new Float32Array(M * 4), mask = new Float32Array(M * 4);
  const index = new Uint32Array(M * 6);
  let s = 0;
  for (let i = 0; i < N; i++) {
    const p = f.parent[i]!;
    if (p < 0) continue;
    const ends = [i, i, p, p] as const, others = [p, p, i, i] as const, sd = [-1, 1, -1, 1] as const;
    for (let c = 0; c < 4; c++) {
      const v = s * 4 + c, a = ends[c], b = others[c];
      pos.set([f.pos[a * 3]!, f.pos[a * 3 + 1]!, f.pos[a * 3 + 2]!], v * 3);
      other.set([f.pos[b * 3]!, f.pos[b * 3 + 1]!, f.pos[b * 3 + 2]!], v * 3);
      side[v] = sd[c]; end[v] = c < 2 ? 0 : 1; flow[v] = f.flow[a]!; dist[v] = f.dist[a]!; mask[v] = f.mask[i]!; /* a segment belongs to a pulse path if its child does */
    }
    index.set([s * 4, s * 4 + 1, s * 4 + 2, s * 4 + 1, s * 4 + 3, s * 4 + 2], s * 6);
    s++;
  }
  const g = new BufferGeometry();
  g.setAttribute("position", new BufferAttribute(pos, 3));
  g.setAttribute("aOther", new BufferAttribute(other, 3));
  g.setAttribute("aSide", new BufferAttribute(side, 1));
  g.setAttribute("aEnd", new BufferAttribute(end, 1));
  g.setAttribute("aFlow", new BufferAttribute(flow, 1));
  g.setAttribute("aDist", new BufferAttribute(dist, 1));
  g.setAttribute("aMask", new BufferAttribute(mask, 1));
  g.setIndex(new BufferAttribute(index, 1));

  let maxDist = 0;
  for (let i = 0; i < N; i++) maxDist = Math.max(maxDist, f.dist[i]!);
  const shared = {
    ...pulseUniforms(f, o), uRes: { value: new Vector2(1280, 720) }, uPx: { value: 800 }, uMinPx: { value: 1.1 }, uWMin: { value: 0.0016 }, uWMax: { value: 0.0135 },
    uCenter: { value: new Vector3(0, 0.03, -0.02) }, uMaxDist: { value: maxDist }, uDpr: { value: 1 }, uBeads: { value: 1 }, uGain: { value: 1.7 }, uReveal: { value: 1 },
  };
  const ribbon = new ShaderMaterial({
    uniforms: shared, transparent: true, depthWrite: false, side: DoubleSide, ...ADD, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
    vertexShader: /* glsl */ `
      uniform vec2 uRes; uniform float uPx, uMinPx, uWMin, uWMax, uDpr; uniform vec3 uCenter;
      attribute vec3 aOther; attribute float aSide, aEnd, aFlow, aDist, aMask;
      varying float vSide, vFlow, vDist, vMask, vWpx, vFres;
      void main() {
        vec4 a = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        vec4 b = projectionMatrix * modelViewMatrix * vec4(aOther, 1.0);
        vec2 d = (b.xy / b.w - a.xy / a.w) * uRes * 0.5;
        float l = length(d);
        vec2 dir = l > 1e-4 ? d / l : vec2(1.0, 0.0);
        float wWorld = uWMin + (uWMax - uWMin) * pow(aFlow, 0.3);
        float wPx = max(uMinPx, wWorld * uPx / a.w);
        float quad = wPx * 2.6; /* the quad is wider than the strand: the extra is the soft halo */
        /* dir points at the other end, so it is reversed at the parent end: flip the sideways sign there, or the ribbon twists into a bow-tie */
        float sgn = aEnd > 0.5 ? -1.0 : 1.0;
        vec2 off = vec2(-dir.y, dir.x) * aSide * sgn * quad * 0.5 - dir * wPx * 0.22; /* sideways, plus a little past the end so joints close without doubling up */
        gl_Position = a;
        gl_Position.xy += off / (uRes * 0.5) * a.w;
        vSide = aSide; vFlow = aFlow; vDist = aDist; vMask = aMask; vWpx = wPx / uDpr;
        /* a stand-in surface normal (outward from the middle of the brain) brightens strands near the silhouette */
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vFres = pow(1.0 - abs(dot(normalize(normalMatrix * normalize(position - uCenter)), normalize(-mv.xyz))), 2.0);
      }`,
    fragmentShader: /* glsl */ `
      ${PULSE_GLSL}
      uniform float uBeads, uGain;
      varying float vSide, vFlow, vDist, vMask, vWpx, vFres;
      ${EMIT_GLSL}
      void main() {
        float cv = vSide * 2.6;                          /* across the strand itself: -1..1 inside the core */
        float core = smoothstep(1.0, 0.2, abs(cv));
        float halo = exp(-vSide * vSide * 3.4) * 0.22;   /* soft light around it */
        float strength = pow(vFlow, 0.5);
        /* a thick bundle is drawn as parallel strands with dark gaps: a cable, not a fat line */
        float strands = 1.0;
        if (vWpx > 2.6) {
          float n = clamp(floor(vWpx / 1.7), 2.0, 6.0);
          strands = 0.25 + 0.75 * pow(abs(cos(clamp(cv, -1.0, 1.0) * 1.5708 * n)), 1.6);
        }
        float t = clamp(vDist / uMaxDist, 0.0, 1.0);
        /* violet at the root, electric blue through the middle, a little ice towards the tips */
        vec3 base = mix(${WARM}, ${COOL_LIGHT}, smoothstep(0.0, 0.55, t));
        base = mix(base, ${ICE}, smoothstep(0.65, 1.0, t) * 0.4);
        float edge = 0.55 + 0.95 * vFres;
        float a = (0.3 + 0.6 * strength) * (core * strands + halo * (0.5 + strength)) * edge * uGain;
        /* faint beads of light drifting outward along every strand, so the whole network is alive between pulses */
        float beads = pow(0.5 + 0.5 * sin(vDist * 17.0 - uTime * 1.35), 10.0) * (0.5 + 0.5 * sin(vDist * 2.3 + vMask * 0.37)) * uBeads;
        float p = pulseAt(vMask, vDist);
        float g = grown(vDist);
        vec3 col = (base * a * (1.0 + 1.1 * beads) + mix(${COOL}, ${ICE}, 0.7) * p * (core + 0.9 * halo * 3.0) * 1.7) * g;
        col += ${ICE} * growFront(vDist) * (core + halo * 2.0) * 1.2; /* a bright head where the network is growing */
        gl_FragColor = emit(col);
      }`,
  });
  const mesh = new Mesh(g, ribbon);
  mesh.frustumCulled = false;

  /* luminous nodes: where fibres fork, and nowhere else */
  const kids = childCounts(f.parent);
  const nodeIdx: number[] = [];
  for (let i = 0; i < N; i++) if (kids[i]! >= 2) nodeIdx.push(i);
  const np = new Float32Array(nodeIdx.length * 3), nf = new Float32Array(nodeIdx.length), nd = new Float32Array(nodeIdx.length), nm = new Float32Array(nodeIdx.length);
  nodeIdx.forEach((i, k) => { np.set([f.pos[i * 3]!, f.pos[i * 3 + 1]!, f.pos[i * 3 + 2]!], k * 3); nf[k] = f.flow[i]!; nd[k] = f.dist[i]!; nm[k] = f.mask[i]!; });
  const ng = new BufferGeometry();
  ng.setAttribute("position", new BufferAttribute(np, 3));
  ng.setAttribute("aFlow", new BufferAttribute(nf, 1));
  ng.setAttribute("aDist", new BufferAttribute(nd, 1));
  ng.setAttribute("aMask", new BufferAttribute(nm, 1));
  const nodeMat = new ShaderMaterial({
    uniforms: { ...shared, uNodeOn: { value: 1 } }, transparent: true, depthWrite: false, ...ADD,
    vertexShader: /* glsl */ `
      uniform float uPx; attribute float aFlow, aDist, aMask; varying float vFlow, vDist, vMask;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = clamp((0.006 + 0.014 * pow(aFlow, 0.5)) * uPx / -mv.z, 2.0, 16.0);
        vFlow = aFlow; vDist = aDist; vMask = aMask;
      }`,
    fragmentShader: /* glsl */ `
      ${PULSE_GLSL}
      uniform float uNodeOn; varying float vFlow, vDist, vMask;
      ${EMIT_GLSL}
      void main() {
        float r = length(gl_PointCoord - 0.5) * 2.0;
        if (r > 1.0) discard;
        float glow = exp(-r * r * 3.2);
        float p = pulseAt(vMask, vDist);
        vec3 col = mix(${COOL_LIGHT}, ${ICE}, 0.35) * glow * (0.3 + 0.35 * pow(vFlow, 0.4)) + ${ICE} * p * glow;
        gl_FragColor = emit(col * uNodeOn * grown(vDist));
      }`,
  });
  const nodes = new Points(ng, nodeMat);
  nodes.frustumCulled = false;

  /* fibre tips: where a strand ends it glows, like the ends of a fibre-optic lamp */
  const tipIdx: number[] = [];
  for (let i = 0; i < N; i++) if (kids[i]! === 0 && f.parent[i]! >= 0) tipIdx.push(i);
  const tp = new Float32Array(tipIdx.length * 3), ts = new Float32Array(tipIdx.length), td = new Float32Array(tipIdx.length), tm = new Float32Array(tipIdx.length);
  tipIdx.forEach((i, k) => { tp.set([f.pos[i * 3]!, f.pos[i * 3 + 1]!, f.pos[i * 3 + 2]!], k * 3); ts[k] = ((i * 2654435761) >>> 0) / 4294967296; td[k] = f.dist[i]!; tm[k] = f.mask[i]!; });
  const tg = new BufferGeometry();
  tg.setAttribute("position", new BufferAttribute(tp, 3));
  tg.setAttribute("aSeed", new BufferAttribute(ts, 1));
  tg.setAttribute("aDist", new BufferAttribute(td, 1));
  tg.setAttribute("aMask", new BufferAttribute(tm, 1));
  const tipMat = new ShaderMaterial({
    uniforms: { ...shared, uTipOn: { value: 1 } }, transparent: true, depthWrite: false, ...ADD,
    vertexShader: /* glsl */ `
      uniform float uPx, uTime; uniform vec3 uCenter; attribute float aSeed, aDist, aMask;
      varying float vSeed, vDist, vMask, vFres;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = clamp((0.009 + 0.007 * aSeed) * uPx / -mv.z, 3.0, 11.0);
        vFres = pow(1.0 - abs(dot(normalize(normalMatrix * normalize(position - uCenter)), normalize(-mv.xyz))), 2.0);
        vSeed = aSeed; vDist = aDist; vMask = aMask;
      }`,
    fragmentShader: /* glsl */ `
      ${PULSE_GLSL}
      uniform float uTipOn; varying float vSeed, vDist, vMask, vFres;
      ${EMIT_GLSL}
      void main() {
        float r = length(gl_PointCoord - 0.5) * 2.0;
        if (r > 1.0) discard;
        float twinkle = 0.55 + 0.45 * sin(uTime * (0.9 + vSeed) + vSeed * 60.0);
        float glow = exp(-r * r * 3.0);
        float p = pulseAt(vMask, vDist);
        vec3 col = mix(${COOL_LIGHT}, ${ICE}, 0.55) * glow * twinkle * (0.75 + 1.0 * vFres) + ${ICE} * p * glow * 1.8;
        gl_FragColor = emit(col * uTipOn * grown(vDist));
      }`,
  });
  const tips = new Points(tg, tipMat);
  tips.frustumCulled = false;

  const all = [ribbon, nodeMat, tipMat];
  let manualClock = false;
  return {
    ribbons: mesh as Object3D, nodes: nodes as Object3D, tips: tips as Object3D, segments: M, branchNodes: nodeIdx.length, tipCount: tipIdx.length,
    setPulses(on: boolean) { all.forEach((m) => { (m.uniforms.uPulseOn as { value: number }).value = on ? 1 : 0; }); },
    /** a sparser, thinner network (the mobile tier) needs more light per strand to carry the same form */
    setGain(g: number) { (ribbon.uniforms.uGain as { value: number }).value = g; },
    /** 0..1: the entrance. The network grows outward from the brainstem as this rises. */
    setReveal(v: number) { (shared.uReveal as { value: number }).value = v; },
    /** the question lifecycle's mood: brightness, and how often pulses travel (a shorter gap means more of them at once) */
    setMood(m: { gain?: number; pulseOn?: number; pulseSpeed?: number; pulseGap?: number }) {
      if (m.gain !== undefined) (shared.uGain as { value: number }).value = m.gain;
      if (m.pulseOn !== undefined) (shared.uPulseOn as { value: number }).value = m.pulseOn;
      if (m.pulseSpeed !== undefined) (shared.uPulseSpeed as { value: number }).value = m.pulseSpeed;
      if (m.pulseGap !== undefined) (shared.uPulseGap as { value: number }).value = m.pulseGap;
    },
    setBeads(on: boolean) { (ribbon.uniforms.uBeads as { value: number }).value = on ? 1 : 0; },
    setNodes(on: boolean) { (nodeMat.uniforms.uNodeOn as { value: number }).value = on ? 1 : 0; },
    /** drive the pulses from your own integrated clock (so the speed can change smoothly); without it they follow time x speed */
    setPulseClock(c: number) { manualClock = true; (shared.uPulseClock as { value: number }).value = c; },
    update(time: number, width: number, height: number, fovDeg: number, dpr: number) {
      if (!manualClock) (shared.uPulseClock as { value: number }).value = time * (shared.uPulseSpeed as { value: number }).value;
      for (const m of all) {
        (m.uniforms.uTime as { value: number }).value = time;
        (m.uniforms.uRes as { value: Vector2 }).value.set(width * dpr, height * dpr);
        (m.uniforms.uPx as { value: number }).value = (height * dpr * 0.5) / Math.tan((fovDeg * Math.PI) / 360);
        (m.uniforms.uMinPx as { value: number }).value = 1.1 * dpr;
        (m.uniforms.uDpr as { value: number }).value = dpr;
      }
    },
    dispose() { g.dispose(); ng.dispose(); tg.dispose(); ribbon.dispose(); nodeMat.dispose(); tipMat.dispose(); },
  };
}

/** A restrained scatter of fine particles: most hug the cortex, a few drift further out as dust. */
export function createParticles(surface: Float32Array, normals: Float32Array, count: number, seed = 5) {
  const rand = mulberry32(seed), V = surface.length / 3;
  const pos = new Float32Array(count * 3), nrm = new Float32Array(count * 3), sd = new Float32Array(count), far = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    const v = Math.floor(rand() * V);
    pos.set([surface[v * 3]!, surface[v * 3 + 1]!, surface[v * 3 + 2]!], i * 3);
    nrm.set([normals[v * 3]!, normals[v * 3 + 1]!, normals[v * 3 + 2]!], i * 3);
    sd[i] = rand(); far[i] = rand() < 0.18 ? 0.12 + rand() * 0.3 : 0.01 + rand() * 0.05; /* dust sits further out */
  }
  const g = new BufferGeometry();
  g.setAttribute("position", new BufferAttribute(pos, 3));
  g.setAttribute("aNormal", new BufferAttribute(nrm, 3));
  g.setAttribute("aSeed", new BufferAttribute(sd, 1));
  g.setAttribute("aFar", new BufferAttribute(far, 1));
  const mat = new ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uPx: { value: 800 }, uOn: { value: 1 } }, transparent: true, depthWrite: false, ...ADD,
    vertexShader: /* glsl */ `
      uniform float uTime, uPx; attribute vec3 aNormal; attribute float aSeed, aFar; varying float vA; varying float vSeed;
      void main() {
        float t = uTime;
        vec3 drift = 0.014 * vec3(sin(t * 0.33 + aSeed * 40.0), cos(t * 0.27 + aSeed * 71.0), sin(t * 0.41 + aSeed * 13.0));
        vec3 p = position + aNormal * (aFar + 0.012 * sin(t * 0.5 + aSeed * 20.0)) + drift;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = clamp((0.0032 + 0.003 * aSeed) * uPx / -mv.z, 1.2, 3.4);
        vA = (0.35 + 0.65 * aSeed) * (aFar > 0.1 ? 0.55 : 1.0);
        vSeed = aSeed;
      }`,
    fragmentShader: /* glsl */ `
      uniform float uOn; varying float vA; varying float vSeed;
      ${EMIT_GLSL}
      void main() {
        float r = length(gl_PointCoord - 0.5) * 2.0;
        if (r > 1.0) discard;
        vec3 col = mix(${COOL_LIGHT}, mix(${WARM}, ${ICE}, step(0.8, vSeed)), step(0.45, vSeed));
        gl_FragColor = emit(col * vA * exp(-r * r * 2.2) * uOn);
      }`,
  });
  const points = new Points(g, mat);
  points.frustumCulled = false;
  return {
    points: points as Object3D,
    set(on: boolean) { (mat.uniforms.uOn as { value: number }).value = on ? 1 : 0; },
    /** 0..1: fades the whole scatter, for the entrance and for quality steps */
    setAmount(v: number) { (mat.uniforms.uOn as { value: number }).value = v; },
    update(time: number, height: number, fovDeg: number, dpr: number) {
      (mat.uniforms.uTime as { value: number }).value = time;
      (mat.uniforms.uPx as { value: number }).value = (height * dpr * 0.5) / Math.tan((fovDeg * Math.PI) / 360);
    },
    dispose() { g.dispose(); mat.dispose(); },
  };
}

export type { Shared };

/** The body of the brain when it is not drawn: an invisible mesh that still writes depth (so near strands hide far ones), plus a
 *  faint rim of light so the silhouette holds where strands are sparse. */
export function createGhostBody(geometry: BufferGeometry, rim = 0.1) {
  const occluder = new Mesh(geometry, new MeshBasicMaterial({ colorWrite: false }));
  occluder.renderOrder = -1;
  const rimMat = new ShaderMaterial({
    uniforms: { uRim: { value: rim } }, transparent: true, depthWrite: false, ...ADD,
    vertexShader: "varying vec3 vN; varying vec3 vV; void main(){ vec4 mv = modelViewMatrix * vec4(position,1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }",
    fragmentShader: `uniform float uRim; varying vec3 vN; varying vec3 vV; ${EMIT_GLSL} void main(){ float f = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 3.0); gl_FragColor = emit(mix(vec3(0.23,0.51,0.96), vec3(0.55,0.36,0.96), 0.35) * f * uRim); }`,
  });
  const rimMesh = new Mesh(geometry, rimMat);
  return {
    objects: [occluder, rimMesh] as Object3D[],
    setRim(v: number) { (rimMat.uniforms.uRim as { value: number }).value = v; },
    dispose() { (occluder.material as MeshBasicMaterial).dispose(); rimMat.dispose(); },
  };
}
