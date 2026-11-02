import { Component, lazy, Suspense, useCallback, useEffect, useState, type ReactNode } from "react";
import type { Scene } from "./scene/scene";
import Nav from "./ui/Nav";
import Hero from "./sections/Hero";
import Aws from "./sections/Aws";
import type { MindState } from "./mind/state";
import SelectedWork from "./sections/SelectedWork";
import About from "./sections/About";
import Skills from "./sections/Skills";
import Projects from "./sections/Projects";
import Certifications from "./sections/Certifications";
import Contact from "./sections/Contact";
import Terminal from "./sections/Terminal";
import { canUseWebglHero } from "./scene3d/capability";

const NeuralScene = lazy(() => import("./scene/NeuralScene"));
/* the 3D hero is a separate, lazily loaded chunk (Three.js and the renderer); the page is complete without it */
const HeroBrain = lazy(() => import("./scene3d/HeroBrain"));

/* The animation is decoration. If its chunk fails to load (network, blocked script), render nothing for it and keep
 * the rest of the page, instead of letting the failed import unmount the whole app. */
class SceneBoundary extends Component<{ children: ReactNode; onFail: () => void }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { this.props.onFail(); }
  render() { return this.state.failed ? null : this.props.children; }
}

export default function App() {
  const [reduced, setReduced] = useState(() => matchMedia("(prefers-reduced-motion: reduce)").matches);
  const [scene, setScene] = useState<Scene | null>(null);
  const [docked, setDocked] = useState(false);
  const [mind, setMind] = useState<MindState>("idle");
  /* "webgl" when this device can run the 3D hero; any failure later flips it back to "canvas" and the 2D hero returns */
  const [heroMode, setHeroMode] = useState<"canvas" | "webgl">(() => (canUseWebglHero() ? "webgl" : "canvas"));
  const heroFailed = useCallback((why: string) => { console.info(`3D hero unavailable (${why}); using the 2D hero`); setHeroMode("canvas"); }, []);
  useEffect(() => { document.documentElement.dataset.brain = heroMode === "webgl" ? "loading" : "canvas"; }, [heroMode]);
  useEffect(() => { scene?.setHeroMode(heroMode); }, [scene, heroMode]);

  /* The page is rendered by script, so the browser cannot scroll to #fragment on load or refresh; do it once the sections exist. */
  useEffect(() => {
    const id = decodeURIComponent(location.hash.slice(1));
    if (!id || id === "top") return;
    const go = () => document.getElementById(id)?.scrollIntoView({ behavior: "instant" as ScrollBehavior });
    const a = requestAnimationFrame(go), b = window.setTimeout(go, 500);
    return () => { cancelAnimationFrame(a); clearTimeout(b); };
  }, []);
  useEffect(() => {
    const mq = matchMedia("(prefers-reduced-motion: reduce)");
    const on = () => setReduced(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  useEffect(() => { scene?.setMindState(mind); }, [scene, mind]);
  const onLayout = useCallback(() => { scene?.remeasure(); }, [scene]);
  const onReady = useCallback((s: Scene | null) => setScene(s), []);
  const onDocked = useCallback((d: boolean) => setDocked(d), []);

  return (
    <>
      <a className="skip" href="#main">Skip to content</a>
      <Nav scene={scene} docked={docked} />
      <SceneBoundary onFail={() => { setScene(null); setDocked(false); }}>
        <Suspense fallback={null}>
          <NeuralScene reduced={reduced} heroMode={heroMode} onReady={onReady} onDocked={onDocked} />
        </Suspense>
      </SceneBoundary>
      {heroMode === "webgl" && (
        <SceneBoundary onFail={() => heroFailed("the 3D chunk failed to load")}>
          <Suspense fallback={null}>
            <HeroBrain scene={scene} reduced={reduced} mind={mind} onFail={heroFailed} />
          </Suspense>
        </SceneBoundary>
      )}
      <main id="main">
        <Hero mind={mind} setMind={setMind} reduced={reduced} onLayout={onLayout} />
        <SelectedWork />
        <About />
        <Skills />
        <Projects />
        <Aws />
        <Terminal setMind={setMind} reduced={reduced} />
        <Certifications />
        <Contact />
      </main>
      <footer className="footer">
        <p>© 2026 Aziz Messaoud · Built for the AWS Student Builder Challenge</p>
        <nav className="footer-links" aria-label="Footer">
          <a href="#terminal">Command line</a>
          <a href="https://github.com/azizmessaoud/aws-superpower-portfolio/blob/main/WRITEUP.md">Build write-up: what worked, what failed</a>
          <a href="https://github.com/azizmessaoud/aws-superpower-portfolio">Source code on GitHub</a>
        </nav>
      </footer>
    </>
  );
}
