/* Register rows: ID-01 (ESPRIT, expected 2027), ID-02 (PFE target), ID-04 baseline wording, ID-05 (city shown
 * as Tunisia only), ID-07 (languages), ID-08 (internships; FlyRank dates withheld until D2). */
export default function About() {
  return (
    <section id="about" className="section about" aria-labelledby="about-title">
      <div className="inner">
        <p className="sec-label">About</p>
        <h2 id="about-title" className="sec-h2">I study data science and test my work against a baseline.</h2>
        <div className="about-grid">
          <div className="about-text">
            <p>
              I'm Aziz Messaoud, a Data Science Engineering student at ESPRIT in Tunisia, expecting to graduate in 2027.
              I'm looking for a 2027 final-year internship (PFE) in AI/ML engineering, applied data science or AI research.
            </p>
            <p>
              The projects below share a habit I try to keep: fix the baseline before looking at the label, test on data the
              model never saw, and keep the limitations next to the number. Where a result is weak or mixed, it says so.
            </p>
            <p className="about-langs">I work in Arabic, French and English.</p>
          </div>
          <dl className="timeline" aria-label="Internships">
            <div><dt>Sopra HR Software</dt><dd>AI intern · Jul–Sep 2026</dd></div>
            <div><dt>FlyRank AI</dt><dd>Machine-learning intern · remote</dd></div>
            <div><dt>Sopra HR Software</dt><dd>AI intern · Jul–Aug 2025</dd></div>
            <div><dt>Banque de Tunisie</dt><dd>IT support intern · Jun–Jul 2023</dd></div>
          </dl>
        </div>
      </div>
    </section>
  );
}
