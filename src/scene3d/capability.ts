/* Can this visitor have the WebGL hero, and at what quality? Decided from capability, never from "touch device":
 * a modern phone can run this, and an old laptop may not. Small and dependency-free: it ships in the main bundle so the
 * choice is made before anything heavy is fetched. */

export type Tier = "full" | "mobile";

/** The hero falls back to the 2D scene when any of these is missing, or the visitor asked for less data. */
export function canUseWebglHero(): boolean {
  if (typeof window === "undefined" || typeof document === "undefined") return false;
  if (new URLSearchParams(location.search).get("hero") === "canvas") return false; /* an explicit override, also used by tests */
  if (typeof DecompressionStream === "undefined") return false; /* the baked asset is gzip */
  const conn = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
  if (conn?.saveData) return false;
  if (matchMedia("(prefers-reduced-data: reduce)").matches) return false;
  try {
    const c = document.createElement("canvas");
    const gl = c.getContext("webgl2");
    if (!gl) return false;
    gl.getExtension("WEBGL_lose_context")?.loseContext(); /* release the probe context at once */
  } catch { return false; }
  return true;
}

/** Which baked asset to load. Small windows and modest hardware get the lighter one; a ?tier= override exists for testing. */
export function chooseTier(): Tier {
  const forced = new URLSearchParams(location.search).get("tier");
  if (forced === "full" || forced === "mobile") return forced;
  const nav = navigator as Navigator & { deviceMemory?: number };
  const smallWindow = Math.min(innerWidth, innerHeight) < 700;
  const modest = (nav.deviceMemory !== undefined && nav.deviceMemory <= 4) || (navigator.hardwareConcurrency !== undefined && navigator.hardwareConcurrency <= 4);
  return smallWindow || modest ? "mobile" : "full";
}
