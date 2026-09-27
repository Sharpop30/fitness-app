// Every screen opens on demo data and shows its title (stage 2 plan, task 8). Synthetic data only.
import { render, screen, cleanup } from "@testing-library/react";
import { setSession } from "../api/client";
import { SCREENS } from "../App";
import { NavContext, type Nav } from "../nav";

const nav = (role: "coach" | "trainee"): Nav => ({
  role, tab: null, depth: 2, go: () => {}, replace: () => {}, back: () => {}, setTab: () => {}, signIn: () => {}, signOut: () => {}, toast: () => {},
});

const CASES: [string, "coach" | "trainee", Record<string, unknown>, string][] = [
  ["S01", "coach", {}, "הבית שלי"], ["S02", "coach", {}, "מתאמנים"], ["S03", "coach", { traineeID: "d0000000-0000-4000-8000-000000001001" }, "נועה (דוגמה)"],
  ["S04", "coach", { traineeID: "d0000000-0000-4000-8000-000000001001" }, "תוכנית אימון"], ["S05", "coach", {}, "תרגילים"], ["S06", "coach", { traineeID: "d0000000-0000-4000-8000-000000001001" }, "אימונים שבוצעו"],
  ["S07", "coach", { traineeID: "d0000000-0000-4000-8000-000000001001" }, "יעד אישי"], ["S08", "coach", {}, "תשלומים וחשבוניות"], ["S09", "coach", {}, "אתגר שבועי"],
  ["S10", "coach", {}, "תגמולים"], ["S11", "coach", {}, "שיעורים"], ["S12", "coach", {}, "הגדרות"],
  ["S13", "trainee", {}, "הבית שלי"], ["S14", "trainee", {}, "אימון"],
  ["S15", "trainee", { feedback: { done: 9, total: 9, records: [], coins: 10, goal: false, challenge: false, text: "כל הכבוד" } }, "כל הכבוד!"],
  ["S16", "trainee", {}, "האימונים שלי"], ["S17", "trainee", {}, "שיעורים"], ["S18", "trainee", {}, "מטבעות ותגמולים"],
  ["S19", "trainee", {}, "תשלומים"], ["S20", "trainee", {}, "האתגר השבועי"], ["S21", "trainee", {}, "גרף התקדמות"],
  ["S22", "trainee", {}, "הצטרפות"], ["S23", "trainee", {}, "כניסה לאפליקציה"],
];

afterEach(cleanup);

test.each(CASES)("%s opens and shows its title", async (id, role, params, title) => {
  setSession({ role, traineeID: role === "trainee" ? "d0000000-0000-4000-8000-000000001001" : null });
  const S = SCREENS[id];
  render(<NavContext.Provider value={nav(role)}><S {...params} /></NavContext.Provider>);
  expect(await screen.findByRole("heading", { level: 1, name: title })).toBeTruthy();
  expect(screen.getByText(/נתוני דוגמה/)).toBeTruthy();
});
