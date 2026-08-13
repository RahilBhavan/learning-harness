import type { Metadata } from "next";
import LessonExperience from "./LessonExperience";
import lesson from "@/content/harness-control-loop.json";

export const metadata: Metadata = {
  title: `${lesson.title} · Learning Harness`,
  description: lesson.summary,
};

export default function Home() {
  return <LessonExperience lesson={lesson} />;
}
