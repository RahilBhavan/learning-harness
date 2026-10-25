import type { Metadata } from "next";
import LessonExperience, { type Lesson } from "./LessonExperience";
import lessonJson from "@/content/harness-control-loop.json";

// The JSON import types every `type` field as `string`. `npm run validate:content`
// validates the lesson content.
const lesson = lessonJson as Lesson;

export const metadata: Metadata = {
  title: `${lesson.title} · Learning Harness`,
  description: lesson.summary,
};

export default function Home() {
  return <LessonExperience lesson={lesson} />;
}
