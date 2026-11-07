/* The frame-rate governor for the WebGL hero. It judges how fast the brain really draws and says what to do: keep going, step the
 * quality down once, or give the page back to the 2D hero.
 *
 * It decides by wall-clock time as well as by frame count. The first version waited for 120 frames and then 90 more, which on a slow
 * machine (a frame every 100 to 200 ms) meant 20 to 40 seconds of a page that barely responded before anything changed. Here a window
 * ends after 45 frames, or after 2.5 s once at least 8 frames are in, whichever comes first. */

export type Verdict = "wait" | "ok" | "degrade" | "fail";

export interface GovernorOptions {
  /** frames to ignore at the start (shader compile, first upload) */
  warmFrames?: number;
  /** a window needs at least this many frames before the time limit can end it */
  minSamples?: number;
  /** a window ends at once at this many frames */
  maxSamples?: number;
  /** a window ends after this many seconds if it has minSamples */
  windowSeconds?: number;
  /** median seconds per frame above which the first window steps the quality down (0.032 is about 30 fps) */
  degradeAbove?: number;
  /** median seconds per frame above which the second window gives up (0.055 is about 18 fps) */
  failAbove?: number;
}

const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[xs.length >> 1]!;

export function createGovernor(o: GovernorOptions = {}) {
  const warm = o.warmFrames ?? 6, minN = o.minSamples ?? 8, maxN = o.maxSamples ?? 45, windowS = o.windowSeconds ?? 2.5;
  const degradeAbove = o.degradeAbove ?? 0.032, failAbove = o.failAbove ?? 0.055;
  let level = 0, seen = 0, spent = 0;
  const dts: number[] = [];
  return {
    /** 0 = judging at full quality, 1 = judging after one step down, 2 = settled */
    get level() { return level; },
    /** feed the real seconds since the previous drawn frame (not capped) */
    feed(dt: number): Verdict {
      if (level >= 2) return "ok";
      if (seen < warm) { seen++; return "wait"; }
      dts.push(dt); spent += dt;
      if (!(dts.length >= maxN || (dts.length >= minN && spent >= windowS))) return "wait";
      const med = median(dts);
      dts.length = 0; spent = 0;
      if (level === 0 && med > degradeAbove) { level = 1; return "degrade"; }
      if (level === 1 && med > failAbove) return "fail";
      level = 2;
      return "ok";
    },
  };
}
