"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import LessonExperience, { type Lesson } from "../LessonExperience";

function validateReviewLesson(value: unknown): asserts value is Lesson {
  if (!value || typeof value !== "object") throw new Error("The file does not contain a lesson object.");
  const lesson = value as Partial<Lesson>;
  if (!lesson.title || !lesson.kicker || !lesson.summary || !lesson.duration || !lesson.level || !Array.isArray(lesson.objectives)) throw new Error("The lesson is missing required metadata or objectives.");
  if (!Array.isArray(lesson.sections) || lesson.sections.length < 3) throw new Error("The lesson needs at least three sections.");
  if (!Array.isArray(lesson.sources) || lesson.sources.length < 2) throw new Error("The lesson needs at least two sources.");
  if (lesson.sections.some((section) => !section.id || !section.title || !Array.isArray(section.blocks))) throw new Error("Every section needs an id, title, and block list.");
  for (const source of lesson.sources) {
    const url = new URL(source.url);
    if (!['http:', 'https:'].includes(url.protocol)) throw new Error(`Unsupported source URL: ${source.url}`);
  }
}

export default function ReviewWorkspace() {
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [error, setError] = useState("");
  const input = useRef<HTMLInputElement>(null);

  async function openLesson(file?: File) {
    if (!file) return;
    setError("");
    try {
      if (file.size > 2_000_000) throw new Error("Lesson files must be smaller than 2 MB.");
      const value = JSON.parse(await file.text());
      validateReviewLesson(value);
      setLesson(value);
      window.scrollTo({ top: 0, behavior: "instant" });
    } catch (reason) {
      setLesson(null);
      setError(reason instanceof Error ? reason.message : "Could not open this lesson.");
    }
  }

  if (lesson) {
    return (
      <div className="review-workspace">
        <div className="review-banner">
          <div><strong>Local review</strong><span>This lesson stays in your browser and is not installed or uploaded.</span></div>
          <button onClick={() => input.current?.click()}>Choose another lesson</button>
          <input ref={input} type="file" accept="application/json,.json" onChange={(event) => openLesson(event.target.files?.[0])} />
        </div>
        <LessonExperience lesson={lesson} />
      </div>
    );
  }

  return (
    <main className="review-empty">
      <Link href="/" className="review-brand"><span>LH</span> Learning Harness</Link>
      <div className="review-card">
        <span className="figure-label">Human review workspace</span>
        <h1>Open the generated lesson in its real renderer.</h1>
        <p>Select <code>05-lesson.json</code> from a run directory. The file is parsed locally in your browser; it is not uploaded, installed, or published.</p>
        <label className="review-file-button">
          Choose lesson JSON
          <input type="file" accept="application/json,.json" onChange={(event) => openLesson(event.target.files?.[0])} />
        </label>
        {error && <div className="review-error" role="alert">{error}</div>}
        <ul>
          <li>Exercise every diagram, slider, and quiz.</li>
          <li>Check the source trail and illustrative labels.</li>
          <li>Review with keyboard navigation and a narrow window.</li>
          <li>Approve installation only after these checks pass.</li>
        </ul>
      </div>
    </main>
  );
}
