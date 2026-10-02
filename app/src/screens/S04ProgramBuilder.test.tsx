// S04, code review in stage 7c, finding 2: an exercise appears once in a workout, so adding or swapping never offers one
// the workout already holds. On demo data, synthetic only.
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { setSession } from "../api/client";
import { NavContext, type Nav } from "../nav";
import S04ProgramBuilder from "./S04ProgramBuilder";

vi.mock("../identity/auth", async (original) => ({ ...(await original<object>()), accessToken: vi.fn(() => null), identityConfigured: vi.fn(() => false) }));

const NOA = "d0000000-0000-4000-8000-000000001001"; // workout A: squat, bench press, pushups
const nav: Nav = {
  role: "coach", roles: ["coach"], tab: null, depth: 2, go: () => {}, replace: () => {}, back: () => {}, setTab: () => {},
  signIn: () => {}, switchRole: () => {}, signOut: () => {}, toast: () => {},
};
afterEach(cleanup);

test("adding an exercise offers only the ones not yet in the workout, and starts at the first of them", async () => {
  setSession({ role: "coach", traineeID: null });
  render(<NavContext.Provider value={nav}><S04ProgramBuilder traineeID={NOA} /></NavContext.Provider>);
  fireEvent.click((await screen.findAllByText("+ תרגיל"))[0]);

  await screen.findByText("החלפת תרגיל");
  expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("חתירה בכבל"); // the first exercise not in workout A
  const offered = within(document.querySelector(".list") as HTMLElement).getAllByRole("button").map((b) => b.textContent ?? "");
  for (const inWorkout of ["סקוואט", "לחיצת חזה", "שכיבות סמיכה", "חתירה בכבל"]) {
    expect(offered.some((t) => t.startsWith(inWorkout))).toBe(false);
  }
  expect(offered.some((t) => t.startsWith("מכרעים"))).toBe(true);
});
