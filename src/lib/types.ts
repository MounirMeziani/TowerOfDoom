export type AKey = "assist" | "actionable" | "appreciate" | "acceptOrDecline";
export type Mode = "giving" | "receiving";

export const MODE_AS: Record<Mode, readonly [AKey, AKey]> = {
  giving: ["assist", "actionable"],
  receiving: ["appreciate", "acceptOrDecline"],
};

export const A_INFO: Record<AKey, { label: string; mode: Mode; short: string; description: string }> = {
  assist: { label: "Assist", mode: "giving", short: "Help, don't vent", description: "Offer helpful, constructive ideas to support the person's improvement rather than reacting out of frustration or anger." },
  actionable: { label: "Actionable", mode: "giving", short: "Give concrete next steps", description: "Make sure the feedback provides clear, concrete steps the recipient can actually do something about." },
  appreciate: { label: "Appreciate", mode: "receiving", short: "Say thank you", description: "Show gratitude by saying \"thank you\" for the input, even if it feels uncomfortable or you disagree." },
  acceptOrDecline: { label: "Accept or Decline", mode: "receiving", short: "Weigh it, then choose", description: "Reflect on the guidance, weigh its value, and make an autonomous choice about what to implement." },
};

export interface Choice {
  id: string;
  text: string;          // what the player says/does (or, on spot floors, their verdict)
  correct: boolean;      // exactly one per floor
  hits: AKey[];          // A's this choice gets right (subset of the floor mode's A's)
  misses: AKey[];        // A's this choice violates / misjudges (subset of the floor mode's A's)
  explanation: string;   // 1-2 sentences shown after picking, teaching WHY
  present?: AKey[];      // spot floors only: which of the mode's A's this verdict says are present
}

export interface Villain { name: string; emoji: string; title: string; taunt: string }

export interface RegularFloor {
  id: string;
  kind: "choose" | "spot";   // choose = pick the best response; spot = judge a quoted response ("which A is missing?")
  mode: Mode;
  department: string;         // flavor, e.g. "Accounts Payable — Floor of Endless Invoices"
  villain: Villain;
  setup: string;              // scenario narration, 1-3 sentences, second person
  quote?: string;             // spot floors: the feedback (giving) or reaction (receiving) being judged
  prompt: string;             // the question
  choices: Choice[];          // 3-4 choices
}

export interface BossFloor {
  id: string;
  kind: "boss";
  mode: Mode;
  department: string;
  villain: Villain;
  setup: string;
  prompt: string;             // what the player must write
  placeholder: string;
  exemplar: string;           // model answer shown after judging
}

export type Floor = RegularFloor | BossFloor;

export type AStats = Record<AKey, { correct: number; total: number }>;

export interface RunSubmission {
  playerName: string;
  heroId: string;            // id from HEROES (src/lib/characters.ts)
  sessionCode: string | null;
  score: number;
  floorsCleared: number;
  totalFloors: number;
  heartsLeft: number;
  durationMs: number;
  outcome: "victory" | "doomed";
  aStats: AStats;
  playerId?: string;         // stable Player.id, keeps same-named players apart on the leaderboard
}

export interface RunRow {   // Supabase row shape (snake_case)
  id: string; session_code: string | null; player_name: string; score: number;
  floors_cleared: number; total_floors: number; hearts_left: number; duration_ms: number;
  outcome: "victory" | "doomed"; a_stats: AStats; avatar: string | null; created_at: string;
  player_id?: string | null; // null for runs recorded before 0003_run_player_id.sql
}

export type SessionStatus = "lobby" | "playing" | "ended";
// Public session shape. NOTE: sessions.host_key exists in the DB but anon has NO column grant on it —
// browser queries must select explicit columns: "id, code, name, status, started_at, created_at" (never "*").
export interface SessionRow { id: string; code: string; name: string; status: SessionStatus; started_at: string | null; created_at: string }

// Lobby presence (Supabase Realtime Presence on channel "lobby:<CODE>", presence key = playerId)
export type PlayerPhase = "lobby" | "playing" | "finished";
export interface LobbyPresence {
  playerId: string; name: string; heroId: string;
  phase: PlayerPhase; floor?: number; score?: number; hearts?: number;
  joinedAt: string; // ISO
}
export interface Player { id: string; name: string; heroId: string; sessionCode: string | null }

export interface JudgeRequest { floorId: string; mode: Mode; setup: string; prompt: string; answer: string; playerId?: string }
export interface JudgeResult {
  scores: Partial<Record<AKey, 0 | 1 | 2>>; // exactly the two A's of the mode
  passed: boolean;                           // both A's >= 1 AND sum >= 3
  feedback: string;                          // 1-3 sentences that themselves model Assist + Actionable
  source: "ai" | "heuristic";
}
