import type { Metadata } from "next";
import ReviewWorkspace from "./ReviewWorkspace";

export const metadata: Metadata = {
  title: "Review a generated lesson · Learning Harness",
  description: "Open a generated lesson locally and review it in the production renderer before installation.",
};

export default function ReviewPage() {
  return <ReviewWorkspace />;
}
