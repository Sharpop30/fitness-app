// The five deployment blockers of the design review (design stage, task 2; project-docs/findings-design-review.md, 1 to 5).
// Each is shown on demo data, with the adapter made to fail where the blocker is about a failure. Synthetic data only.
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { setAdapter, setSession, type Adapter } from "../api/client";
import { demoAdapter } from "../demo/adapter";
import { SCREENS } from "../App";
import { NavContext, type Nav } from "../nav";
import * as auth from "../identity/auth";

vi.mock("../identity/auth", async (original) => ({ ...(await original<object>()), accessToken: vi.fn(() => null), identityConfigured: vi.fn(() => false) }));

const NOA = "d0000000-0000-4000-8000-000000001001";
const toasts: string[] = [];
const nav = (role: "coach" | "trainee", over: Partial<Nav> = {}): Nav => ({
  role, roles: [role], tab: null, depth: 2, go: () => {}, replace: () => {}, back: () => {}, setTab: () => {}, signIn: () => {}, switchRole: () => {}, signOut: () => {},
  toast: (t) => { toasts.push(t); }, ...over,
});
const open = (id: string, role: "coach" | "trainee", params: Record<string, unknown> = {}, over: Partial<Nav> = {}) => {
  setSession({ role, traineeID: role === "trainee" ? NOA : null });
  const S = SCREENS[id];
  return render(<NavContext.Provider value={nav(role, over)}><S {...params} /></NavContext.Provider>);
};
// The Endpoint out of reach for the given actions ("*" for all): what the client returns when fetch fails.
const unreachable = (actions: string[]): Adapter => (e, s) =>
  actions.includes("*") || actions.includes(`${e.module}.${e.action}`)
    ? Promise.resolve({ ok: false, data: null, error: { code: "STORAGE_UNAVAILABLE", message: "" } })
    : demoAdapter(e, s);

afterEach(() => { cleanup(); setAdapter(demoAdapter); toasts.length = 0; vi.mocked(auth.identityConfigured).mockReturnValue(false); });

test("blocker 1: with real data the bar says only that payments are a demo; on demo data it says all is sample data", async () => {
  vi.mocked(auth.identityConfigured).mockReturnValue(true);
  open("S01", "coach");
  expect(await screen.findByText("תשלומים וחשבוניות הם הדגמה בלבד.")).toBeTruthy();
  expect(screen.queryByText(/נתוני דוגמה/)).toBeNull();
  cleanup();
  vi.mocked(auth.identityConfigured).mockReturnValue(false);
  open("S01", "coach");
  expect(await screen.findByText(/כל הנתונים הם נתוני דוגמה/)).toBeTruthy();
});

test.each([
  ["S06", "coach", { traineeID: NOA }, "עוד אין אימונים שבוצעו"],
  ["S16", "trainee", {}, "עוד אין אימונים"],
  ["S20", "trainee", {}, "אין אתגר השבוע"],
  ["S01", "coach", {}, null],
  ["S13", "trainee", {}, null],
] as const)("blocker 2: %s with the server out of reach says so and offers a retry, and never says there is none", async (id, role, params, none) => {
  setAdapter(unreachable(["*"]));
  open(id, role, params);
  expect((await screen.findByRole("alert")).textContent).toContain("אין חיבור כרגע");
  if (none) expect(screen.queryByText(none)).toBeNull();
  setAdapter(demoAdapter);
  fireEvent.click(screen.getByRole("button", { name: "לנסות שוב" }));
  await waitFor(() => expect(screen.queryByRole("alert")).toBeNull());
});

test("blocker 2 and finding 6: while the reply is on its way the screen says it is loading", async () => {
  let release!: () => void;
  setAdapter((e, s) => new Promise((r) => { release = () => r(demoAdapter(e, s)); }));
  open("S02", "coach");
  expect(screen.getByRole("status").textContent).toBe("טוען...");
  await act(async () => release());
  expect(await screen.findByText("נועה (דוגמה)")).toBeTruthy();
});

test.each([
  ["S10", "coach", {}, "coins.mark_reward_delivered", "סימון סופק", "סומן: התגמול סופק"],
  ["S09", "coach", {}, "challenges.mark_prize_delivered", "סימון מסירת פרס", "סומן: הפרס נמסר"],
  ["S11", "coach", {}, "classes.decide_late_cancel", "אישור", "הבקשה אושרה"],
  ["S13", "trainee", {}, "notifications.mark_read", "סימון כנקרא", null],
] as const)("blocker 3: %s reports a failed %s as a failure, not a success", async (id, role, params, action, press, success) => {
  // S11 needs a pending late request to decide: the trainee sends one first, on demo data.
  if (id === "S11") {
    setSession({ role: "trainee", traineeID: NOA });
    await demoAdapter({ caller: "S17", module: "classes", action: "request_late_cancel", payload: { classID: "d0000000-0000-4000-8000-00000000a001" }, lang: "he" }, { role: "trainee", traineeID: NOA });
  }
  setAdapter(unreachable([action]));
  open(id, role, params);
  const button = (await screen.findAllByRole("button", { name: press }))[0];
  fireEvent.click(button);
  await waitFor(() => expect(toasts.length).toBeGreaterThan(0));
  if (success) expect(toasts).not.toContain(success);
  expect(toasts.at(-1)).toMatch(/השינוי לא נשמר|השתבש/);
});

test("blocker 3: a late-cancel request that failed does not say it was sent (S17)", async () => {
  setAdapter(unreachable(["classes.request_late_cancel"]));
  const back = vi.fn();
  open("S17", "trainee", { lateFor: { ClassID: "x", startsAt: new Date().toISOString(), cancelHours: 24 } }, { back });
  fireEvent.click(screen.getByRole("button", { name: "שליחת בקשה חריגה למאמן" }));
  await waitFor(() => expect(toasts.length).toBe(1));
  expect(toasts[0]).not.toBe("הבקשה נשלחה למאמן");
  expect(back).not.toHaveBeenCalled();
});

test("blocker 4: the goal screen opens on the active goal the card sent, which has no status field (S07)", async () => {
  const card = await demoAdapter({ caller: "S03", module: "trainees", action: "get_trainee_card", payload: { traineeID: NOA }, lang: "he" }, { role: "coach", traineeID: null });
  const goal = card.data.goal;
  expect(goal).toBeTruthy();
  expect(goal.status).toBeUndefined(); // as the server sends it
  open("S07", "coach", { traineeID: NOA, goal, name: "נועה (דוגמה)" });
  await screen.findByRole("option", { name: goal.exerciseName });
  expect((screen.getByLabelText('משקל יעד (ק"ג)') as HTMLInputElement).value).toBe(String(goal.targetWeight));
  expect((screen.getByLabelText("תרגיל") as HTMLSelectElement).value).toBe(goal.ExerciseID);
  expect(screen.getByText(/היעד הנוכחי/)).toBeTruthy();
});

describe("blocker 5: the invite link is shown on the screen, and 'copied' is said only when it was", () => {
  const invite = async () => {
    open("S02", "coach", { invite: true });
    fireEvent.change(screen.getByLabelText("שם המתאמן"), { target: { value: "דנה" } });
    fireEvent.click(screen.getByRole("button", { name: "יצירת קישור לשיתוף (למשל בוואטסאפ)" }));
    return screen.findByText(/join/);
  };
  test("the link stays on the screen", async () => {
    expect((await invite()).className).toBe("linkbox");
  });
  test("a copy the browser refused says so", async () => {
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: vi.fn(() => Promise.reject(new Error("denied"))) } });
    await invite();
    fireEvent.click(screen.getByRole("button", { name: /^העתק/ }));
    await waitFor(() => expect(toasts).toContain("ההעתקה לא הצליחה. אפשר לסמן את הקישור ולהעתיק ידנית"));
    expect(toasts).not.toContain("הקישור הועתק");
  });
  test("a copy that worked says copied", async () => {
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: vi.fn(() => Promise.resolve()) } });
    await invite();
    fireEvent.click(screen.getByRole("button", { name: /^העתק/ }));
    await waitFor(() => expect(toasts).toContain("הקישור הועתק"));
  });
});
