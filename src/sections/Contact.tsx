import { useRef, useState } from "react";
import Icon from "../ui/Icon";

const EMAIL = "aziz.messaoud@esprit.tn";

export default function Contact() {
  const [msg, setMsg] = useState("");
  const [copied, setCopied] = useState(false);
  const addr = useRef<HTMLSpanElement>(null);
  const timer = useRef<number>();

  function say(text: string, ok: boolean) {
    setMsg(text); setCopied(ok);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => { setMsg(""); setCopied(false); }, 2200);
  }
  function copy() {
    const select = () => {
      const r = document.createRange();
      r.selectNodeContents(addr.current!);
      getSelection()?.removeAllRanges(); getSelection()?.addRange(r);
      say(`Selected. Press ${/Mac|iP/.test(navigator.platform) ? "⌘" : "Ctrl"}+C to copy.`, false);
    };
    if (!navigator.clipboard) return select();
    navigator.clipboard.writeText(EMAIL).then(() => say("Copied to clipboard.", true), select);
  }

  return (
    <section id="contact" className="section contact" aria-labelledby="contact-title">
      <div className="inner">
        <p className="sec-label">Contact</p>
        <h2 id="contact-title" className="sec-h2">Ask me directly.</h2>
        <p className="sec-lead">For a 2027 PFE internship in AI/ML engineering, applied data science or AI research, email is best.</p>
        <div className="contact-grid">
          <div className="email-row glass">
            <Icon name="mail" />
            <span className="email-addr" ref={addr}>{EMAIL}</span>
            <button type="button" className="copy-btn" onClick={copy} aria-describedby="copy-status">
              <Icon name={copied ? "check" : "copy"} /> {copied ? "Copied" : "Copy"}
            </button>
          </div>
          <p id="copy-status" className="copy-status" role="status" aria-live="polite">{msg}</p>
          <ul className="contact-links">
            <li><a href={`mailto:${EMAIL}`}>Email</a></li>
            <li><a href="https://github.com/azizmessaoud">GitHub</a></li>
            <li><a href="https://www.linkedin.com/in/azizmessaoud/">LinkedIn</a></li>
            <li><a href="https://azizmessaoud.github.io/projectx0/">Main portfolio</a></li>
          </ul>
        </div>
      </div>
    </section>
  );
}
