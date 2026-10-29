import { lazy, Suspense, useCallback, useEffect, useState } from "react";
import type { Scene } from "./scene/scene";
import Nav from "./ui/Nav";
import Hero from "./sections/Hero";
import About from "./sections/About";
import Skills from "./sections/Skills";
import Projects from "./sections/Projects";
import Certifications from "./sections/Certifications";
import Contact from "./sections/Contact";
import Terminal from "./sections/Terminal";

const NeuralScene = lazy(() => import("./scene/NeuralScene"));

export default function App() {
  const [reduced, setReduced] = useState(() => matchMedia("(prefers-reduced-motion: reduce)").matches);
  const [scene, setScene] = useState<Scene | null>(null);
  const [docked, setDocked] = useState(false);

  useEffect(() => {
    const mq = matchMedia("(prefers-reduced-motion: reduce)");
    const on = () => setReduced(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  const onReady = useCallback((s: Scene | null) => setScene(s), []);
  const onDocked = useCallback((d: boolean) => setDocked(d), []);

  return (
    <>
      <a className="skip" href="#main">Skip to content</a>
      <Nav scene={scene} docked={docked} />
      <Suspense fallback={null}>
        <NeuralScene reduced={reduced} onReady={onReady} onDocked={onDocked} />
      </Suspense>
      <main id="main">
        <Hero />
        <About />
        <Skills />
        <Projects />
        <Terminal />
        <Certifications />
        <Contact />
      </main>
      <footer className="footer">
        <p>© 2026 Aziz Messaoud · Built for the AWS Student Builder Challenge</p>
        <a href="https://github.com/azizmessaoud/aws-superpower-portfolio">Source code on GitHub</a>
      </footer>
    </>
  );
}
