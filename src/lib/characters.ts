export interface Hero { id: string; name: string; title: string; emoji: string; color: string; perk: string }

export const HEROES: Hero[] = [
  { id: "ledger-knight", name: "Ledger Knight", title: "Guardian of Balanced Books", emoji: "🛡️", color: "#4cc9f0", perk: "Never vague" },
  { id: "spreadsheet-sorceress", name: "Spreadsheet Sorceress", title: "Weaver of Pivot Tables", emoji: "🧙", color: "#c77dff", perk: "Turns rants into next steps" },
  { id: "inbox-ranger", name: "Inbox Ranger", title: "Tracker of Lost Threads", emoji: "🏹", color: "#3ddc97", perk: "Hits the point on the first try" },
  { id: "deadline-druid", name: "Deadline Druid", title: "Keeper of the Sacred Calendar", emoji: "🌿", color: "#7bd88f", perk: "Stays calm under pressure" },
  { id: "pivot-paladin", name: "Pivot Paladin", title: "Champion of Course Corrections", emoji: "⚔️", color: "#ff6b2c", perk: "Weighs every critique fairly" },
  { id: "meeting-monk", name: "Meeting Monk", title: "Master of the Silent Agenda", emoji: "🧘", color: "#ffcf4a", perk: "Says thank you first" },
  { id: "data-bard", name: "Data Bard", title: "Singer of Quarterly Ballads", emoji: "🎻", color: "#ff9a3d", perk: "Feedback with a melody" },
  { id: "invoice-ninja", name: "Invoice Ninja", title: "Shadow of Accounts Payable", emoji: "🥷", color: "#ff4d6d", perk: "Strikes with specifics" },
];

/** Returns the hero with this id, falling back to HEROES[0]. */
export function getHero(id: string | null | undefined): Hero {
  return HEROES.find((h) => h.id === id) ?? HEROES[0];
}
