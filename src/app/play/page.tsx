import type { Metadata } from "next";
import { PlayClient } from "./PlayClient";

export const metadata: Metadata = {
  title: "Play",
  description: "Climb the Olsen Tower of Doom: 12 floors of feedback villains that test the 2 A's of Feedback.",
};

export default function PlayPage() {
  return <PlayClient />;
}
