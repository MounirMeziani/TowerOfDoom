"use client";

import { Component, type ReactNode } from "react";

/** Catches a crashing 3D scene (lost WebGL context, driver bugs) so the game can fall back to 2D. */
export class SceneBoundary extends Component<{ children: ReactNode; onError: () => void; fallback?: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true };
  }

  componentDidCatch(error: unknown): void {
    console.error("3D scene failed, falling back to 2D", error);
    this.props.onError();
  }

  render(): ReactNode {
    return this.state.failed ? (this.props.fallback ?? null) : this.props.children;
  }
}
