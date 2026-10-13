/**
 * Per-hero styling for the low-poly 3D adventurers. Pure data so it can be
 * shared by the kit and by any 2D preview.
 */

export type HeroHeadwear = "helmet" | "wizard-hat" | "hood" | "leaf-crown" | "plumed-helm" | "bald" | "beret" | "ninja-mask";
export type HeroProp = "shield" | "staff" | "bow" | "druid-staff" | "sword" | "beads" | "lute" | "katana";

export interface HeroLook {
  skin: string;
  hair: string;
  /** Legs / boots / gloves. */
  dark: string;
  /** Trim, buckles, gems. */
  accent: string;
  headwear: HeroHeadwear;
  prop: HeroProp;
  /** Long robe instead of separate legs reading as trousers. */
  robe?: boolean;
  cape?: string;
}

const LOOKS: Record<string, HeroLook> = {
  "ledger-knight": { skin: "#f1c27d", hair: "#5a3a1a", dark: "#2a3550", accent: "#ffcf4a", headwear: "helmet", prop: "shield", cape: "#1d4e6b" },
  "spreadsheet-sorceress": { skin: "#c68642", hair: "#2b1640", dark: "#2c1745", accent: "#3ddc97", headwear: "wizard-hat", prop: "staff", robe: true },
  "inbox-ranger": { skin: "#e0ac69", hair: "#3b2a14", dark: "#1f3a2a", accent: "#c9a35b", headwear: "hood", prop: "bow", cape: "#1d5a3a" },
  "deadline-druid": { skin: "#8d5524", hair: "#d9d0b8", dark: "#3a2a17", accent: "#7bd88f", headwear: "leaf-crown", prop: "druid-staff", robe: true },
  "pivot-paladin": { skin: "#ffdbac", hair: "#b5651d", dark: "#3b2330", accent: "#ffcf4a", headwear: "plumed-helm", prop: "sword", cape: "#8a1d2c" },
  "meeting-monk": { skin: "#d4a373", hair: "#d4a373", dark: "#5a3a12", accent: "#ff6b2c", headwear: "bald", prop: "beads", robe: true },
  "data-bard": { skin: "#f3d1b0", hair: "#7a3b12", dark: "#3d2516", accent: "#4cc9f0", headwear: "beret", prop: "lute", cape: "#6b2d5c" },
  "invoice-ninja": { skin: "#a0662f", hair: "#111018", dark: "#15131c", accent: "#ff4d6d", headwear: "ninja-mask", prop: "katana" },
};

const FALLBACK: HeroLook = LOOKS["ledger-knight"];

export function getHeroLook(heroId: string | null | undefined): HeroLook {
  return (heroId && LOOKS[heroId]) || FALLBACK;
}

/** Stable 0..1 value from a string (used to de-sync idle animations). */
export function hash01(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 10000) / 10000;
}
