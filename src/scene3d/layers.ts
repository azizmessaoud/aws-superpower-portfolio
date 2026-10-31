/* The luminous layers drawn over the bare sculpture: fibres, pulses, branch nodes, then a restrained scatter of particles.
 * Every layer is additive light that sits on or just above the surface and is depth-tested against it, so the sculpture
 * stays visible and the far side of the brain stays hidden behind the near side. */
import {
  AdditiveBlending, BufferAttribute, BufferGeometry, Mesh, Points, ShaderMaterial, Vector2, type Object3D,
} from "three";
import { mulberry32 } from "../scene/rng";
import { childCounts, type FiberNetwork } from "./fibers";

/* palette: the site's electric blue and violet, with a little ice-white */
const BLUE = "vec3(0.231, 0.510, 0.965)", BLUE_LIGHT = "vec3(0.38, 0.65, 1.0)", VIOLET = "vec3(0.545, 0.361, 0.965)", ICE = "vec3(0.91, 0.96, 1.0)";

/* One shared description of the pulses, so ribbons and nodes light up together. */
const PULSE_GLSL = /* glsl */ `
uniform float uTime;
uniform float uPulseOn;
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
    float head = mod(uTime * uPulseSpeed + uPulsePhase[k] * cycle, cycle);
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
    uTime: { value: 0 }, uPulseOn: { value: 1 }, uPulseSpeed: { value: o.pulseSpeed ?? 0.7 }, uPulseGap: { value: o.pulseGap ?? 5 },
    uPulseLen: { value: Array.from(f.pulseLen) }, uPulsePhase: { value: Array.from(phase) },
  };
}

/** Thick-to-thin fibres as camera-facing ribbons, and branch nodes as soft points. */
export function createFiberLayers(f: FiberNetwork, o: LayerOptions = {}) {
  const N = f.parent.length;
  let M = 0;
  for (let i = 0; i < N; i++) if (f.parent[i]! >= 0) M++;
  const pos = new Float32Array(M * 4 * 3), other = new Float32Array(M * 4 * 3);
  const side = new Float32Array(M * 4), flow = new Float32Array(M * 4), dist = new Float32Array(M * 4), mask = new Float32Array(M * 4);
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
      side[v] = sd[c]; flow[v] = f.flow[a]!; dist[v] = f.dist[a]!; mask[v] = f.mask[i]!; /* a segment belongs to a pulse path if its child does */
    }
    index.set([s * 4, s * 4 + 1, s * 4 + 2, s * 4 + 1, s * 4 + 3, s * 4 + 2], s * 6);
    s++;
  }
  const g = new BufferGeometry();
  g.setAttribute("position", new BufferAttribute(pos, 3));
  g.setAttribute("aOther", new BufferAttribute(other, 3));
  g.setAttribute("aSide", new BufferAttribute(side, 1));
  g.setAttribute("aFlow", new BufferAttribute(flow, 1));
  g.setAttribute("aDist", new BufferAttribute(dist, 1));
  g.setAttribute("aMask", new BufferAttribute(mask, 1));
  g.setIndex(new BufferAttribute(index, 1));

  const shared = { ...pulseUniforms(f, o), uRes: { value: new Vector2(1280, 720) }, uPx: { value: 800 }, uMinPx: { value: 1.1 }, uWMin: { value: 0.0016 }, uWMax: { value: 0.0135 } };
  const ribbon = new ShaderMaterial({
    uniforms: shared, transparent: true, depthWrite: false, blending: AdditiveBlending, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
    vertexShader: /* glsl */ `
      uniform vec2 uRes; uniform float uPx, uMinPx, uWMin, uWMax;
      attribute vec3 aOther; attribute float aSide, aFlow, aDist, aMask;
      varying float vSide, vFlow, vDist, vMask;
      void main() {
        vec4 a = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        vec4 b = projectionMatrix * modelViewMatrix * vec4(aOther, 1.0);
        vec2 d = (b.xy / b.w - a.xy / a.w) * uRes * 0.5;
        float l = length(d);
        vec2 dir = l > 1e-4 ? d / l : vec2(1.0, 0.0);
        float wWorld = uWMin + (uWMax - uWMin) * pow(aFlow, 0.3);
        float wPx = max(uMinPx, wWorld * uPx / a.w);
        vec2 off = vec2(-dir.y, dir.x) * aSide * wPx * 0.5 - dir * wPx * 0.45; /* sideways, plus a little past the end so joints close */
        gl_Position = a;
        gl_Position.xy += off / (uRes * 0.5) * a.w;
        vSide = aSide; vFlow = aFlow; vDist = aDist; vMask = aMask;
      }`,
    fragmentShader: /* glsl */ `
      ${PULSE_GLSL}
      varying float vSide, vFlow, vDist, vMask;
      void main() {
        float core = smoothstep(1.0, 0.15, abs(vSide));
        float strength = pow(vFlow, 0.5);
        vec3 base = mix(${VIOLET}, ${BLUE_LIGHT}, smoothstep(0.0, 0.5, strength));
        float a = (0.34 + 0.66 * strength) * core;
        float p = pulseAt(vMask, vDist);
        vec3 col = base * a + mix(${BLUE}, ${ICE}, 0.65) * p * core * 1.25;
        gl_FragColor = vec4(col, 1.0);
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
    uniforms: { ...shared, uNodeOn: { value: 1 } }, transparent: true, depthWrite: false, blending: AdditiveBlending,
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
      void main() {
        float r = length(gl_PointCoord - 0.5) * 2.0;
        if (r > 1.0) discard;
        float glow = exp(-r * r * 3.2);
        float p = pulseAt(vMask, vDist);
        vec3 col = mix(${BLUE_LIGHT}, ${ICE}, 0.35) * glow * (0.3 + 0.35 * pow(vFlow, 0.4)) + ${ICE} * p * glow;
        gl_FragColor = vec4(col * uNodeOn, 1.0);
      }`,
  });
  const nodes = new Points(ng, nodeMat);
  nodes.frustumCulled = false;

  const all = [ribbon, nodeMat];
  return {
    ribbons: mesh as Object3D, nodes: nodes as Object3D, segments: M, branchNodes: nodeIdx.length,
    setPulses(on: boolean) { all.forEach((m) => { (m.uniforms.uPulseOn as { value: number }).value = on ? 1 : 0; }); },
    setNodes(on: boolean) { (nodeMat.uniforms.uNodeOn as { value: number }).value = on ? 1 : 0; },
    update(time: number, width: number, height: number, fovDeg: number, dpr: number) {
      for (const m of all) {
        (m.uniforms.uTime as { value: number }).value = time;
        (m.uniforms.uRes as { value: Vector2 }).value.set(width * dpr, height * dpr);
        (m.uniforms.uPx as { value: number }).value = (height * dpr * 0.5) / Math.tan((fovDeg * Math.PI) / 360);
        (m.uniforms.uMinPx as { value: number }).value = 1.1 * dpr;
      }
    },
    dispose() { g.dispose(); ng.dispose(); ribbon.dispose(); nodeMat.dispose(); },
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
    uniforms: { uTime: { value: 0 }, uPx: { value: 800 }, uOn: { value: 1 } }, transparent: true, depthWrite: false, blending: AdditiveBlending,
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
      void main() {
        float r = length(gl_PointCoord - 0.5) * 2.0;
        if (r > 1.0) discard;
        vec3 col = mix(${BLUE_LIGHT}, mix(${VIOLET}, ${ICE}, step(0.8, vSeed)), step(0.45, vSeed));
        gl_FragColor = vec4(col * vA * exp(-r * r * 2.2) * uOn, 1.0);
      }`,
  });
  const points = new Points(g, mat);
  points.frustumCulled = false;
  return {
    points: points as Object3D,
    set(on: boolean) { (mat.uniforms.uOn as { value: number }).value = on ? 1 : 0; },
    update(time: number, height: number, fovDeg: number, dpr: number) {
      (mat.uniforms.uTime as { value: number }).value = time;
      (mat.uniforms.uPx as { value: number }).value = (height * dpr * 0.5) / Math.tan((fovDeg * Math.PI) / 360);
    },
    dispose() { g.dispose(); mat.dispose(); },
  };
}

export type { Shared };
