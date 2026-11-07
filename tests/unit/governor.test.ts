import { describe, expect, it } from "vitest";
import { createGovernor } from "../../src/scene3d/governor";
import { isSoftwareRenderer } from "../../src/scene3d/capability";

/* Feed a steady frame time until the governor says something other than "wait"; return what it said and how many frames and seconds that took. */
function run(g: ReturnType<typeof createGovernor>, dt: number, cap = 5000) {
  let seconds = 0;
  for (let i = 1; i <= cap; i++) {
    seconds += dt;
    const v = g.feed(dt);
    if (v !== "wait") return { verdict: v, frames: i, seconds };
  }
  throw new Error("never decided");
}

describe("the frame-rate governor", () => {
  it("keeps a healthy 60 fps brain after one window of 45 frames, with 6 warm-up frames ignored", () => {
    const r = run(createGovernor(), 1 / 60);
    expect(r.verdict).toBe("ok");
    expect(r.frames).toBe(6 + 45);
  });

  it("keeps a brain that draws at 31 fps or better and steps down below that (the limit is 0.032 s per frame)", () => {
    expect(run(createGovernor(), 0.031).verdict).toBe("ok");
    expect(run(createGovernor(), 0.033).verdict).toBe("degrade");
  });

  it("steps down once for a slow machine, then keeps it if the step down fixed it", () => {
    const g = createGovernor();
    expect(run(g, 0.045).verdict).toBe("degrade");
    expect(g.level).toBe(1);
    expect(run(g, 0.02).verdict).toBe("ok");
    expect(g.level).toBe(2);
    expect(g.feed(10)).toBe("ok"); /* settled: later hiccups are ignored */
  });

  it("gives the page back to the 2D hero when the step down did not help", () => {
    const g = createGovernor();
    expect(run(g, 0.1).verdict).toBe("degrade");
    expect(run(g, 0.1).verdict).toBe("fail");
  });

  it("does not wait for 45 frames on a very slow machine: a window ends after 2.5 s once 8 frames are in", () => {
    const first = run(createGovernor(), 0.2);
    /* 6 warm-up frames, then the window: 8 frames is 1.6 s (< 2.5 s), so it runs on to 13 frames (2.6 s) */
    expect(first.verdict).toBe("degrade");
    expect(first.frames).toBe(6 + 13);
    expect(first.frames).toBeLessThan(6 + 45);
    /* the whole path to the 2D hero on a 5 fps machine is about 8 s, not the 40 s of the old 120 + 90 frame rule */
    const g = createGovernor();
    const a = run(g, 0.2), b = run(g, 0.2);
    expect(b.verdict).toBe("fail");
    expect(a.seconds + b.seconds).toBeLessThan(8); /* 6 warm-up + 13 frames, then 13 more: 19 * 0.2 + 13 * 0.2 = 6.4 s */
  });

  it("uses the median, so one long frame (a shader compile, a tab switch) does not condemn a fast brain", () => {
    const g = createGovernor();
    for (let i = 0; i < 6; i++) g.feed(0.016);       /* warm-up */
    let verdict = "wait";
    for (let i = 0; i < 45; i++) verdict = g.feed(i === 20 ? 3 : 0.016);
    expect(verdict).toBe("ok");
  });
});

describe("software renderer detection", () => {
  it("recognises the renderers that draw WebGL on the CPU", () => {
    for (const name of [
      "ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero) (0x0000C0DE)), SwiftShader driver)",
      "llvmpipe (LLVM 15.0.7, 256 bits)",
      "ANGLE (Microsoft, Microsoft Basic Render Driver Direct3D11 vs_5_0 ps_5_0)",
      "Mesa Software Rasterizer",
    ]) expect(isSoftwareRenderer(name), name).toBe(true);
  });

  it("leaves real GPUs, and an unknown name, alone", () => {
    for (const name of [
      "ANGLE (Intel, Intel(R) UHD Graphics 620 Direct3D11 vs_5_0 ps_5_0, D3D11)",
      "ANGLE (NVIDIA, NVIDIA GeForce RTX 3060 Direct3D11 vs_5_0 ps_5_0, D3D11)",
      "Apple M2",
      "AMD Radeon Pro 5500M OpenGL Engine",
      "",
    ]) expect(isSoftwareRenderer(name), name).toBe(false);
  });
});
