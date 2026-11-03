import { useEffect, useState } from "react";
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

export default function App() {
  const [reduced, setReduced] = useState(() => matchMedia("(prefers-reduced-motion: reduce)").matches);
  const [mind, setMind] = useState<MindState>("idle");

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
  return (
    <>
      <a className="skip" href="#main">Skip to content</a>
      <Nav />
      <main id="main">
        <Hero mind={mind} setMind={setMind} reduced={reduced} />
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
