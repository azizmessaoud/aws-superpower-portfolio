import Nav from "./ui/Nav";
import Hero from "./sections/Hero";
import About from "./sections/About";
import Skills from "./sections/Skills";
import Projects from "./sections/Projects";
import AskMyBrain from "./sections/AskMyBrain";
import Contact from "./sections/Contact";

export default function App() {
  return (
    <>
      <a className="skip" href="#main">Skip to content</a>
      <Nav />
      <main id="main">
        <Hero />
        <About />
        <Skills />
        <Projects />
        <AskMyBrain />
        <Contact />
      </main>
      <footer className="footer">
        <p>© 2026 Aziz Messaoud · Built for the AWS Student Builder Challenge</p>
        <a href="https://github.com/azizmessaoud/aws-superpower-portfolio">Source code on GitHub</a>
      </footer>
    </>
  );
}
