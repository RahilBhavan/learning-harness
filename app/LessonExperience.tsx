"use client";

import { useEffect, useMemo, useState } from "react";

type ProseBlock = { type: "prose"; eyebrow?: string; title: string; body: string[] };
type SystemMapBlock = {
  type: "system-map";
  title: string;
  caption: string;
  nodes: { id: string; label: string; detail: string; tone: string }[];
};
type ComparisonBlock = {
  type: "comparison";
  title: string;
  left: { label: string; score: number; points: string[] };
  right: { label: string; score: number; points: string[] };
};
type SimulatorBlock = {
  type: "simulator";
  title: string;
  prompt: string;
  controls: { id: string; label: string; help: string; min: number; max: number; initial: number; inverse?: boolean }[];
};
type EvidenceBlock = {
  type: "evidence";
  title: string;
  rows: { stage: string; rate: number; change: string }[];
  note: string;
};
type QuizBlock = {
  type: "quiz";
  title: string;
  question: string;
  options: { label: string; correct: boolean; feedback: string }[];
};
type TakeawayBlock = { type: "takeaway"; title: string; items: string[] };
type ExerciseBlock = { type: "exercise"; title: string; prompt: string; steps: string[] };
type Block = ProseBlock | SystemMapBlock | ComparisonBlock | SimulatorBlock | EvidenceBlock | QuizBlock | TakeawayBlock | ExerciseBlock;
type Section = { id: string; nav: string; number: string; title: string; lead: string; blocks: Block[] };
type Lesson = {
  title: string;
  kicker: string;
  summary: string;
  duration: string;
  level: string;
  objectives: string[];
  sections: Section[];
  sources: { label: string; url: string }[];
};

function Arrow({ label }: { label: string }) {
  return <div className="system-arrow" aria-label={label}><span>{label}</span><b aria-hidden="true">→</b></div>;
}

function SystemMap({ block }: { block: SystemMapBlock }) {
  const [active, setActive] = useState(0);
  const node = block.nodes[active];

  return (
    <figure className="learning-figure">
      <div className="figure-heading">
        <div><span className="figure-label">Interactive diagram</span><h3>{block.title}</h3></div>
        <span className="figure-hint">Select a stage</span>
      </div>
      <div className="system-map" role="group" aria-label={block.title}>
        {block.nodes.map((item, index) => (
          <div className="system-part" key={item.id}>
            <button
              className={`system-node tone-${item.tone} ${active === index ? "is-active" : ""}`}
              onClick={() => setActive(index)}
              aria-pressed={active === index}
            >
              <span>{String(index + 1).padStart(2, "0")}</span>
              <strong>{item.label}</strong>
            </button>
            {index < block.nodes.length - 1 && <Arrow label={index === 2 ? "observes" : "feeds"} />}
          </div>
        ))}
      </div>
      <div className="diagram-readout" aria-live="polite">
        <span>{String(active + 1).padStart(2, "0")}</span>
        <div><strong>{node.label}</strong><p>{node.detail}</p></div>
      </div>
      <figcaption>{block.caption}</figcaption>
    </figure>
  );
}

function Comparison({ block }: { block: ComparisonBlock }) {
  return (
    <div className="comparison-block">
      <h3>{block.title}</h3>
      <div className="comparison-grid">
        {[block.left, block.right].map((side, index) => (
          <article className={index ? "comparison-card winner" : "comparison-card"} key={side.label}>
            <div className="comparison-top"><span>{side.label}</span><strong>{side.score}%</strong></div>
            <div className="score-track"><i style={{ width: `${side.score}%` }} /></div>
            <ul>{side.points.map((point) => <li key={point}>{point}</li>)}</ul>
          </article>
        ))}
      </div>
    </div>
  );
}

function Simulator({ block }: { block: SimulatorBlock }) {
  const [values, setValues] = useState<Record<string, number>>(() => Object.fromEntries(block.controls.map((c) => [c.id, c.initial])));
  const score = useMemo(() => {
    const total = block.controls.reduce((sum, control) => sum + (control.inverse ? control.max - values[control.id] : values[control.id]), 0);
    return Math.round((total / block.controls.reduce((sum, control) => sum + control.max, 0)) * 100);
  }, [block.controls, values]);
  const verdict = score >= 78 ? "Self-correcting" : score >= 52 ? "Fragile but recoverable" : "Open-loop and drifting";

  return (
    <div className="simulator-shell">
      <div className="simulator-copy"><span className="figure-label">Live model</span><h3>{block.title}</h3><p>{block.prompt}</p></div>
      <div className="simulator-grid">
        <div className="control-stack">
          {block.controls.map((control) => (
            <label className="range-control" key={control.id}>
              <span><strong>{control.label}</strong><output>{values[control.id]}/10</output></span>
              <input
                type="range" min={control.min} max={control.max} value={values[control.id]}
                onChange={(event) => setValues((current) => ({ ...current, [control.id]: Number(event.target.value) }))}
              />
              <small>{control.help}</small>
            </label>
          ))}
        </div>
        <div className="score-dial" style={{ "--score": `${score * 3.6}deg` } as React.CSSProperties}>
          <div><strong>{score}</strong><span>loop health</span></div>
          <p>{verdict}</p>
        </div>
      </div>
      <p className="simulator-note">This is a teaching model, not a benchmark. Its job is to make the relationship between intent, feedback, and recovery tangible.</p>
    </div>
  );
}

function Evidence({ block }: { block: EvidenceBlock }) {
  return (
    <figure className="evidence-block">
      <div className="figure-heading"><div><span className="figure-label">Evidence pattern</span><h3>{block.title}</h3></div><span className="figure-hint">Illustrative case</span></div>
      <div className="evidence-chart">
        {block.rows.map((row) => (
          <div className="evidence-row" key={row.stage}>
            <div><strong>{row.stage}</strong><span>{row.change}</span></div>
            <div className="evidence-track"><i style={{ width: `${row.rate}%` }} /><b>{row.rate}%</b></div>
          </div>
        ))}
      </div>
      <figcaption>{block.note}</figcaption>
    </figure>
  );
}

function Quiz({ block }: { block: QuizBlock }) {
  const [selected, setSelected] = useState<number | null>(null);
  const answer = selected === null ? null : block.options[selected];
  return (
    <div className="quiz-block">
      <span className="figure-label">Prediction check</span><h3>{block.title}</h3><p className="quiz-question">{block.question}</p>
      <div className="quiz-options">
        {block.options.map((option, index) => (
          <button key={option.label} onClick={() => setSelected(index)} className={selected === index ? (option.correct ? "correct" : "incorrect") : ""} aria-pressed={selected === index}>
            <span>{String.fromCharCode(65 + index)}</span>{option.label}
          </button>
        ))}
      </div>
      <div className={`quiz-feedback ${answer ? "is-visible" : ""}`} aria-live="polite">
        {answer && <><strong>{answer.correct ? "Exactly." : "Not quite."}</strong> {answer.feedback}</>}
      </div>
    </div>
  );
}

function renderBlock(block: Block, index: number) {
  switch (block.type) {
    case "prose": return <div className="prose-block" key={index}>{block.eyebrow && <span className="mini-eyebrow">{block.eyebrow}</span>}<h3>{block.title}</h3>{block.body.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}</div>;
    case "system-map": return <SystemMap block={block} key={index} />;
    case "comparison": return <Comparison block={block} key={index} />;
    case "simulator": return <Simulator block={block} key={index} />;
    case "evidence": return <Evidence block={block} key={index} />;
    case "quiz": return <Quiz block={block} key={index} />;
    case "takeaway": return <aside className="takeaway-block" key={index}><span className="figure-label">Keep this</span><h3>{block.title}</h3><ul>{block.items.map((item) => <li key={item}>{item}</li>)}</ul></aside>;
    case "exercise": return <div className="exercise-block" key={index}><div className="exercise-index">TRY</div><div><span className="figure-label">Field exercise</span><h3>{block.title}</h3><p>{block.prompt}</p><ol>{block.steps.map((step) => <li key={step}>{step}</li>)}</ol></div></div>;
  }
}

export default function LessonExperience({ lesson }: { lesson: Lesson }) {
  const [activeSection, setActiveSection] = useState(lesson.sections[0].id);
  const [menuOpen, setMenuOpen] = useState(false);
  const [completed, setCompleted] = useState<string[]>([]);

  useEffect(() => {
    const observer = new IntersectionObserver((entries) => {
      const visible = entries.filter((entry) => entry.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (visible?.target.id) setActiveSection(visible.target.id);
    }, { rootMargin: "-18% 0px -60%", threshold: [0.05, 0.3] });
    lesson.sections.forEach((section) => { const element = document.getElementById(section.id); if (element) observer.observe(element); });
    return () => observer.disconnect();
  }, [lesson.sections]);

  const currentIndex = lesson.sections.findIndex((section) => section.id === activeSection);
  const progress = Math.max(4, ((currentIndex + 1) / lesson.sections.length) * 100);
  const toggleComplete = (id: string) => setCompleted((items) => items.includes(id) ? items.filter((item) => item !== id) : [...items, id]);

  return (
    <div className="site-shell">
      <div className="reading-progress" style={{ width: `${progress}%` }} />
      <header className="topbar">
        <a className="brand" href="#top" aria-label="Learning Harness home"><span>LH</span><strong>Learning<br />Harness</strong></a>
        <div className="course-meta"><span>Course 01</span><b>Systems for reliable agents</b></div>
        <button className="menu-button" onClick={() => setMenuOpen(!menuOpen)} aria-expanded={menuOpen} aria-controls="lesson-nav">{menuOpen ? "Close" : "Contents"}</button>
        <div className="completion-count"><span>{completed.length}/{lesson.sections.length}</span> complete</div>
      </header>

      <div className="page-grid">
        <aside id="lesson-nav" className={`lesson-nav ${menuOpen ? "is-open" : ""}`}>
          <div className="nav-label">In this lesson</div>
          <nav>
            {lesson.sections.map((section) => (
              <a key={section.id} href={`#${section.id}`} className={activeSection === section.id ? "active" : ""} onClick={() => setMenuOpen(false)}>
                <span>{section.number}</span><em>{section.nav}</em>{completed.includes(section.id) && <b aria-label="Completed">✓</b>}
              </a>
            ))}
          </nav>
          <div className="nav-footer"><span>Reading time</span><strong>{lesson.duration}</strong><small>{lesson.level}</small></div>
        </aside>

        <main id="top">
          <section className="hero">
            <div className="hero-kicker"><span>{lesson.kicker}</span><i /> <span>{lesson.duration}</span></div>
            <h1>{lesson.title}</h1>
            <p>{lesson.summary}</p>
            <div className="objective-card"><span>By the end, you can</span><ul>{lesson.objectives.map((objective) => <li key={objective}>{objective}</li>)}</ul></div>
            <a className="start-link" href={`#${lesson.sections[0].id}`}>Start the lesson <span>↓</span></a>
          </section>

          {lesson.sections.map((section) => (
            <section className="lesson-section" id={section.id} key={section.id}>
              <header className="section-header"><span>{section.number}</span><div><p>{section.nav}</p><h2>{section.title}</h2><div className="section-lead">{section.lead}</div></div></header>
              <div className="section-body">{section.blocks.map(renderBlock)}</div>
              <button className={`mark-complete ${completed.includes(section.id) ? "is-complete" : ""}`} onClick={() => toggleComplete(section.id)}>
                <span>{completed.includes(section.id) ? "✓" : "+"}</span>{completed.includes(section.id) ? "Section complete" : "Mark section complete"}
              </button>
            </section>
          ))}

          <footer className="lesson-footer">
            <div><span className="figure-label">Source trail</span><h2>Go deeper, verify the claim</h2><p>Good learning material exposes its evidence. These references informed this lesson and remain the place to challenge or extend it.</p></div>
            <div className="source-list">{lesson.sources.map((source, index) => <a href={source.url} target="_blank" rel="noreferrer" key={source.url}><span>{String(index + 1).padStart(2, "0")}</span>{source.label}<b>↗</b></a>)}</div>
          </footer>
        </main>

        <aside className="margin-rail">
          <span>Now reading</span><strong>{lesson.sections[currentIndex]?.nav}</strong>
          <div className="rail-progress"><i style={{ height: `${progress}%` }} /></div>
          <small>{Math.round(progress)}%</small>
        </aside>
      </div>
    </div>
  );
}
